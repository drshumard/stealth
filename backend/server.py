from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="StealthTrack API")
api_router = APIRouter(prefix="/api")


# ─────────────────────────── Models ───────────────────────────

class Attribution(BaseModel):
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_term: Optional[str] = None
    utm_content: Optional[str] = None
    utm_id: Optional[str] = None
    campaign_id: Optional[str] = None
    adset_id: Optional[str] = None
    ad_id: Optional[str] = None
    fbclid: Optional[str] = None
    gclid: Optional[str] = None
    ttclid: Optional[str] = None
    source_link_tag: Optional[str] = None
    fb_ad_set_id: Optional[str] = None
    google_campaign_id: Optional[str] = None
    extra: Optional[Dict[str, str]] = None


class PageVisit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str
    session_id: Optional[str] = None
    client_ip: Optional[str] = None
    current_url: str
    referrer_url: Optional[str] = None
    page_title: Optional[str] = None
    attribution: Optional[Attribution] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Contact(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: Optional[str] = None
    client_ip: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    attribution: Optional[Attribution] = None
    tags: Optional[List[str]] = None          # e.g. ["registered", "attended"]
    merged_into: Optional[str] = None
    merged_children: Optional[List[str]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PageViewCreate(BaseModel):
    contact_id: str
    session_id: Optional[str] = None
    current_url: str
    referrer_url: Optional[str] = None
    page_title: Optional[str] = None
    attribution: Optional[Dict[str, Any]] = None


class RegistrationCreate(BaseModel):
    contact_id: str
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    current_url: Optional[str] = None
    referrer_url: Optional[str] = None
    page_title: Optional[str] = None
    attribution: Optional[Dict[str, Any]] = None


class LeadCreate(BaseModel):
    contact_id: str
    session_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    current_url: Optional[str] = None
    referrer_url: Optional[str] = None
    page_title: Optional[str] = None
    attribution: Optional[Dict[str, Any]] = None


class StitchRequest(BaseModel):
    """Merge child_contact_id into parent_contact_id"""
    parent_contact_id: str
    child_contact_id: str
    session_id: Optional[str] = None


class ContactWithStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    session_id: Optional[str] = None
    client_ip: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    attribution: Optional[Attribution] = None
    tags: Optional[List[str]] = None
    merged_into: Optional[str] = None
    merged_children: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    visit_count: int = 0


class ContactDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    session_id: Optional[str] = None
    client_ip: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    attribution: Optional[Attribution] = None
    tags: Optional[List[str]] = None
    merged_into: Optional[str] = None
    merged_children: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    visits: List[PageVisit] = []


class TagCreate(BaseModel):
    contact_id: str
    tag: str                  # e.g. "registered", "attended", "thank-you"
    session_id: Optional[str] = None


# ─────────────────────────── Automation Models ───────────────────────────

class AutomationFilter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    field: str           # e.g. 'utm_source', 'email', 'phone'
    operator: str        # 'exists' | 'not_exists' | 'equals' | 'contains' | 'not_equals'
    value: Optional[str] = None


class AutomationFieldMap(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str          # Tether field name
    target: str          # Target webhook field name


class AutomationCreate(BaseModel):
    name: str
    enabled: bool = True
    webhook_url: str
    filters: List[AutomationFilter] = []
    field_map: List[AutomationFieldMap] = []
    custom_headers: Optional[Dict[str, str]] = None


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    webhook_url: Optional[str] = None
    filters: Optional[List[AutomationFilter]] = None
    field_map: Optional[List[AutomationFieldMap]] = None
    custom_headers: Optional[Dict[str, str]] = None


class AutomationOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    enabled: bool
    webhook_url: str
    filters: List[AutomationFilter] = []
    field_map: List[AutomationFieldMap] = []
    custom_headers: Optional[Dict[str, str]] = None
    created_at: datetime
    updated_at: datetime
    last_triggered_at: Optional[datetime] = None
    trigger_count: int = 0


class AutomationRunOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    automation_id: str
    run_type: str              # 'live' | 'test'
    contact_id: Optional[str] = None
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    payload: Dict[str, Any] = {}
    webhook_url: str
    http_status: Optional[int] = None
    response_body: Optional[str] = None
    success: bool
    error: Optional[str] = None
    duration_ms: Optional[int] = None
    triggered_at: datetime


# ─────────────────────────── Helpers ───────────────────────────

def dt_to_str(dt):
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt


def str_to_dt(s):
    if isinstance(s, str):
        try:
            return datetime.fromisoformat(s)
        except Exception:
            return s
    return s


def get_client_ip(request: Request) -> Optional[str]:
    """Extract real client IP, respecting reverse proxy headers."""
    # X-Forwarded-For may contain comma-separated list; take first (original client)
    xff = request.headers.get('x-forwarded-for')
    if xff:
        return xff.split(',')[0].strip()
    real_ip = request.headers.get('x-real-ip')
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return None


def safe_attribution(raw: Optional[dict]) -> Optional[Attribution]:
    if not raw:
        return None
    try:
        known = {
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'utm_id', 'campaign_id', 'adset_id', 'ad_id',
            'fbclid', 'gclid', 'ttclid', 'source_link_tag', 'fb_ad_set_id', 'google_campaign_id'
        }
        attrs = {k: str(v)[:500] for k, v in raw.items() if k in known and v}
        # Capture ALL unrecognised params into extra (merge with any existing extra dict)
        raw_extra = raw.get('extra') or {}
        extra_from_raw = {k: str(v)[:500] for k, v in raw.items() if k not in known and k != 'extra' and v}
        if isinstance(raw_extra, dict):
            extra_from_raw.update({k: str(v)[:500] for k, v in raw_extra.items() if v})
        if extra_from_raw:
            attrs['extra'] = extra_from_raw
        return Attribution(**attrs) if attrs else None
    except Exception:
        return None


def fix_contact_doc(c: dict) -> dict:
    c['created_at'] = str_to_dt(c.get('created_at'))
    c['updated_at'] = str_to_dt(c.get('updated_at'))
    if isinstance(c.get('attribution'), dict):
        c['attribution'] = Attribution(**{k: v for k, v in c['attribution'].items() if v})
    return c


def fix_visit_doc(v: dict) -> dict:
    v['timestamp'] = str_to_dt(v.get('timestamp'))
    if isinstance(v.get('attribution'), dict):
        v['attribution'] = Attribution(**{k: val for k, val in v['attribution'].items() if val})
    return v


def strip_nulls(d: dict) -> dict:
    """Recursively remove None values so MongoDB never stores null sub-fields
    that would block future dot-path $set operations."""
    result = {}
    for k, v in d.items():
        if v is None:
            continue
        if isinstance(v, dict):
            cleaned = strip_nulls(v)
            if cleaned:
                result[k] = cleaned
        else:
            result[k] = v
    return result


async def _resolve_contact_id(contact_id: str) -> str:
    """
    Follow the merge chain to find the root (visible) contact_id.
    If a browser holds a stale child ID from a previous session, all operations
    will transparently target the parent contact instead.
    Guards against cycles with a visited set.
    """
    visited: set = set()
    cid = contact_id
    while cid and cid not in visited:
        visited.add(cid)
        doc = await db.contacts.find_one({"contact_id": cid}, {"_id": 0, "merged_into": 1})
        if not doc or not doc.get("merged_into"):
            return cid
        cid = doc["merged_into"]
    return contact_id  # fallback (cycle or missing)


async def _upsert_contact(data: dict, now: datetime, client_ip: Optional[str] = None) -> None:
    """
    Create or update a contact record.
    Caller is responsible for passing the resolved (non-merged) contact_id via _resolve_contact_id.
    """
    cid = data.get('contact_id')
    if not cid:
        return

    existing = await db.contacts.find_one({"contact_id": cid}, {"_id": 0})
    now_str = dt_to_str(now)

    if existing:
        update: dict = {"updated_at": now_str}
        for field in ['name', 'email', 'phone', 'first_name', 'last_name', 'session_id']:
            if data.get(field):
                update[field] = data[field]
        if client_ip and not existing.get('client_ip'):
            update['client_ip'] = client_ip
        if data.get('attribution'):
            existing_attr = existing.get('attribution')
            if not existing_attr or not isinstance(existing_attr, dict):
                built = safe_attribution(data['attribution'])
                if built:
                    update['attribution'] = strip_nulls(built.model_dump())
            else:
                for k, v in data['attribution'].items():
                    if k == 'extra' and isinstance(v, dict):
                        existing_extra = existing_attr.get('extra')
                        new_extra = {ek: str(ev)[:500] for ek, ev in v.items()
                                     if ev and (not isinstance(existing_extra, dict) or not existing_extra.get(ek))}
                        if new_extra:
                            if not isinstance(existing_extra, dict):
                                update['attribution.extra'] = new_extra
                            else:
                                for ek, ev in new_extra.items():
                                    update[f'attribution.extra.{ek}'] = ev
                    elif v and not existing_attr.get(k):
                        update[f'attribution.{k}'] = v
        await db.contacts.update_one({"contact_id": cid}, {"$set": update})
    else:
        # Only create a new contact if it has identity OR meaningful attribution.
        # Pure anonymous page loads (no UTMs, no email) are skipped -- their visits
        # are still logged in page_visits and will be attached once identified.
        has_identity = any(data.get(f) for f in ['name', 'email', 'phone', 'first_name', 'last_name'])
        raw_attr = data.get('attribution') or {}
        attr_signal_fields = {
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'utm_id', 'campaign_id', 'adset_id', 'ad_id',
            'fbclid', 'gclid', 'ttclid', 'source_link_tag', 'fb_ad_set_id', 'google_campaign_id'
        }
        has_attribution = any(raw_attr.get(k) for k in attr_signal_fields)
        # Also allow contacts that carry URL extra params (e.g. ?layout=styled-0 from joinnow.live).
        # These are legitimate iframe visitors who need a document so IP-based stitching can
        # later merge them with the attribution-rich landing-page contact.
        has_extra = isinstance(raw_attr.get('extra'), dict) and bool(raw_attr.get('extra'))
        if not has_identity and not has_attribution and not has_extra:
            return  # skip truly blank page loads (no info whatsoever)

        contact = Contact(
            contact_id=cid,
            session_id=data.get('session_id'),
            client_ip=client_ip,
            name=data.get('name'),
            email=data.get('email'),
            phone=data.get('phone'),
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            attribution=safe_attribution(data.get('attribution')),
            created_at=now,
            updated_at=now
        )
        cdoc = strip_nulls(contact.model_dump())
        cdoc['created_at'] = dt_to_str(contact.created_at)
        cdoc['updated_at'] = dt_to_str(contact.updated_at)
        await db.contacts.insert_one(cdoc)


async def _log_visit(contact_id: str, session_id: Optional[str],
                     current_url: str, referrer_url: Optional[str],
                     page_title: Optional[str], attribution: Optional[dict],
                     now: datetime, client_ip: Optional[str] = None) -> str:
    visit = PageVisit(
        contact_id=contact_id,
        session_id=session_id,
        client_ip=client_ip,
        current_url=current_url,
        referrer_url=referrer_url,
        page_title=page_title,
        attribution=safe_attribution(attribution),
        timestamp=now
    )
    vdoc = strip_nulls(visit.model_dump())
    vdoc['timestamp'] = dt_to_str(visit.timestamp)
    await db.page_visits.insert_one(vdoc)
    return visit.id


async def _do_stitch(parent_id: str, child_id: str, now: datetime) -> dict:
    """
    Merge child_contact into parent_contact:
    1. Copy email/phone/name from child → parent (if parent missing them)
    2. Reassign all child page_visits → parent contact_id
    3. Copy child attribution → parent (if parent missing it)
    4. Mark child as merged_into parent
    """
    if parent_id == child_id:
        return {"status": "same", "contact_id": parent_id}

    parent = await db.contacts.find_one({"contact_id": parent_id}, {"_id": 0})
    child  = await db.contacts.find_one({"contact_id": child_id},  {"_id": 0})

    if not parent or not child:
        return {"status": "not_found"}

    # Already merged into the CORRECT parent -- idempotent
    if child.get('merged_into') == parent_id:
        return {"status": "already_merged", "merged_into": parent_id}

    # Already merged into a DIFFERENT parent -- un-merge first, then re-merge
    if child.get('merged_into') and child.get('merged_into') != parent_id:
        old_parent_id = child['merged_into']
        logger.info(f"Re-stitching: removing {child_id} from {old_parent_id}, adding to {parent_id}")
        # Remove child from old parent's merged_children list
        await db.contacts.update_one(
            {"contact_id": old_parent_id},
            {"$pull": {"merged_children": child_id}}
        )
        # Re-assign visits back to child temporarily (will be moved to new parent below)
        await db.page_visits.update_many(
            {"contact_id": old_parent_id, "original_contact_id": child_id},
            {"$set": {"contact_id": child_id}}
        )
        # Clear merged_into so _do_stitch can proceed
        await db.contacts.update_one(
            {"contact_id": child_id},
            {"$unset": {"merged_into": ""}}
        )

    now_str = dt_to_str(now)

    # Build update for parent: pull fields from child where parent is empty
    parent_update: dict = {"updated_at": now_str}
    for field in ['name', 'email', 'phone', 'first_name', 'last_name', 'session_id', 'client_ip']:
        if child.get(field) and not parent.get(field):
            parent_update[field] = child[field]

    # Merge attribution: copy child attrs where parent attrs are empty
    child_attr  = child.get('attribution') or {}
    parent_attr = parent.get('attribution') or {}
    if isinstance(child_attr, dict) and child_attr:
        if not parent_attr or not isinstance(parent_attr, dict):
            # Parent has no attribution -- set the whole child attribution at once
            built = safe_attribution(child_attr)
            if built:
                parent_update['attribution'] = strip_nulls(built.model_dump())
        else:
            # Parent already has attribution -- patch missing fields individually
            for k, v in child_attr.items():
                if k == 'extra' and isinstance(v, dict):
                    existing_extra = parent_attr.get('extra')
                    new_extra = {ek: str(ev)[:500] for ek, ev in v.items()
                                 if ev and (not isinstance(existing_extra, dict) or not existing_extra.get(ek))}
                    if new_extra:
                        if not isinstance(existing_extra, dict):
                            # extra is null -- set whole object, not individual sub-fields
                            parent_update['attribution.extra'] = new_extra
                        else:
                            for ek, ev in new_extra.items():
                                parent_update[f'attribution.extra.{ek}'] = ev
                elif v and not parent_attr.get(k):
                    parent_update[f'attribution.{k}'] = v

    # Track merged children
    existing_children = parent.get('merged_children') or []
    if child_id not in existing_children:
        existing_children.append(child_id)
    parent_update['merged_children'] = existing_children

    await db.contacts.update_one({"contact_id": parent_id}, {"$set": parent_update})

    # Reassign all child visits → parent
    await db.page_visits.update_many(
        {"contact_id": child_id},
        {"$set": {"contact_id": parent_id, "original_contact_id": child_id}}
    )

    # Mark child as merged
    await db.contacts.update_one(
        {"contact_id": child_id},
        {"$set": {"merged_into": parent_id, "updated_at": now_str}}
    )

    logger.info(f"Stitched {child_id} → {parent_id}")
    return {"status": "stitched", "parent_contact_id": parent_id, "child_contact_id": child_id}


async def _session_auto_stitch(contact_id: str, session_id: Optional[str], now: datetime) -> None:
    """
    Stitch all contacts sharing the same session_id.
    Session ID is explicitly shared via postMessage between parent page and iframes,
    making it the strongest possible signal that two contacts are the same person.
    """
    if not session_id:
        return

    contacts = await db.contacts.find({
        "session_id": session_id,
        "contact_id": {"$ne": contact_id},
        "merged_into": None,
    }, {"_id": 0}).to_list(20)

    if not contacts:
        return

    current = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
    if not current or current.get('merged_into'):
        return

    def has_attribution(c):
        attr = c.get('attribution') or {}
        return any(v for k, v in attr.items() if k not in ('extra',) and v)

    def has_identity(c):
        return bool(c.get('email') or c.get('phone') or c.get('name'))

    for candidate in contacts:
        c_attr    = has_attribution(current)
        cand_attr = has_attribution(candidate)
        c_ident   = has_identity(current)
        cand_ident = has_identity(candidate)

        # Determine which is parent (prefer attribution-rich, then identity-rich, then older)
        if c_attr and not cand_attr:
            await _do_stitch(contact_id, candidate['contact_id'], now)
        elif cand_attr and not c_attr:
            await _do_stitch(candidate['contact_id'], contact_id, now)
        elif c_ident and not cand_ident:
            # current has identity, candidate doesn't -- current is parent
            await _do_stitch(contact_id, candidate['contact_id'], now)
        elif cand_ident and not c_ident:
            await _do_stitch(candidate['contact_id'], contact_id, now)
        else:
            # Both have similar data -- merge newer into older
            c_time   = current.get('created_at') or ''
            cand_time = candidate.get('created_at') or ''
            if c_time <= cand_time:
                await _do_stitch(contact_id, candidate['contact_id'], now)
            else:
                await _do_stitch(candidate['contact_id'], contact_id, now)

        # Refresh current after stitch in case it was merged
        current = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
        if not current or current.get('merged_into'):
            break


async def _ip_auto_stitch(contact_id: str, client_ip: Optional[str], now: datetime) -> None:
    """
    Auto-stitch contacts that share the same IP within a 30-minute window.

    Two stitching rules (in priority order):
    1. Identity cross-match  -- one side has attribution AND the other has email/phone.
    2. Iframe companion rule -- one side has REAL attribution (UTMs/click-IDs) AND the
       other is completely anonymous (no real attribution, no identity).
       This handles the common pattern where drshumardworkshop.com/register (landing page
       with FB attribution) loads joinnow.live/embed/... as an iframe.  The iframe contact
       has no UTMs (only possibly an extra param like ?layout=...) but is provably the same
       person because (a) joinnow is only reachable as an iframe on drshumardworkshop, and
       (b) they share the same IP with sub-minute timing.
    """
    if not client_ip:
        return

    window_start = dt_to_str(now - timedelta(minutes=30))
    candidates = await db.contacts.find({
        "client_ip": client_ip,
        "contact_id": {"$ne": contact_id},
        "merged_into": None,
        "created_at": {"$gte": window_start}
    }, {"_id": 0}).to_list(10)

    if not candidates:
        return

    current = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
    if not current or current.get('merged_into'):
        return

    def has_real_attribution(c):
        """True only when there are actual UTM/click-ID signals (excludes extra)."""
        attr = c.get('attribution') or {}
        return any(v for k, v in attr.items() if k not in ('extra',) and v)

    def has_identity(c):
        return bool(c.get('email') or c.get('phone'))

    c_attr  = has_real_attribution(current)
    c_ident = has_identity(current)

    for candidate in candidates:
        cand_attr  = has_real_attribution(candidate)
        cand_ident = has_identity(candidate)

        # ── Rule 1: attribution ↔ identity cross-match ──────────────────────────
        if c_attr and cand_ident and not c_ident and not cand_attr:
            await _do_stitch(contact_id, candidate['contact_id'], now)
            break
        elif cand_attr and c_ident and not c_attr and not cand_ident:
            await _do_stitch(candidate['contact_id'], contact_id, now)
            break

        # ── Rule 2: iframe companion -- attribution-rich + completely anonymous ──
        # The anonymous side has no real UTMs and no identity (likely an iframe
        # companion).  Since joinnow.live is only accessible as an iframe on the
        # landing page, sharing an IP is definitive proof they're the same person.
        elif c_attr and not cand_attr and not cand_ident:
            await _do_stitch(contact_id, candidate['contact_id'], now)
            break
        elif cand_attr and not c_attr and not c_ident:
            await _do_stitch(candidate['contact_id'], contact_id, now)
            break



# ─────────────────────────── Automation Engine ───────────────────────────

def _get_contact_field(contact: dict, field: str) -> Any:
    attr_fields = {
        'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
        'utm_id','campaign_id','adset_id','ad_id',
        'fbclid','gclid','ttclid','source_link_tag','fb_ad_set_id','google_campaign_id',
    }
    if field in attr_fields:
        return (contact.get('attribution') or {}).get(field)
    return contact.get(field)


def _evaluate_filters(contact: dict, filters: list) -> bool:
    for f in filters:
        field    = f.get('field','') if isinstance(f,dict) else getattr(f,'field','')
        operator = f.get('operator','exists') if isinstance(f,dict) else getattr(f,'operator','exists')
        value    = f.get('value') if isinstance(f,dict) else getattr(f,'value',None)
        val      = _get_contact_field(contact, field)
        vs, cs   = str(val or '').lower(), str(value or '').lower()
        if operator == 'exists'     and not val:     return False
        if operator == 'not_exists' and val:         return False
        if operator == 'equals'     and vs != cs:    return False
        if operator == 'not_equals' and vs == cs:    return False
        if operator == 'contains'   and cs not in vs: return False
    return True


def _build_webhook_payload(contact: dict, field_map: list) -> dict:
    attr = contact.get('attribution') or {}
    src = {
        'email': contact.get('email'), 'name': contact.get('name'),
        'first_name': contact.get('first_name'), 'last_name': contact.get('last_name'),
        'phone': contact.get('phone'), 'contact_id': contact.get('contact_id'),
        'client_ip': contact.get('client_ip'),
        'created_at': dt_to_str(contact.get('created_at')),
        'updated_at': dt_to_str(contact.get('updated_at')),
        'utm_source': attr.get('utm_source'), 'utm_medium': attr.get('utm_medium'),
        'utm_campaign': attr.get('utm_campaign'), 'utm_term': attr.get('utm_term'),
        'utm_content': attr.get('utm_content'), 'utm_id': attr.get('utm_id'),
        'campaign_id': attr.get('campaign_id'), 'adset_id': attr.get('adset_id'),
        'ad_id': attr.get('ad_id'), 'fbclid': attr.get('fbclid'),
    }
    if not field_map:
        return {k: v for k, v in src.items() if v is not None}
    payload = {}
    for m in field_map:
        s = m.get('source') if isinstance(m,dict) else getattr(m,'source','')
        t = (m.get('target') if isinstance(m,dict) else getattr(m,'target','')) or s
        if s in src: payload[t] = src[s]
    return payload


async def _fire_webhook_task(
    auto_id: str, url: str, payload: dict, headers: dict,
    run_type: str = "live", contact: Optional[dict] = None
) -> None:
    """Fire a webhook, persist the run record, and update automation stats."""
    import time
    start       = time.monotonic()
    http_status = None
    response_body = None
    success     = False
    error_msg   = None

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.post(url, json=payload, headers=headers)
            http_status   = resp.status_code
            raw_text      = resp.text.strip() if resp.text else ''
            response_body = raw_text[:2000] if raw_text else None
            success       = 200 <= resp.status_code < 300
            logger.info(f"Automation {auto_id[:8]} [{run_type}] -> HTTP {resp.status_code}")
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Automation {auto_id[:8]} webhook error: {e}")

    duration_ms = round((time.monotonic() - start) * 1000)
    now         = datetime.now(timezone.utc)

    run_doc = {
        "id":            str(uuid.uuid4()),
        "automation_id": auto_id,
        "run_type":      run_type,
        "contact_id":    contact.get("contact_id")  if contact else None,
        "contact_email": contact.get("email")        if contact else None,
        "contact_name":  contact.get("name")         if contact else None,
        "payload":       payload,
        "webhook_url":   url,
        "http_status":   http_status,
        "response_body": response_body,
        "success":       success,
        "error":         error_msg,
        "duration_ms":   duration_ms,
        "triggered_at":  dt_to_str(now),
    }
    await db.automation_runs.insert_one(run_doc)

    # Update automation stats (only count live runs toward trigger_count)
    stat_update: dict = {"last_triggered_at": dt_to_str(now)}
    if run_type == "live":
        await db.automations.update_one(
            {"id": auto_id},
            {"$set": stat_update, "$inc": {"trigger_count": 1}}
        )
    else:
        await db.automations.update_one({"id": auto_id}, {"$set": stat_update})


async def _run_automations(contact_id: str) -> None:
    contact = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
    if not contact or not (contact.get('email') or contact.get('phone')):
        return
    automations = await db.automations.find({"enabled": True}, {"_id": 0}).to_list(100)
    for auto in automations:
        try:
            if not _evaluate_filters(contact, auto.get('filters', [])):
                continue
            payload = _build_webhook_payload(contact, auto.get('field_map', []))
            hdrs = {"Content-Type": "application/json"}
            if auto.get('custom_headers'):
                hdrs.update(auto['custom_headers'])
            asyncio.create_task(
                _fire_webhook_task(auto['id'], auto['webhook_url'], payload, hdrs,
                                   run_type="live", contact=contact)
            )
        except Exception as e:
            logger.error(f"Automation eval error {auto.get('id','?')}: {e}")


# ─────────────────────────── Tracker JS ───────────────────────────

def build_tracker_js(backend_url: str) -> str:
    return r"""/**
 * Shumard - Lead Attribution & Cross-Frame Identity Script
 * Architecture: Hyros-style field capture + postMessage cross-frame stitching
 */
(function () {
  'use strict';

  var BACKEND_URL = '""" + backend_url + r"""';
  var API_BASE    = BACKEND_URL + '/api';

  /* ─── Central store ─── */
  var store = {
    lead: { email: '', phone: '', firstName: '', lastName: '', name: '' },
    source: {
      utm_source: '', utm_medium: '', utm_campaign: '', utm_term: '', utm_content: '',
      utm_id: '', campaign_id: '', adset_id: '', ad_id: '',
      fbclid: '', gclid: '', ttclid: '', source_link_tag: '', fb_ad_set_id: '', google_campaign_id: '',
      extra: {}
    },
    config: {
      contactId:      '',
      sessionId:      '',
      parentContactId: '',   // set when running inside an iframe and parent sends its ID
      isIframe:       false,
      prevUrl:        document.referrer || '',
      currentUrl:     window.location.href,
      pageTitle:      document.title || ''
    },
    processedData: { emailSent: false, phoneSent: false, pageSent: false }
  };

  /* ─── Detect iframe context ─── */
  try { store.config.isIframe = window.self !== window.top; } catch (e) { store.config.isIframe = true; }

  /* ─── Storage helpers ─── */
  var LS_KEY   = 'st_contact_id';
  var SESS_KEY = 'st_session_id';
  var ATTR_KEY = 'st_attribution';

  function setCookie(name, value, days) {
    try {
      var exp = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + exp + '; path=/; SameSite=None; Secure';
    } catch (e) {}
  }

  function getCookie(name) {
    try {
      var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      return v ? decodeURIComponent(v.pop()) : null;
    } catch (e) { return null; }
  }

  function lsGet(key) {
    try { return localStorage.getItem(key) || getCookie(key); } catch (e) { return getCookie(key); }
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
    setCookie(key, value, 365);
  }

  function ssGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function ssSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) {}
  }

  /* ─── UUID ─── */
  function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ─── contact_id: persistent per-device per-domain ─── */
  function getContactId() {
    var id = lsGet(LS_KEY);
    if (!id) { id = genUUID(); lsSet(LS_KEY, id); }
    return id;
  }

  /*
   * ─── session_id: shared across parent + iframe within ONE tab ───
   *
   * Strategy:
   *  • Parent creates session_id and stores in sessionStorage
   *  • Parent broadcasts it to all child iframes via postMessage
   *  • iframe receives and uses the SAME session_id
   *  • Backend can stitch contacts sharing the same session_id
   */
  function initSessionId() {
    // If iframe, wait for parent to send us the session_id via postMessage
    // Fallback: generate our own (will be replaced when postMessage arrives)
    var sid = ssGet(SESS_KEY) || lsGet(SESS_KEY);
    if (!sid) { sid = genUUID(); }
    ssSet(SESS_KEY, sid);
    return sid;
  }

  /* ─── URL param parser ─── */
  function getUrlParams(url) {
    try {
      var search = (url || window.location.href).split('?')[1] || '';
      var result = {};
      search.replace(/#.*$/, '').split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0]) result[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      });
      return result;
    } catch (e) { return {}; }
  }

  /* ─── Attribution capture ─── */
  function captureAttribution() {
    var cached = lsGet(ATTR_KEY);
    if (cached) {
      try {
        Object.assign(store.source, JSON.parse(cached));
        var hasCached = Object.keys(store.source).some(function(k){ return k !== 'extra' && !!store.source[k]; });
        return;
      } catch (e) {}
    }
    var p = getUrlParams();
    /* Known field map: target_key → list of URL param names that map to it */
    var map = {
      utm_source:         ['utm_source'],
      utm_medium:         ['utm_medium'],
      utm_campaign:       ['utm_campaign'],
      utm_term:           ['utm_term'],
      utm_content:        ['utm_content'],
      utm_id:             ['utm_id'],
      campaign_id:        ['campaign_id'],
      adset_id:           ['adset_id'],
      ad_id:              ['ad_id'],
      fbclid:             ['fbclid', 'fb_cl_id'],
      gclid:              ['gclid', 'g_cl_id'],
      ttclid:             ['ttclid'],
      source_link_tag:    ['sl'],
      fb_ad_set_id:       ['fbc_id', 'h_ad_id', 'fbadid'],
      google_campaign_id: ['gc_id', 'h_campaign_id']
    };

    /* Build a set of ALL URL param names that are already handled by the map */
    var handledParams = {};
    Object.keys(map).forEach(function(key) {
      map[key].forEach(function(param) { handledParams[param] = true; });
    });

    var found = false;

    /* Match known params */
    Object.keys(map).forEach(function(key) {
      map[key].forEach(function(param) {
        if (p[param]) { store.source[key] = p[param]; found = true; }
      });
    });

    /* Capture EVERY remaining unknown param into extra */
    var extra = {};
    Object.keys(p).forEach(function(param) {
      if (!handledParams[param] && p[param]) {
        extra[param] = p[param];
        found = true;
      }
    });
    if (Object.keys(extra).length > 0) {
      store.source.extra = extra;
    }

    if (found) {
      lsSet(ATTR_KEY, JSON.stringify(store.source));
    }
  }

  /* ─── Network ─── */
  function send(endpoint, payload) {
    var url  = API_BASE + endpoint;
    var body = JSON.stringify(payload);
    var hdrs = { 'Content-Type': 'application/json' };
    if (typeof fetch !== 'undefined') {
      try { fetch(url, { method: 'POST', headers: hdrs, body: body, keepalive: true }).catch(function () { xhrSend(url, body); }); return; }
      catch (e) {}
    }
    xhrSend(url, body);
  }

  function xhrSend(url, body) {
    try { var x = new XMLHttpRequest(); x.open('POST', url, true); x.setRequestHeader('Content-Type', 'application/json'); x.send(body); }
    catch (e) {}
  }

  /* ─── Common payload ─── */
  function buildPayload(extra) {
    return Object.assign({
      contact_id:   store.config.contactId,
      session_id:   store.config.sessionId || null,
      current_url:  window.location.href,
      referrer_url: store.config.prevUrl || null,
      page_title:   document.title || null,
      attribution:  store.source
    }, extra || {});
  }

  /* ─── Tracking calls ─── */
  function sendPageview() {
    if (store.processedData.pageSent) return;
    store.processedData.pageSent = true;
    send('/track/pageview', buildPayload());
  }

  function sendLead(fields) {
    var email = fields && fields.email;
    var phone = fields && fields.phone;
    if (email || phone) {
      var parts = [];
      if (email) parts.push('email: ' + email);
      if (phone) parts.push('phone: ' + phone);
      logger('Contact captured -- ' + parts.join(' | '));
    }
    send('/track/lead', buildPayload(fields));
  }

  function sendRegistration(fields) {
    var parts = [];
    if (fields && fields.email) parts.push('email: ' + fields.email);
    if (fields && fields.phone) parts.push('phone: ' + fields.phone);
    if (fields && fields.name)  parts.push('name: ' + fields.name);
    if (parts.length) logger('Contact captured -- ' + parts.join(' | '));
    send('/track/registration', buildPayload(fields));
  }

  /* ─── Stitch is now backend-only -- function kept as no-op for public API compat ─── */
  function sendStitch() { /* backend handles all stitching via session_id */ }

  function logger(msg, data) {
    try {
      if (data !== undefined) {
        console.log('%c[Shumard]%c ' + msg, 'color:#15b8c8;font-weight:bold', 'color:inherit', data);
      } else {
        console.log('%c[Shumard]%c ' + msg, 'color:#15b8c8;font-weight:bold', 'color:inherit');
      }
    } catch(e) {}
  }

  /* ═══════════════════════════════════════════════════════════════
     CROSS-FRAME IDENTITY STITCHING (postMessage bridge)
     ═══════════════════════════════════════════════════════════════

     HOW IT WORKS:
     1. Parent page broadcasts {type:'st_parent_id', contactId, sessionId} to ALL iframes
     2. iframe receives this, records parentContactId, updates its session_id,
        fires stitch API, and replies with its own contactId
     3. Parent receives child reply and fires stitch API as a double-confirm

     This ensures BOTH ends initiate the stitch even if one message is dropped.
  */

  /* ─── Parent: broadcast identity to all child iframes ─── */
  function broadcastToIframes() {
    if (store.config.isIframe) return; // don't re-broadcast from iframes
    var frames = document.querySelectorAll('iframe');
    if (!frames.length) return;
    var msg = {
      type:      'st_parent_id',
      contactId: store.config.contactId,
      sessionId: store.config.sessionId,
      version:   '2'
    };
    frames.forEach(function (f) {
      try { f.contentWindow.postMessage(msg, '*'); } catch (e) {}
    });
  }

  /* ─── Handle incoming postMessages ─── */
  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;

    /*
     * iframe receives parent session_id -- adopt it so the backend can stitch
     * the two contacts together via _session_auto_stitch when a lead/registration
     * comes in.  No HTTP request is made here; stitching is purely backend-driven.
     */
    if (e.data.type === 'st_parent_id' && store.config.isIframe) {
      var parentSess = e.data.sessionId;
      if (parentSess && parentSess !== store.config.sessionId) {
        store.config.sessionId = parentSess;
        ssSet(SESS_KEY, parentSess);
      }
    }

    /* Capture form data posted by webinar platform iframes */
    if (e.data.type === 'registration' || e.data.type === 'webinar_registration') {
      var d = e.data.data || e.data;
      if (d.email) sendLead({ email: d.email, name: d.name || null, phone: d.phone || null });
    }
  });

  /* ─── Field detection ─── */
  var CLASSES = {
    email:     ['st-email', 'hyros-email'],
    firstName: ['st-first-name', 'hyros-first-name'],
    lastName:  ['st-last-name', 'hyros-last-name'],
    phone:     ['st-phone', 'hyros-phone', 'st-telephone']
  };
  var ATTR_NAMES = {
    email:     ['email', 'Email', 'EMAIL', 'user_email', 'subscriber_email', 'attendee_email', 'email_address', 'emailaddress', 'your-email', 'contact_email'],
    firstName: ['first_name', 'firstname', 'fname', 'first-name', 'FirstName'],
    lastName:  ['last_name', 'lastname', 'lname', 'last-name', 'LastName'],
    name:      ['full_name', 'fullname', 'name', 'Name', 'contact_name', 'your-name', 'attendee_name', 'participant_name'],
    phone:     ['phone', 'Phone', 'PHONE', 'telephone', 'mobile', 'cell', 'phone_number', 'attendee_phone', 'phonenumber', 'your-phone', 'contact_phone', 'mobilephone']
  };

  function hasClass(el, cls) { for (var i = 0; i < cls.length; i++) { if (el.classList && el.classList.contains(cls[i])) return true; } return false; }
  function matchAttr(el, names) {
    var n = (el.name||'').toLowerCase(), id = (el.id||'').toLowerCase(), ph = (el.placeholder||'').toLowerCase(), da = (el.getAttribute('data-field')||'').toLowerCase();
    for (var i = 0; i < names.length; i++) { var nm = names[i].toLowerCase(); if (n===nm||id===nm||ph.indexOf(nm)!==-1||da===nm) return true; }
    return false;
  }
  function classifyInput(el) {
    if (!el || !el.tagName) return null;
    var tag = el.tagName.toUpperCase(), type = (el.type||'').toLowerCase(), im = (el.getAttribute('inputmode')||'').toLowerCase();
    if (tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT') return null;
    if (hasClass(el, CLASSES.email))     return 'email';
    if (hasClass(el, CLASSES.firstName)) return 'firstName';
    if (hasClass(el, CLASSES.lastName))  return 'lastName';
    if (hasClass(el, CLASSES.phone))     return 'phone';
    if (type==='email') return 'email';
    if (type==='tel'||im==='tel'||im==='numeric') return 'phone';
    if (matchAttr(el, ATTR_NAMES.email))     return 'email';
    if (matchAttr(el, ATTR_NAMES.phone))     return 'phone';
    if (matchAttr(el, ATTR_NAMES.firstName)) return 'firstName';
    if (matchAttr(el, ATTR_NAMES.lastName))  return 'lastName';
    if (matchAttr(el, ATTR_NAMES.name))      return 'name';
    return null;
  }

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v||'').trim()); }
  function isPhone(v) { return /^[+\d][\d\s\-().]{6,19}$/.test((v||'').trim()); }

  /* ─── Field change handler ─── */
  function handleFieldChange(el) {
    var ft = classifyInput(el); if (!ft) return;
    var val = (el.value||'').trim(); if (!val) return;

    /* Helper: build name from whatever is already stored */
    function storedName() {
      return store.lead.name || ((store.lead.firstName+' '+store.lead.lastName).trim()) || null;
    }

    if (ft==='email' && isEmail(val) && val!==store.lead.email) {
      store.lead.email = val;
      var p = { email: val };
      var n = storedName(); if (n) p.name = n;
      if (store.lead.firstName) p.first_name = store.lead.firstName;
      if (store.lead.lastName)  p.last_name  = store.lead.lastName;
      sendLead(p);
    }
    else if (ft==='phone' && isPhone(val) && val!==store.lead.phone) {
      store.lead.phone = val;
      var pp = { phone: val };
      if (store.lead.email) pp.email = store.lead.email;
      var pn = storedName(); if (pn) pp.name = pn;
      sendLead(pp);
    }
    else if (ft==='firstName') {
      store.lead.firstName = val;
      if (store.lead.email || store.lead.phone)
        sendLead({ email: store.lead.email||null, phone: store.lead.phone||null, first_name: val, name: storedName() });
    }
    else if (ft==='lastName') {
      store.lead.lastName = val;
      if (store.lead.email || store.lead.phone)
        sendLead({ email: store.lead.email||null, phone: store.lead.phone||null, last_name: val, name: storedName() });
    }
    else if (ft==='name') {
      store.lead.name = val;
      if (store.lead.email || store.lead.phone)
        sendLead({ email: store.lead.email||null, phone: store.lead.phone||null, name: val });
    }
  }

  /* ─── Form submit ─── */
  function handleFormSubmit(form) {
    form.querySelectorAll('input, textarea, select').forEach(function (el) {
      var ft=classifyInput(el), v=(el.value||'').trim(); if (!ft||!v) return;
      if (ft==='email'&&isEmail(v))     store.lead.email=v;
      if (ft==='phone'&&isPhone(v))     store.lead.phone=v;
      if (ft==='firstName')             store.lead.firstName=v;
      if (ft==='lastName')              store.lead.lastName=v;
      if (ft==='name')                  store.lead.name=v;
    });
    if (!store.lead.email && !store.lead.phone) return;
    var fullName = store.lead.name || ((store.lead.firstName+' '+store.lead.lastName).trim()) || null;
    sendRegistration({ email:store.lead.email||null, phone:store.lead.phone||null, name:fullName, first_name:store.lead.firstName||null, last_name:store.lead.lastName||null });
  }

  /* ─── Form binding ─── */
  function bindInputListeners(form) {
    if (!form||form._st_inputs_bound) return; form._st_inputs_bound=true;
    form.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (el._st_bound) return; el._st_bound=true;
      el.addEventListener('change', function(){handleFieldChange(el);}, true);
      el.addEventListener('blur',   function(){handleFieldChange(el);}, true);
    });
  }
  function bindSubmitListener(form) {
    if (!form||form._st_submit_bound) return; form._st_submit_bound=true;
    form.addEventListener('submit', function(){setTimeout(function(){handleFormSubmit(form);},0);}, true);
  }
  function bindForms() { document.querySelectorAll('form').forEach(function(f){bindInputListeners(f);bindSubmitListener(f);}); }
  function bindLooseInputs() {
    document.querySelectorAll('input, textarea').forEach(function(el){
      if (el.form||el._st_bound) return; el._st_bound=true;
      el.addEventListener('change', function(){handleFieldChange(el);}, true);
      el.addEventListener('blur',   function(){handleFieldChange(el);}, true);
    });
  }

  /* ─── Click capture for SPA submit buttons ─── */
  document.addEventListener('click', function(e) {
    var el=e.target;
    for (var i=0;i<5&&el;i++,el=el.parentElement) {
      var tag=(el.tagName||'').toUpperCase(), type=(el.type||'').toLowerCase();
      if ((tag==='BUTTON'&&(type==='submit'||!el.type||type==='button'))||(tag==='INPUT'&&type==='submit')) {
        var form=el.closest('form');
        if (form) { setTimeout(function(){handleFormSubmit(form);},100); } break;
      }
    }
  }, {capture:true, passive:true});

  /* ─── MutationObserver ─── */
  var _obs=null;
  function watchDOM() {
    if (_obs||!window.MutationObserver) return;
    _obs=new MutationObserver(function(){bindForms();bindLooseInputs();});
    _obs.observe(document.body,{childList:true,subtree:true});
  }

  /* ─── Custom event ─── */
  window.addEventListener('stealthtrack_email', function(e){
    var em=e.detail&&e.detail.email;
    if (em&&isEmail(em)&&em!==store.lead.email){store.lead.email=em;sendLead({email:em});}
  });

  /* ─── SPA URL change detection ─── */
  (function(){
    var lastUrl=window.location.href;
    setInterval(function(){
      var cur=window.location.href;
      if (cur!==lastUrl){
        lastUrl=cur; store.config.prevUrl=store.config.currentUrl; store.config.currentUrl=cur;
        store.processedData.pageSent=false; sendPageview(); bindForms(); bindLooseInputs();
      }
    }, 800);
  })();

  /* ─── Init ─── */
  function init() {
    store.config.contactId = getContactId();
    store.config.sessionId = initSessionId();
    captureAttribution();
    bindForms();
    bindLooseInputs();
    watchDOM();
    sendPageview();
    /* Parent page: start broadcasting identity to iframes */
    if (!store.config.isIframe) {
      /* Broadcast immediately after DOM ready, then periodically for 30s to catch lazy iframes */
      var broadcastCount = 0;
      var broadcastInterval = setInterval(function () {
        broadcastToIframes();
        if (++broadcastCount >= 30) clearInterval(broadcastInterval);
      }, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ─── Public API ─── */
  window.Shumard = {
    getContactId:  getContactId,
    getSessionId:  function(){ return store.config.sessionId; },
    identify: function(fields){
      if (fields.email && isEmail(fields.email)){ store.lead.email=fields.email; sendLead(fields); }
    },
    stitch:    sendStitch,
    trackEvent: sendLead,
    store:     store
  };

})();
"""


# ─────────────────────────── Routes ───────────────────────────

@api_router.get("/")
async def root():
    return {"message": "StealthTrack API", "status": "running"}


@api_router.get("/shumard.js", response_class=PlainTextResponse)
async def get_shumard_js():
    backend_url = os.environ.get('REACT_APP_BACKEND_URL', '')
    return PlainTextResponse(
        content=build_tracker_js(backend_url),
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Access-Control-Allow-Origin": "*"}
    )


@api_router.post("/track/pageview")
async def track_pageview(data: PageViewCreate, request: Request):
    try:
        now = datetime.now(timezone.utc)
        ip  = get_client_ip(request)
        # Always resolve the effective (non-merged) contact_id before any operation
        eid = await _resolve_contact_id(data.contact_id)
        await _upsert_contact({'contact_id': eid, 'session_id': data.session_id, 'attribution': data.attribution}, now, ip)
        vid = await _log_visit(eid, data.session_id, data.current_url, data.referrer_url, data.page_title, data.attribution, now, ip)
        await _ip_auto_stitch(eid, ip, now)
        return {"status": "ok", "visit_id": vid, "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking pageview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track/lead")
async def track_lead(data: LeadCreate, request: Request):
    try:
        now = datetime.now(timezone.utc)
        ip  = get_client_ip(request)
        eid = await _resolve_contact_id(data.contact_id)
        await _upsert_contact({
            'contact_id': eid, 'session_id': data.session_id,
            'email': data.email, 'phone': data.phone, 'name': data.name,
            'first_name': data.first_name, 'last_name': data.last_name,
            'attribution': data.attribution
        }, now, ip)
        await _session_auto_stitch(eid, data.session_id, now)
        await _ip_auto_stitch(eid, ip, now)
        asyncio.create_task(_run_automations(eid))
        return {"status": "ok", "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track/registration")
async def track_registration(data: RegistrationCreate, request: Request):
    try:
        now = datetime.now(timezone.utc)
        ip  = get_client_ip(request)
        eid = await _resolve_contact_id(data.contact_id)
        await _upsert_contact({
            'contact_id': eid, 'session_id': data.session_id,
            'email': data.email, 'phone': data.phone, 'name': data.name,
            'first_name': data.first_name, 'last_name': data.last_name,
            'attribution': data.attribution
        }, now, ip)
        if data.current_url:
            await _log_visit(eid, data.session_id, data.current_url, data.referrer_url, data.page_title or "Registration", data.attribution, now, ip)
        await _session_auto_stitch(eid, data.session_id, now)
        await _ip_auto_stitch(eid, ip, now)
        asyncio.create_task(_run_automations(eid))
        return {"status": "ok", "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking registration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track/stitch")
async def track_stitch(data: StitchRequest, request: Request):
    """
    Merge child contact into parent contact.
    Called by tracker.js when postMessage bridge identifies both sides of a session.
    """
    try:
        now = datetime.now(timezone.utc)
        result = await _do_stitch(data.parent_contact_id, data.child_contact_id, now)
        return result
    except Exception as e:
        logger.error(f"Error stitching: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track/stitch/by-session")
async def stitch_by_session(session_id: str):
    """Stitch all contacts sharing the same session_id."""
    try:
        now = datetime.now(timezone.utc)
        contacts = await db.contacts.find({"session_id": session_id, "merged_into": None}, {"_id": 0}).sort("created_at", 1).to_list(20)
        if len(contacts) < 2:
            return {"status": "nothing_to_stitch", "count": len(contacts)}

        # First contact becomes the parent (earliest created_at)
        parent = contacts[0]
        results = []
        for child in contacts[1:]:
            r = await _do_stitch(parent['contact_id'], child['contact_id'], now)
            results.append(r)

        return {"status": "ok", "parent_contact_id": parent['contact_id'], "stitched": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/contacts", response_model=List[ContactWithStats])
async def get_contacts(search: Optional[str] = None, include_merged: bool = False):
    try:
        query: dict = {}
        if not include_merged:
            query["merged_into"] = None   # hide merged (child) contacts
        if search:
            search_filter = {"$or": [
                {"name":  {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}}
            ]}
            query = {"$and": [query, search_filter]} if query else search_filter

        contacts_raw = await db.contacts.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)
        result = []
        for c in contacts_raw:
            fix_contact_doc(c)
            c['visit_count'] = await db.page_visits.count_documents({"contact_id": c['contact_id']})
            result.append(ContactWithStats(**c))
        return result
    except Exception as e:
        logger.error(f"Error getting contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/contacts/{contact_id}", response_model=ContactDetail)
async def get_contact_detail(contact_id: str):
    try:
        contact = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        fix_contact_doc(contact)
        visits_raw = await db.page_visits.find({"contact_id": contact_id}, {"_id": 0}).sort("timestamp", 1).to_list(500)
        contact['visits'] = [PageVisit(**fix_visit_doc(v)) for v in visits_raw]
        return ContactDetail(**contact)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contact detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/contacts/{contact_id}", status_code=204)
async def delete_contact(contact_id: str):
    try:
        result = await db.contacts.delete_one({"contact_id": contact_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Contact not found")
        # Also remove all page visits associated with this contact
        await db.page_visits.delete_many({"contact_id": contact_id})
        # If this contact was merged into a parent, remove it from the parent's merged_children list
        await db.contacts.update_many(
            {"merged_children": contact_id},
            {"$pull": {"merged_children": contact_id}}
        )
        logger.info(f"Deleted contact {contact_id}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/stats")
async def get_stats():
    try:
        total_contacts = await db.contacts.count_documents({"merged_into": None})
        total_visits   = await db.page_visits.count_documents({})
        today_start    = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_visits   = await db.page_visits.count_documents({"timestamp": {"$gte": dt_to_str(today_start)}})
        return {"total_contacts": total_contacts, "total_visits": total_visits, "today_visits": today_visits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/logs")
async def get_logs(limit: int = 200):
    """Recent activity feed: page visits enriched with contact identity."""
    try:
        visits = await db.page_visits.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)

        # Batch-fetch all relevant contacts
        contact_ids = list({v["contact_id"] for v in visits})
        contacts_raw = await db.contacts.find(
            {"contact_id": {"$in": contact_ids}},
            {"_id": 0, "contact_id": 1, "name": 1, "email": 1, "phone": 1, "merged_into": 1, "attribution": 1}
        ).to_list(len(contact_ids)) if contact_ids else []
        contact_map: dict = {c["contact_id"]: c for c in contacts_raw}

        # For merged contacts, try to resolve to the parent
        parent_ids = [c["merged_into"] for c in contacts_raw if c.get("merged_into") and c["merged_into"] not in contact_map]
        if parent_ids:
            parents = await db.contacts.find(
                {"contact_id": {"$in": parent_ids}},
                {"_id": 0, "contact_id": 1, "name": 1, "email": 1, "phone": 1}
            ).to_list(len(parent_ids))
            for p in parents:
                contact_map[p["contact_id"]] = p

        result = []
        for v in visits:
            c = contact_map.get(v["contact_id"]) or {}
            if c.get("merged_into"):
                c = contact_map.get(c["merged_into"]) or c
            attr = v.get("attribution") or {}
            result.append({
                "timestamp": dt_to_str(str_to_dt(v.get("timestamp"))),
                "contact_id": v["contact_id"],
                "contact_name": c.get("name"),
                "contact_email": c.get("email"),
                "contact_phone": c.get("phone"),
                "url": v.get("current_url"),
                "referrer": v.get("referrer_url"),
                "page_title": v.get("page_title"),
                "session_id": v.get("session_id"),
                "utm_source": attr.get("utm_source"),
                "utm_campaign": attr.get("utm_campaign"),
            })
        return result
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ─────────────────────────── Automations CRUD ───────────────────────────

@api_router.get("/automations", response_model=List[AutomationOut])
async def list_automations():
    try:
        docs = await db.automations.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
        result = []
        for d in docs:
            d['created_at'] = str_to_dt(d.get('created_at'))
            d['updated_at'] = str_to_dt(d.get('updated_at'))
            if d.get('last_triggered_at'):
                d['last_triggered_at'] = str_to_dt(d['last_triggered_at'])
            result.append(AutomationOut(**d))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/automations", response_model=AutomationOut, status_code=201)
async def create_automation(data: AutomationCreate):
    try:
        now = datetime.now(timezone.utc)
        doc = {
            "id": str(uuid.uuid4()),
            "name": data.name,
            "enabled": data.enabled,
            "webhook_url": data.webhook_url,
            "filters": [f.model_dump() for f in data.filters],
            "field_map": [m.model_dump() for m in data.field_map],
            "custom_headers": data.custom_headers or {},
            "created_at": dt_to_str(now),
            "updated_at": dt_to_str(now),
            "last_triggered_at": None,
            "trigger_count": 0,
        }
        await db.automations.insert_one(doc)
        doc['created_at'] = now
        doc['updated_at'] = now
        return AutomationOut(**doc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/automations/{auto_id}", response_model=AutomationOut)
async def update_automation(auto_id: str, data: AutomationUpdate):
    try:
        existing = await db.automations.find_one({"id": auto_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Automation not found")
        now = datetime.now(timezone.utc)
        update: dict = {"updated_at": dt_to_str(now)}
        if data.name        is not None: update["name"]           = data.name
        if data.enabled     is not None: update["enabled"]        = data.enabled
        if data.webhook_url is not None: update["webhook_url"]    = data.webhook_url
        if data.filters     is not None: update["filters"]        = [f.model_dump() for f in data.filters]
        if data.field_map   is not None: update["field_map"]      = [m.model_dump() for m in data.field_map]
        if data.custom_headers is not None: update["custom_headers"] = data.custom_headers
        await db.automations.update_one({"id": auto_id}, {"$set": update})
        doc = await db.automations.find_one({"id": auto_id}, {"_id": 0})
        doc['created_at'] = str_to_dt(doc['created_at'])
        doc['updated_at'] = str_to_dt(doc['updated_at'])
        if doc.get('last_triggered_at'):
            doc['last_triggered_at'] = str_to_dt(doc['last_triggered_at'])
        return AutomationOut(**doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/automations/{auto_id}", status_code=204)
async def delete_automation(auto_id: str):
    result = await db.automations.delete_one({"id": auto_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Automation not found")


@api_router.post("/automations/{auto_id}/test")
async def test_automation(auto_id: str):
    """Send a test payload using the most recent identified contact (or synthetic data)."""
    auto = await db.automations.find_one({"id": auto_id}, {"_id": 0})
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")

    contact = await db.contacts.find_one(
        {"merged_into": None, "$or": [
            {"email": {"$exists": True, "$ne": None}},
            {"phone": {"$exists": True, "$ne": None}}
        ]},
        {"_id": 0}
    )
    if not contact:
        contact = {
            "contact_id": "test-" + str(uuid.uuid4())[:8],
            "email": "test@example.com", "name": "Test Lead",
            "phone": "+1-555-0100",
            "attribution": {"utm_source": "facebook", "utm_campaign": "test_campaign"},
            "created_at": dt_to_str(datetime.now(timezone.utc)),
        }

    payload = _build_webhook_payload(contact, auto.get('field_map', []))
    payload['_tether_test'] = True
    hdrs = {"Content-Type": "application/json"}
    if auto.get('custom_headers'):
        hdrs.update(auto['custom_headers'])

    # Fire synchronously so we can return the full result immediately
    import time
    start         = time.monotonic()
    http_status   = None
    response_body = None
    response_hint = None   # extracted from error responses (e.g. n8n "hint" field)
    success       = False
    error_msg     = None

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.post(auto['webhook_url'], json=payload, headers=hdrs)
            http_status = resp.status_code
            raw_text    = resp.text.strip() if resp.text else ''
            # Normalise: store None for empty body (not empty string) so UI can distinguish
            response_body = raw_text[:2000] if raw_text else None
            success       = 200 <= resp.status_code < 300

            # Extract hint from structured error responses (e.g. n8n {"hint": "..."})
            if not success and response_body:
                try:
                    parsed = json.loads(response_body)
                    response_hint = parsed.get('hint') or parsed.get('message') or parsed.get('error')
                except Exception:
                    pass
    except httpx.TimeoutException:
        error_msg = (
            "Request timed out after 30 seconds. "
            "For n8n test webhooks: make sure you clicked 'Execute Workflow' in n8n "
            "immediately before running this test — test webhooks only stay active for a few seconds."
        )
    except Exception as e:
        error_msg = str(e)

    duration_ms = round((time.monotonic() - start) * 1000)
    now         = datetime.now(timezone.utc)

    run_doc = {
        "id":            str(uuid.uuid4()),
        "automation_id": auto_id,
        "run_type":      "test",
        "contact_id":    contact.get("contact_id"),
        "contact_email": contact.get("email"),
        "contact_name":  contact.get("name"),
        "payload":       payload,
        "webhook_url":   auto['webhook_url'],
        "http_status":   http_status,
        "response_body": response_body,
        "success":       success,
        "error":         error_msg,
        "duration_ms":   duration_ms,
        "triggered_at":  dt_to_str(now),
    }
    await db.automation_runs.insert_one(run_doc)
    await db.automations.update_one({"id": auto_id}, {"$set": {"last_triggered_at": dt_to_str(now)}})

    return {
        "status":        "ok" if success else "error",
        "run_id":        run_doc["id"],
        "http_status":   http_status,
        "response_body": response_body,
        "response_hint": response_hint,
        "duration_ms":   duration_ms,
        "success":       success,
        "error":         error_msg,
        "payload":       payload,
    }


@api_router.get("/automations/{auto_id}/runs", response_model=List[AutomationRunOut])
async def get_automation_runs(auto_id: str, limit: int = 50):
    """Return execution history for a specific automation, newest first."""
    auto = await db.automations.find_one({"id": auto_id}, {"_id": 0, "id": 1})
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")
    runs = await db.automation_runs.find(
        {"automation_id": auto_id}, {"_id": 0}
    ).sort("triggered_at", -1).limit(limit).to_list(limit)
    result = []
    for r in runs:
        r["triggered_at"] = str_to_dt(r.get("triggered_at"))
        result.append(AutomationRunOut(**r))
    return result


# ─────────────────────────── Startup: create indexes ───────────────────────────

@app.on_event("startup")
async def create_indexes():
    try:
        await db.contacts.create_index("contact_id",  unique=True, sparse=True)
        await db.contacts.create_index("email",        sparse=True)
        await db.contacts.create_index("session_id",   sparse=True)
        await db.contacts.create_index("client_ip",    sparse=True)
        await db.contacts.create_index("merged_into",  sparse=True)
        await db.contacts.create_index("created_at")
        await db.page_visits.create_index("contact_id")
        await db.page_visits.create_index("session_id", sparse=True)
        await db.page_visits.create_index("timestamp")
        await db.page_visits.create_index([("contact_id", 1), ("timestamp", 1)])
        await db.automations.create_index("id", unique=True, sparse=True)
        await db.automations.create_index("enabled")
        await db.automation_runs.create_index("automation_id")
        await db.automation_runs.create_index("triggered_at")
        await db.automation_runs.create_index([("automation_id", 1), ("triggered_at", -1)])
        logger.info("MongoDB indexes created/verified")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
