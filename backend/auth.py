"""Stealth users, sessions and password resets.

- Users: username + email + password (PBKDF2-SHA256), role 'admin' or 'member'. The first admin is created from
  TETHER_EMAIL / TETHER_PASSWORD (the old shared login), so that login keeps working.
- Sessions: random bearer tokens, stored hashed, valid 30 days. Logout / password change / reset end them.
- Forgot password: a single-use link valid 1 hour, emailed over SMTP (Gmail by default: SMTP_USER + an app password in
  SMTP_PASSWORD). The response never says whether an account exists.
- Admins manage users; the last active admin can't be removed, demoted or deactivated.
"""
import asyncio
import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
import time
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request

logger = logging.getLogger('auth')

SESSION_DAYS = 30
RESET_MINUTES = 60
PBKDF2_ROUNDS = 310_000
USERNAME_RX = re.compile(r'^[a-z0-9._-]{3,40}$')
EMAIL_RX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def sha(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), PBKDF2_ROUNDS).hex()
    return f'pbkdf2_sha256${PBKDF2_ROUNDS}${salt}${digest}'


def check_password(password: str, stored: str) -> bool:
    try:
        _, rounds, salt, digest = stored.split('$')
        test = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(test, digest)
    except (ValueError, AttributeError):
        return False


def check_new_password(password: str):
    if not isinstance(password, str) or len(password) < 8:
        raise HTTPException(status_code=400, detail='Password must be at least 8 characters.')
    if len(password) > 200:
        raise HTTPException(status_code=400, detail='Password is too long.')


def public(user: dict) -> dict:
    return {k: user.get(k) for k in ('id', 'username', 'name', 'email', 'role', 'active', 'created_at', 'last_login_at')}


# ── email ────────────────────────────────────────────────────────────────────
def mail_configured() -> bool:
    return bool(os.environ.get('SMTP_USER') and os.environ.get('SMTP_PASSWORD'))


def _send(to: str, subject: str, text: str, html: str):
    msg = EmailMessage()
    sender = os.environ.get('SMTP_FROM') or os.environ['SMTP_USER']
    msg['From'] = f'Stealth <{sender}>' if '<' not in sender else sender
    msg['To'] = to
    msg['Subject'] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype='html')
    host = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    port = int(os.environ.get('SMTP_PORT', '587'))
    with smtplib.SMTP(host, port, timeout=20) as s:
        s.starttls()
        s.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        s.send_message(msg)


async def send_mail(to: str, subject: str, text: str, html: str) -> bool:
    if not mail_configured():
        logger.warning('Email not sent (SMTP_USER / SMTP_PASSWORD not set): %s to %s', subject, to)
        return False
    try:
        await asyncio.to_thread(_send, to, subject, text, html)
        return True
    except Exception as e:      # never leak SMTP errors to the caller
        logger.error('Email to %s failed: %s', to, e)
        return False


def reset_email(user: dict, link: str, invite: bool):
    name = user.get('name') or user['username']
    if invite:
        subject = 'Set your Stealth password'
        lead = f"You've been given access to the Stealth workspace (username: {user['username']}). Choose a password to sign in:"
    else:
        subject = 'Reset your Stealth password'
        lead = f"Someone asked to reset the password for {user['username']}. If that was you, choose a new password:"
    text = f"Hi {name},\n\n{lead}\n{link}\n\nThis link works once and expires in {RESET_MINUTES} minutes. If you didn't ask for it, ignore this email.\n\n— Stealth"
    html = f"""<div style="font-family:Inter,Helvetica,Arial,sans-serif;color:#243047;max-width:480px">
<p>Hi {name},</p><p>{lead}</p>
<p><a href="{link}" style="display:inline-block;padding:11px 18px;border-radius:4px;background:#315fd1;color:#fff;text-decoration:none;font-weight:600">{'Set my password' if invite else 'Reset my password'}</a></p>
<p style="color:#68788f;font-size:13px">This link works once and expires in {RESET_MINUTES} minutes. If you didn't ask for it, you can ignore this email.</p>
<p style="color:#68788f;font-size:13px">— Stealth · Dr. Shumard</p></div>"""
    return subject, text, html


# ── throttling (per process; enough to stop guessing) ───────────────────────
_fails: dict = {}


