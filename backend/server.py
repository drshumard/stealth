from fastapi import FastAPI, APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta


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
    merged_into: Optional[str] = None   # contact_id this was merged into
    merged_children: Optional[List[str]] = None  # child contact_ids merged into this
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
    merged_into: Optional[str] = None
    merged_children: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    visits: List[PageVisit] = []


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
        known = {'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                 'fbclid', 'gclid', 'ttclid', 'source_link_tag', 'fb_ad_set_id', 'google_campaign_id'}
        attrs = {k: str(v)[:500] for k, v in raw.items() if k in known and v}
        extra = {k: str(v)[:200] for k, v in raw.items() if k not in known and k != 'extra' and v}
        if extra:
            attrs['extra'] = extra
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


async def _upsert_contact(data: dict, now: datetime, client_ip: Optional[str] = None) -> None:
    cid = data.get('contact_id')
    if not cid:
        return

    existing = await db.contacts.find_one({"contact_id": cid}, {"_id": 0})
    now_str = dt_to_str(now)

    if existing:
        update = {"updated_at": now_str}
        for field in ['name', 'email', 'phone', 'first_name', 'last_name', 'session_id']:
            if data.get(field):
                update[field] = data[field]
        if client_ip and not existing.get('client_ip'):
            update['client_ip'] = client_ip
        if data.get('attribution'):
            for k, v in data['attribution'].items():
                if v and not (existing.get('attribution') or {}).get(k):
                    update[f'attribution.{k}'] = v
        await db.contacts.update_one({"contact_id": cid}, {"$set": update})
    else:
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
        cdoc = contact.model_dump()
        cdoc['created_at'] = dt_to_str(cdoc['created_at'])
        cdoc['updated_at'] = dt_to_str(cdoc['updated_at'])
        if cdoc.get('attribution') and hasattr(cdoc['attribution'], 'model_dump'):
            cdoc['attribution'] = cdoc['attribution'].model_dump()
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
    vdoc = visit.model_dump()
    vdoc['timestamp'] = dt_to_str(vdoc['timestamp'])
    if vdoc.get('attribution') and hasattr(vdoc['attribution'], 'model_dump'):
        vdoc['attribution'] = vdoc['attribution'].model_dump()
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

    # Already merged into the CORRECT parent — idempotent
    if child.get('merged_into') == parent_id:
        return {"status": "already_merged", "merged_into": parent_id}

    # Already merged into a DIFFERENT parent — un-merge first, then re-merge
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
    if isinstance(child_attr, dict):
        for k, v in child_attr.items():
            if v and not parent_attr.get(k):
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


async def _ip_auto_stitch(contact_id: str, client_ip: Optional[str], now: datetime) -> None:
    """
    Auto-stitch by IP ONLY when one contact clearly has attribution (UTM/fbclid)
    AND another has email/phone — and neither has both yet.
    This prevents false-positive stitching of anonymous visitors.
    """
    if not client_ip:
        return

    window_start = dt_to_str(now - timedelta(minutes=5))
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

    def has_attribution(c):
        attr = c.get('attribution') or {}
        return any(v for k, v in attr.items() if k not in ('extra',) and v)

    def has_identity(c):
        return bool(c.get('email') or c.get('phone'))

    c_attr  = has_attribution(current)
    c_ident = has_identity(current)

    for candidate in candidates:
        cand_attr  = has_attribution(candidate)
        cand_ident = has_identity(candidate)

        # Only stitch when EXACTLY one side has attribution AND other has identity
        # This prevents false positives between anonymous page-only visits
        if c_attr and cand_ident and not c_ident and not cand_attr:
            # current = landing page (attribution), candidate = iframe (email)
            await _do_stitch(contact_id, candidate['contact_id'], now)
            break
        elif cand_attr and c_ident and not c_attr and not cand_ident:
            # candidate = landing page (attribution), current = iframe (email)
            await _do_stitch(candidate['contact_id'], contact_id, now)
            break
        # All other cases: let explicit stitch handle it


# ─────────────────────────── Tracker JS ───────────────────────────

def build_tracker_js(backend_url: str) -> str:
    return r"""/**
 * StealthTrack - Lead Attribution & Cross-Frame Identity Script
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
      fbclid: '', gclid: '', ttclid: '', source_link_tag: '', fb_ad_set_id: '', google_campaign_id: ''
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
        var hasCached = Object.values(store.source).some(function(v){ return !!v; });
        if (hasCached) logger('📌 Attribution loaded from cache', store.source);
        return;
      } catch (e) {}
    }
    var p = getUrlParams();
    var map = {
      utm_source: ['utm_source'], utm_medium: ['utm_medium'],
      utm_campaign: ['utm_campaign'], utm_term: ['utm_term'], utm_content: ['utm_content'],
      fbclid: ['fbclid', 'fb_cl_id'],
      gclid:  ['gclid', 'g_cl_id'],
      ttclid: ['ttclid'],
      source_link_tag:    ['sl'],
      fb_ad_set_id:       ['fbc_id', 'h_ad_id', 'fbadid'],
      google_campaign_id: ['gc_id', 'h_campaign_id']
    };
    var found = false;
    Object.keys(map).forEach(function (key) {
      map[key].forEach(function (param) {
        if (p[param]) { store.source[key] = p[param]; found = true; }
      });
    });
    if (found) {
      lsSet(ATTR_KEY, JSON.stringify(store.source));
      logger('📌 Attribution captured from URL', store.source);
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
    logger('📄 Page view captured → ' + window.location.href);
    send('/track/pageview', buildPayload());
  }

  function sendLead(fields) {
    var logParts = [];
    if (fields && fields.email) logParts.push('email: ' + fields.email);
    if (fields && fields.phone) logParts.push('phone: ' + fields.phone);
    logger('✉️  Lead captured' + (logParts.length ? ' (' + logParts.join(', ') + ')' : ''), fields);
    send('/track/lead', buildPayload(fields));
  }

  function sendRegistration(fields) {
    var logParts = [];
    if (fields && fields.email) logParts.push('email: ' + fields.email);
    if (fields && fields.phone) logParts.push('phone: ' + fields.phone);
    if (fields && fields.name)  logParts.push('name: ' + fields.name);
    logger('📝 Registration captured' + (logParts.length ? ' (' + logParts.join(', ') + ')' : ''), fields);
    send('/track/registration', buildPayload(fields));
  }

  /* ─── Stitch two contacts together ─── */
  function sendStitch(parentCid, childCid) {
    if (!parentCid || !childCid || parentCid === childCid) return;
    logger('🔗 Stitching ' + childCid.substring(0,8) + '… → ' + parentCid.substring(0,8) + '…');
    send('/track/stitch', {
      parent_contact_id: parentCid,
      child_contact_id:  childCid,
      session_id:        store.config.sessionId || null
    });
  }

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

    /* iframe receives parent identity */
    if (e.data.type === 'st_parent_id' && store.config.isIframe) {
      var parentCid  = e.data.contactId;
      var parentSess = e.data.sessionId;

      if (parentCid && parentCid !== store.config.contactId) {
        logger('received parent id: ' + parentCid);
        store.config.parentContactId = parentCid;

        // Adopt parent's session_id
        if (parentSess) {
          store.config.sessionId = parentSess;
          ssSet(SESS_KEY, parentSess);
        }

        // Stitch: we (iframe/child) merge into parent
        sendStitch(parentCid, store.config.contactId);

        // Reply so parent can also confirm stitch
        try {
          e.source.postMessage({
            type:      'st_child_id',
            contactId: store.config.contactId,
            sessionId: store.config.sessionId
          }, e.origin || '*');
        } catch (err) {}
      }
    }

    /* Parent receives child (iframe) identity */
    if (e.data.type === 'st_child_id' && !store.config.isIframe) {
      var childCid = e.data.contactId;
      if (childCid && childCid !== store.config.contactId) {
        logger('received child id: ' + childCid);
        sendStitch(store.config.contactId, childCid);
      }
    }

    /* Legacy / future webinar platform events — capture form data from iframe postMessages */
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
    if (ft==='email' && isEmail(val) && val!==store.lead.email) { store.lead.email=val; sendLead({email:val}); }
    else if (ft==='phone' && isPhone(val) && val!==store.lead.phone) { store.lead.phone=val; sendLead({phone:val}); }
    else if (ft==='firstName') store.lead.firstName=val;
    else if (ft==='lastName')  store.lead.lastName=val;
    else if (ft==='name')      store.lead.name=val;
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
  window.StealthTrack = {
    getContactId:  getContactId,
    getSessionId:  function(){ return store.config.sessionId; },
    identify: function(fields){
      if (fields.email && isEmail(fields.email)){ store.lead.email=fields.email; sendLead(fields); }
    },
    stitch:    sendStitch,
    trackEvent: sendLead,
    store:     store,
    debug:     function(){ window.__ST_DEBUG=true; }
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
        await _upsert_contact({'contact_id': data.contact_id, 'session_id': data.session_id, 'attribution': data.attribution}, now, ip)
        vid = await _log_visit(data.contact_id, data.session_id, data.current_url, data.referrer_url, data.page_title, data.attribution, now, ip)
        await _ip_auto_stitch(data.contact_id, ip, now)
        return {"status": "ok", "visit_id": vid, "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking pageview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track/lead")
async def track_lead(data: LeadCreate, request: Request):
    try:
        now = datetime.now(timezone.utc)
        ip  = get_client_ip(request)
        await _upsert_contact({'contact_id': data.contact_id, 'session_id': data.session_id, 'email': data.email, 'phone': data.phone, 'name': data.name, 'first_name': data.first_name, 'last_name': data.last_name, 'attribution': data.attribution}, now, ip)
        await _ip_auto_stitch(data.contact_id, ip, now)
        return {"status": "ok", "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track/registration")
async def track_registration(data: RegistrationCreate, request: Request):
    try:
        now = datetime.now(timezone.utc)
        ip  = get_client_ip(request)
        await _upsert_contact({'contact_id': data.contact_id, 'session_id': data.session_id, 'email': data.email, 'phone': data.phone, 'name': data.name, 'first_name': data.first_name, 'last_name': data.last_name, 'attribution': data.attribution}, now, ip)
        if data.current_url:
            await _log_visit(data.contact_id, data.session_id, data.current_url, data.referrer_url, data.page_title or "Registration", data.attribution, now, ip)
        await _ip_auto_stitch(data.contact_id, ip, now)
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

        contacts_raw = await db.contacts.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
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