def throttle(key: str, limit: int, window: int):
    t = time.time()
    hits = [x for x in _fails.get(key, []) if t - x < window]
    _fails[key] = hits
    if len(hits) >= limit:
        raise HTTPException(status_code=429, detail='Too many attempts. Please wait a few minutes and try again.')


def record(key: str):
    _fails.setdefault(key, []).append(time.time())


def client_ip(request: Request) -> str:
    return (request.headers.get('x-forwarded-for') or request.client.host or '').split(',')[0].strip()


# ── router ───────────────────────────────────────────────────────────────────
def build_router(db) -> APIRouter:
    r = APIRouter()
    state = {'ready': False}

    async def ensure_ready():
        """Indexes (once), and the first admin from the old shared login whenever there are no users."""
        if state['ready'] and await db.users.estimated_document_count() > 0:
            return
        await db.users.create_index('id', unique=True)
        await db.users.create_index('username', unique=True)
        await db.users.create_index('email', unique=True, sparse=True)
        await db.auth_sessions.create_index('token_hash', unique=True)
        await db.auth_sessions.create_index('expires_at', expireAfterSeconds=0)
        await db.password_resets.create_index('token_hash', unique=True)
        await db.password_resets.create_index('expires_at', expireAfterSeconds=0)
        if await db.users.count_documents({}) == 0:
            email = (os.environ.get('TETHER_EMAIL') or 'admin@tether.com').strip().lower()
            await db.users.insert_one({
                'id': str(uuid.uuid4()), 'username': 'admin', 'name': 'Admin', 'email': email, 'role': 'admin',
                'active': True, 'password_hash': hash_password(os.environ.get('TETHER_PASSWORD') or 'tether2024'),
                'created_at': iso(now()), 'updated_at': iso(now()),
            })
            logger.info('Created the first admin (username "admin", email %s) from TETHER_EMAIL / TETHER_PASSWORD', email)
        state['ready'] = True

    async def find_by_identifier(identifier: str):
        ident = (identifier or '').strip().lower()
        if not ident:
            return None
        return await db.users.find_one({'$or': [{'username': ident}, {'email': ident}]}, {'_id': 0})

    async def new_session(user: dict) -> str:
        token = secrets.token_urlsafe(32)
        await db.auth_sessions.insert_one({'token_hash': sha(token), 'user_id': user['id'], 'created_at': iso(now()),
                                           'expires_at': now() + timedelta(days=SESSION_DAYS)})
        return token

    async def current_user(authorization: Optional[str] = Header(None)) -> dict:
        await ensure_ready()
        token = (authorization or '').removeprefix('Bearer ').strip()
        if not token:
            raise HTTPException(status_code=401, detail='Not signed in')
        s = await db.auth_sessions.find_one({'token_hash': sha(token)})
        if not s or s['expires_at'].replace(tzinfo=timezone.utc) < now():
            raise HTTPException(status_code=401, detail='Session expired — please sign in again')
        user = await db.users.find_one({'id': s['user_id']}, {'_id': 0})
        if not user or not user.get('active', True):
            raise HTTPException(status_code=401, detail='This account is disabled')
        return user

    async def admin_user(user: dict = Depends(current_user)) -> dict:
        if user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail='Only admins can manage users')
        return user

    async def issue_reset(user: dict, request: Request, invite=False) -> bool:
        token = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({'token_hash': sha(token), 'user_id': user['id'], 'created_at': iso(now()),
                                             'expires_at': now() + timedelta(minutes=RESET_MINUTES if not invite else 60 * 72),
                                             'used': False})
        base = (os.environ.get('APP_URL') or request.headers.get('origin') or 'https://tether.drshumard.com').rstrip('/')
        subject, text, html = reset_email(user, f'{base}/reset-password?token={token}', invite)
        if invite:
            text = text.replace(f'expires in {RESET_MINUTES} minutes', 'expires in 3 days')
            html = html.replace(f'expires in {RESET_MINUTES} minutes', 'expires in 3 days')
        return await send_mail(user['email'], subject, text, html) if user.get('email') else False

    async def last_admin(user_id: str) -> bool:
        return await db.users.count_documents({'role': 'admin', 'active': True, 'id': {'$ne': user_id}}) == 0

    # ── sign in / out ──
    @r.post('/auth/login')
    async def login(request: Request, body: dict = Body(...)):
        await ensure_ready()
        identifier = str(body.get('identifier') or body.get('username') or body.get('email') or '').strip().lower()
        password = str(body.get('password') or '')
        key = f'login:{identifier}:{client_ip(request)}'
        throttle(key, 8, 900)
        user = await find_by_identifier(identifier)
        if not user or not user.get('active', True) or not check_password(password, user.get('password_hash', '')):
            record(key)
            raise HTTPException(status_code=401, detail='Incorrect username or password')
        _fails.pop(key, None)
        await db.users.update_one({'id': user['id']}, {'$set': {'last_login_at': iso(now())}})
        return {'token': await new_session(user), 'user': public(user)}

    @r.get('/auth/me')
    async def me(user: dict = Depends(current_user)):
        return {'user': public(user), 'mail_configured': mail_configured()}

    @r.post('/auth/verify')       # older clients
    async def verify(authorization: Optional[str] = Header(None), body: dict = Body(default={})):
        user = await current_user(authorization or f"Bearer {body.get('token', '')}")
        return {'valid': True, 'user': public(user)}

    @r.post('/auth/logout')
    async def logout(authorization: Optional[str] = Header(None)):
        token = (authorization or '').removeprefix('Bearer ').strip()
        if token:
            await db.auth_sessions.delete_one({'token_hash': sha(token)})
        return {'ok': True}

    @r.post('/auth/change-password')
    async def change_password(body: dict = Body(...), user: dict = Depends(current_user), authorization: Optional[str] = Header(None)):
        if not check_password(str(body.get('current') or ''), user.get('password_hash', '')):
            raise HTTPException(status_code=400, detail='Your current password is incorrect.')
        check_new_password(body.get('password'))
        await db.users.update_one({'id': user['id']}, {'$set': {'password_hash': hash_password(body['password']), 'updated_at': iso(now())}})
        keep = sha((authorization or '').removeprefix('Bearer ').strip())
        await db.auth_sessions.delete_many({'user_id': user['id'], 'token_hash': {'$ne': keep}})   # sign out other devices
        return {'ok': True}

    # ── forgot / reset ──
    @r.post('/auth/forgot')
    async def forgot(request: Request, body: dict = Body(...)):
        await ensure_ready()
        identifier = str(body.get('identifier') or '').strip().lower()
        throttle(f'forgot:{client_ip(request)}', 5, 900)
        record(f'forgot:{client_ip(request)}')
        user = await find_by_identifier(identifier)
        if user and user.get('active', True) and user.get('email'):
            await issue_reset(user, request)
        # Same answer either way, so the form can't be used to discover accounts.
        return {'ok': True}

    @r.get('/auth/reset/check')
    async def reset_check(token: str):
        rec = await db.password_resets.find_one({'token_hash': sha(token), 'used': False})
        if not rec or rec['expires_at'].replace(tzinfo=timezone.utc) < now():
            return {'valid': False}
        user = await db.users.find_one({'id': rec['user_id']}, {'_id': 0, 'username': 1, 'name': 1})
        return {'valid': bool(user), 'username': user and user['username'], 'name': user and user.get('name')}

    @r.post('/auth/reset')
    async def reset(request: Request, body: dict = Body(...)):
        throttle(f'reset:{client_ip(request)}', 10, 900)
        token = str(body.get('token') or '')
        rec = await db.password_resets.find_one({'token_hash': sha(token), 'used': False})
        if not rec or rec['expires_at'].replace(tzinfo=timezone.utc) < now():
            record(f'reset:{client_ip(request)}')
            raise HTTPException(status_code=400, detail='This link has expired or was already used. Ask for a new one.')
        check_new_password(body.get('password'))
        await db.users.update_one({'id': rec['user_id']}, {'$set': {'password_hash': hash_password(body['password']), 'updated_at': iso(now())}})
        await db.password_resets.update_many({'user_id': rec['user_id']}, {'$set': {'used': True}})
        await db.auth_sessions.delete_many({'user_id': rec['user_id']})
        return {'ok': True}

    # ── user management (admins) ──
    @r.get('/users')
    async def list_users(_: dict = Depends(admin_user)):
        users = await db.users.find({}, {'_id': 0}).sort('created_at', 1).to_list(500)
        return {'users': [public(u) for u in users], 'mail_configured': mail_configured()}

    @r.post('/users', status_code=201)
    async def create_user(request: Request, body: dict = Body(...), _: dict = Depends(admin_user)):
        username = str(body.get('username') or '').strip().lower()
        email = str(body.get('email') or '').strip().lower()
        name = str(body.get('name') or '').strip()[:80]
        role = body.get('role') if body.get('role') in ('admin', 'member') else 'member'
        password = body.get('password') or ''
        if not USERNAME_RX.match(username):
            raise HTTPException(status_code=400, detail='Username: 3–40 characters, letters, numbers, dot, dash or underscore.')
        if not EMAIL_RX.match(email):
            raise HTTPException(status_code=400, detail='Enter a valid email (used for password resets).')
        if await db.users.find_one({'$or': [{'username': username}, {'email': email}]}):
            raise HTTPException(status_code=409, detail='That username or email is already in use.')
        invite = not password
        if not invite:
            check_new_password(password)
        elif not mail_configured():
            raise HTTPException(status_code=400, detail='Email is not set up, so set a password for them instead.')
        user = {'id': str(uuid.uuid4()), 'username': username, 'name': name, 'email': email, 'role': role, 'active': True,
                'password_hash': hash_password(password or secrets.token_urlsafe(24)),
                'created_at': iso(now()), 'updated_at': iso(now())}
        await db.users.insert_one(dict(user))
        sent = await issue_reset(user, request, invite=True) if invite else False
        return {'user': public(user), 'invite_sent': sent}

    @r.patch('/users/{user_id}')
    async def update_user(user_id: str, body: dict = Body(...), me_: dict = Depends(admin_user)):
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        patch = {}
        if 'name' in body:
            patch['name'] = str(body['name'] or '').strip()[:80]
        if 'email' in body:
            email = str(body['email'] or '').strip().lower()
            if not EMAIL_RX.match(email):
                raise HTTPException(status_code=400, detail='Enter a valid email.')
            if await db.users.find_one({'email': email, 'id': {'$ne': user_id}}):
                raise HTTPException(status_code=409, detail='That email is already in use.')
            patch['email'] = email
        demoting = body.get('role') == 'member' and user['role'] == 'admin'
        disabling = body.get('active') is False and user.get('active', True)
        if (demoting or disabling) and user['role'] == 'admin' and await last_admin(user_id):
            raise HTTPException(status_code=400, detail='There must always be at least one active admin.')
        if body.get('role') in ('admin', 'member'):
            patch['role'] = body['role']
        if 'active' in body:
            patch['active'] = bool(body['active'])
        if body.get('password'):
            check_new_password(body['password'])
            patch['password_hash'] = hash_password(body['password'])
        patch['updated_at'] = iso(now())
        await db.users.update_one({'id': user_id}, {'$set': patch})
        if patch.get('active') is False or 'password_hash' in patch:
            await db.auth_sessions.delete_many({'user_id': user_id})
        return {'user': public({**user, **patch})}

    @r.post('/users/{user_id}/send-reset')
    async def admin_send_reset(user_id: str, request: Request, _: dict = Depends(admin_user)):
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        if not mail_configured():
            raise HTTPException(status_code=400, detail='Email is not set up on the server yet.')
        if not await issue_reset(user, request):
            raise HTTPException(status_code=502, detail='The email could not be sent. Check the SMTP settings.')
        return {'ok': True}

    @r.delete('/users/{user_id}')
    async def delete_user(user_id: str, me_: dict = Depends(admin_user)):
        if user_id == me_['id']:
            raise HTTPException(status_code=400, detail="You can't delete your own account.")
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=404, detail='User not found')
        if user['role'] == 'admin' and await last_admin(user_id):
            raise HTTPException(status_code=400, detail='There must always be at least one active admin.')
        await db.users.delete_one({'id': user_id})
        await db.auth_sessions.delete_many({'user_id': user_id})
        await db.password_resets.delete_many({'user_id': user_id})
        return {'ok': True}

    return r
