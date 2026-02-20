from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
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
from datetime import datetime, timezone


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
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    attribution: Optional[Attribution] = None
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
    """Called when a lead field is captured via change event (like Hyros)"""
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


class ContactWithStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    attribution: Optional[Attribution] = None
    created_at: datetime
    updated_at: datetime
    visit_count: int = 0


class ContactDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    session_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    attribution: Optional[Attribution] = None
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


def safe_attribution(raw: Optional[dict]) -> Optional[Attribution]:
    if not raw:
        return None
    try:
        # Only keep known fields in Attribution, put rest in extra
        known = {'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                 'fbclid', 'gclid', 'ttclid', 'source_link_tag', 'fb_ad_set_id', 'google_campaign_id'}
        attrs = {k: str(v)[:500] for k, v in raw.items() if k in known and v}
        extra = {k: str(v)[:200] for k, v in raw.items() if k not in known and k != 'extra' and v}
        if extra:
            attrs['extra'] = extra
        return Attribution(**attrs) if attrs else None
    except Exception:
        return None


# ─────────────────────────── Tracker JS ───────────────────────────

def build_tracker_js(backend_url: str) -> str:
    return r"""/**
 * StealthTrack - Lead Attribution Script
 * Mimics Hyros tracking architecture
 * Include in <head>: <script src="BACKEND_URL/api/tracker.js"></script>
 */
(function () {
  'use strict';

  var BACKEND_URL = '""" + backend_url + r"""';
  var API_BASE    = BACKEND_URL + '/api';

  /* ── Central data store (mirrors Hyros's `f` object) ── */
  var store = {
    lead: {
      email:      '',
      phone:      '',
      firstName:  '',
      lastName:   '',
      name:       ''
    },
    source: {
      utm_source:        '',
      utm_medium:        '',
      utm_campaign:      '',
      utm_term:          '',
      utm_content:       '',
      fbclid:            '',
      gclid:             '',
      ttclid:            '',
      source_link_tag:   '',
      fb_ad_set_id:      '',
      google_campaign_id: ''
    },
    config: {
      contactId:  '',
      sessionId:  '',
      prevUrl:    document.referrer || '',
      currentUrl: window.location.href,
      pageTitle:  document.title || ''
    },
    processedData: {
      emailSent:   false,
      phoneSent:   false,
      pageSent:    false
    }
  };

  /* ── LocalStorage / Cookie helpers ── */
  var LS_KEY     = 'st_contact_id';
  var SESS_KEY   = 'st_session_id';
  var ATTR_KEY   = 'st_attribution';
  var COOKIE_TTL = 365; // days

  function setCookie(name, value, days) {
    try {
      var expires = '';
      if (days) {
        var d = new Date();
        d.setTime(d.getTime() + days * 864e5);
        expires = '; expires=' + d.toUTCString();
      }
      document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
    } catch (e) {}
  }

  function getCookie(name) {
    try {
      var v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      return v ? decodeURIComponent(v.pop()) : null;
    } catch (e) { return null; }
  }

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return getCookie(key); }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
    setCookie(key, value, COOKIE_TTL);
  }

  /* ── UUID generator ── */
  function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ── Contact ID management (persisted across sessions) ── */
  function getContactId() {
    var id = lsGet(LS_KEY);
    if (!id) {
      id = genUUID();
      lsSet(LS_KEY, id);
    }
    return id;
  }

  /* ── URL parameter parser ── */
  function getUrlParams(url) {
    try {
      var search = (url || window.location.href).split('?')[1] || '';
      var result = {};
      search.split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0]) result[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
      return result;
    } catch (e) { return {}; }
  }

  /* ── Attribution capture from URL ── */
  function captureAttribution() {
    var cached = lsGet(ATTR_KEY);
    if (cached) {
      try { Object.assign(store.source, JSON.parse(cached)); return; } catch (e) {}
    }

    var p = getUrlParams();

    var map = {
      utm_source:         ['utm_source'],
      utm_medium:         ['utm_medium'],
      utm_campaign:       ['utm_campaign'],
      utm_term:           ['utm_term'],
      utm_content:        ['utm_content'],
      fbclid:             ['fbclid', 'fb_cl_id'],
      gclid:              ['gclid', 'g_cl_id'],
      ttclid:             ['ttclid'],
      source_link_tag:    ['sl'],
      fb_ad_set_id:       ['fbc_id', 'h_ad_id'],
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
    }
  }

  /* ── Network: send via fetch with keepalive, XHR fallback ── */
  function send(endpoint, payload) {
    var url  = API_BASE + endpoint;
    var body = JSON.stringify(payload);
    var headers = { 'Content-Type': 'application/json' };

    if (typeof fetch !== 'undefined') {
      try {
        fetch(url, { method: 'POST', headers: headers, body: body, keepalive: true })
          .catch(function () { xhrSend(url, body); });
        return;
      } catch (e) {}
    }
    xhrSend(url, body);
  }

  function xhrSend(url, body) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(body);
    } catch (e) {}
  }

  /* ── Build common payload ── */
  function buildPayload(extra) {
    var base = {
      contact_id:   store.config.contactId,
      session_id:   store.config.sessionId || null,
      current_url:  window.location.href,
      referrer_url: store.config.prevUrl || null,
      page_title:   document.title || null,
      attribution:  store.source
    };
    return Object.assign(base, extra || {});
  }

  /* ── Page view ── */
  function sendPageview() {
    if (store.processedData.pageSent) return;
    store.processedData.pageSent = true;
    send('/track/pageview', buildPayload());
  }

  /* ── Lead (email/phone captured via change event — Hyros style) ── */
  function sendLead(fields) {
    var payload = buildPayload(fields);
    send('/track/lead', payload);
  }

  /* ── Registration (form submit with all fields) ── */
  function sendRegistration(fields) {
    var payload = buildPayload(fields);
    send('/track/registration', payload);
  }

  /* ─────────────────────────────────────────────────────
     Field extraction — mirrors Hyros's class + attribute strategy
     ───────────────────────────────────────────────────── */

  /* Special classes (use st-* or hyros-* for compatibility) */
  var CLASSES = {
    email:     ['st-email', 'hyros-email'],
    firstName: ['st-first-name', 'hyros-first-name'],
    lastName:  ['st-last-name', 'hyros-last-name'],
    phone:     ['st-phone', 'hyros-phone', 'st-telephone']
  };

  /* Common attribute names */
  var ATTR_NAMES = {
    email:     ['email', 'Email', 'EMAIL', 'user_email', 'subscriber_email', 'attendee_email',
                 'email_address', 'emailaddress', 'your-email', 'contact_email'],
    firstName: ['first_name', 'firstname', 'fname', 'first-name', 'FirstName'],
    lastName:  ['last_name', 'lastname', 'lname', 'last-name', 'LastName'],
    name:      ['full_name', 'fullname', 'name', 'Name', 'contact_name', 'your-name',
                 'attendee_name', 'participant_name'],
    phone:     ['phone', 'Phone', 'PHONE', 'telephone', 'mobile', 'cell',
                 'phone_number', 'attendee_phone', 'phonenumber', 'your-phone',
                 'contact_phone', 'mobilephone']
  };

  function hasClass(el, classes) {
    for (var i = 0; i < classes.length; i++) {
      if (el.classList && el.classList.contains(classes[i])) return true;
    }
    return false;
  }

  function matchesAttr(el, names) {
    var elName = (el.name || '').toLowerCase();
    var elId   = (el.id   || '').toLowerCase();
    var elPh   = (el.placeholder || '').toLowerCase();
    var elData = (el.getAttribute('data-field') || '').toLowerCase();
    for (var i = 0; i < names.length; i++) {
      var n = names[i].toLowerCase();
      if (elName === n || elId === n || elPh.indexOf(n) !== -1 || elData === n) return true;
    }
    return false;
  }

  function classifyInput(el) {
    if (!el || !el.tagName) return null;
    var tag   = el.tagName.toUpperCase();
    var type  = (el.type || '').toLowerCase();
    var imode = (el.getAttribute('inputmode') || '').toLowerCase();

    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return null;

    // Priority 1: explicit class
    if (hasClass(el, CLASSES.email))     return 'email';
    if (hasClass(el, CLASSES.firstName)) return 'firstName';
    if (hasClass(el, CLASSES.lastName))  return 'lastName';
    if (hasClass(el, CLASSES.phone))     return 'phone';

    // Priority 2: input type
    if (type === 'email') return 'email';
    if (type === 'tel' || imode === 'tel' || imode === 'numeric') return 'phone';

    // Priority 3: name/id/placeholder
    if (matchesAttr(el, ATTR_NAMES.email))     return 'email';
    if (matchesAttr(el, ATTR_NAMES.phone))     return 'phone';
    if (matchesAttr(el, ATTR_NAMES.firstName)) return 'firstName';
    if (matchesAttr(el, ATTR_NAMES.lastName))  return 'lastName';
    if (matchesAttr(el, ATTR_NAMES.name))      return 'name';

    return null;
  }

  /* ── Email validator (simple) ── */
  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());
  }

  /* ── Phone validator (loose) ── */
  function isPhone(v) {
    return /^[+\d][\d\s\-().]{6,19}$/.test((v || '').trim());
  }

  /* ─────────────────────────────────────────────────────
     Change event handler — fires on EACH field (Hyros style)
     Not just on form submit
     ───────────────────────────────────────────────────── */
  function handleFieldChange(el) {
    var fieldType = classifyInput(el);
    if (!fieldType) return;

    var value = (el.value || '').trim();
    if (!value) return;

    var changed = false;

    if (fieldType === 'email' && isEmail(value) && value !== store.lead.email) {
      store.lead.email = value;
      changed = true;
      sendLead({ email: value });
    }
    else if (fieldType === 'phone' && isPhone(value) && value !== store.lead.phone) {
      store.lead.phone = value;
      changed = true;
      sendLead({ phone: value });
    }
    else if (fieldType === 'firstName' && value !== store.lead.firstName) {
      store.lead.firstName = value;
      changed = true;
    }
    else if (fieldType === 'lastName' && value !== store.lead.lastName) {
      store.lead.lastName = value;
      changed = true;
    }
    else if (fieldType === 'name' && value !== store.lead.name) {
      store.lead.name = value;
      changed = true;
    }
  }

  /* ─────────────────────────────────────────────────────
     Form submit handler — sends ALL collected fields
     ───────────────────────────────────────────────────── */
  function handleFormSubmit(form) {
    // Scrape all inputs one last time
    var inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(function (el) {
      var fieldType = classifyInput(el);
      var value     = (el.value || '').trim();
      if (!fieldType || !value) return;
      if (fieldType === 'email'     && isEmail(value)) store.lead.email     = value;
      if (fieldType === 'phone'     && isPhone(value)) store.lead.phone     = value;
      if (fieldType === 'firstName')                   store.lead.firstName = value;
      if (fieldType === 'lastName')                    store.lead.lastName  = value;
      if (fieldType === 'name')                        store.lead.name      = value;
    });

    if (!store.lead.email && !store.lead.phone) return;

    // Build name
    var fullName = store.lead.name ||
      ((store.lead.firstName + ' ' + store.lead.lastName).trim()) || null;

    sendRegistration({
      email:      store.lead.email || null,
      phone:      store.lead.phone || null,
      name:       fullName,
      first_name: store.lead.firstName || null,
      last_name:  store.lead.lastName  || null
    });
  }

  /* ── Bind change listeners to a form's inputs ── */
  function bindInputListeners(form) {
    if (!form || form._st_inputs_bound) return;
    form._st_inputs_bound = true;

    var inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(function (el) {
      if (el._st_bound) return;
      el._st_bound = true;

      // 'change' fires when user leaves field — Hyros pattern
      el.addEventListener('change', function () { handleFieldChange(el); }, true);
      // 'blur' catches tab-away
      el.addEventListener('blur',   function () { handleFieldChange(el); }, true);
    });
  }

  /* ── Bind submit listener to a form ── */
  function bindSubmitListener(form) {
    if (!form || form._st_submit_bound) return;
    form._st_submit_bound = true;
    form.addEventListener('submit', function () {
      setTimeout(function () { handleFormSubmit(form); }, 0);
    }, true);
  }

  /* ── Bind all forms ── */
  function bindForms() {
    var forms = document.querySelectorAll('form');
    forms.forEach(function (form) {
      bindInputListeners(form);
      bindSubmitListener(form);
    });
  }

  /* ── Also capture isolated inputs not in a <form> ── */
  function bindLooseInputs() {
    var inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(function (el) {
      if (el.form || el._st_bound) return;
      el._st_bound = true;
      el.addEventListener('change', function () { handleFieldChange(el); }, true);
      el.addEventListener('blur',   function () { handleFieldChange(el); }, true);
    });
  }

  /* ── Catch submit-button clicks (SPA / custom forms) ── */
  document.addEventListener('click', function (e) {
    var el = e.target;
    for (var i = 0; i < 5 && el; i++, el = el.parentElement) {
      var tag  = el.tagName && el.tagName.toUpperCase();
      var type = (el.type || '').toLowerCase();
      if ((tag === 'BUTTON' && (type === 'submit' || !el.type || type === 'button')) ||
          (tag === 'INPUT'  && type === 'submit')) {
        var form = el.closest('form');
        if (form) { setTimeout(function () { handleFormSubmit(form); }, 100); }
        break;
      }
    }
  }, { capture: true, passive: true });

  /* ── MutationObserver — watch for iframes / lazy-rendered forms ── */
  var _observer = null;
  function watchDOM() {
    if (_observer || !window.MutationObserver) return;
    _observer = new MutationObserver(function () {
      bindForms();
      bindLooseInputs();
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ── Listen for custom event (SPA / manual integration) ── */
  window.addEventListener('stealthtrack_email', function (e) {
    var email = e.detail && e.detail.email;
    if (email && isEmail(email) && email !== store.lead.email) {
      store.lead.email = email;
      sendLead({ email: email });
    }
  });

  /* ── SPA navigation — detect URL change ── */
  (function () {
    var lastUrl = window.location.href;
    setInterval(function () {
      var cur = window.location.href;
      if (cur !== lastUrl) {
        lastUrl = cur;
        store.config.prevUrl    = store.config.currentUrl;
        store.config.currentUrl = cur;
        store.config.pageTitle  = document.title || '';
        store.processedData.pageSent = false;
        sendPageview();
        bindForms();
        bindLooseInputs();
      }
    }, 800);
  })();

  /* ── Init ── */
  function init() {
    store.config.contactId = getContactId();
    captureAttribution();
    bindForms();
    bindLooseInputs();
    watchDOM();
    sendPageview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API (window.StealthTrack) ── */
  window.StealthTrack = {
    getContactId: getContactId,
    identify: function (fields) {
      if (fields.email && isEmail(fields.email)) {
        store.lead.email = fields.email;
        sendLead(fields);
      }
    },
    trackEvent: sendLead,
    store: store
  };

})();
"""


# ─────────────────────────── Routes ───────────────────────────

@api_router.get("/")
async def root():
    return {"message": "StealthTrack API", "status": "running"}


@api_router.get("/tracker.js", response_class=PlainTextResponse)
async def get_tracker_js():
    backend_url = os.environ.get('REACT_APP_BACKEND_URL', '')
    js_content = build_tracker_js(backend_url)
    return PlainTextResponse(
        content=js_content,
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Access-Control-Allow-Origin": "*",
        }
    )


async def _upsert_contact(data: dict, now: datetime) -> None:
    """Upsert a contact by contact_id, merging non-null fields."""
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
        # Merge attribution
        if data.get('attribution'):
            for k, v in data['attribution'].items():
                if v and not existing.get('attribution', {}).get(k):
                    update[f'attribution.{k}'] = v
        await db.contacts.update_one({"contact_id": cid}, {"$set": update})
    else:
        contact = Contact(
            contact_id=cid,
            session_id=data.get('session_id'),
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
        if cdoc.get('attribution'):
            cdoc['attribution'] = cdoc['attribution'].model_dump() if hasattr(cdoc['attribution'], 'model_dump') else cdoc['attribution']
        await db.contacts.insert_one(cdoc)


async def _log_visit(contact_id: str, session_id: Optional[str],
                     current_url: str, referrer_url: Optional[str],
                     page_title: Optional[str], attribution: Optional[dict],
                     now: datetime) -> str:
    visit = PageVisit(
        contact_id=contact_id,
        session_id=session_id,
        current_url=current_url,
        referrer_url=referrer_url,
        page_title=page_title,
        attribution=safe_attribution(attribution),
        timestamp=now
    )
    vdoc = visit.model_dump()
    vdoc['timestamp'] = dt_to_str(vdoc['timestamp'])
    if vdoc.get('attribution'):
        vdoc['attribution'] = vdoc['attribution'].model_dump() if hasattr(vdoc['attribution'], 'model_dump') else vdoc['attribution']
    await db.page_visits.insert_one(vdoc)
    return visit.id


# Track page view
@api_router.post("/track/pageview")
async def track_pageview(data: PageViewCreate):
    try:
        now = datetime.now(timezone.utc)
        await _upsert_contact({'contact_id': data.contact_id, 'session_id': data.session_id,
                                'attribution': data.attribution}, now)
        visit_id = await _log_visit(
            data.contact_id, data.session_id,
            data.current_url, data.referrer_url, data.page_title,
            data.attribution, now
        )
        return {"status": "ok", "visit_id": visit_id, "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking pageview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Track lead field capture (Hyros-style change event)
@api_router.post("/track/lead")
async def track_lead(data: LeadCreate):
    try:
        now = datetime.now(timezone.utc)
        await _upsert_contact({
            'contact_id': data.contact_id,
            'session_id': data.session_id,
            'email':      data.email,
            'phone':      data.phone,
            'name':       data.name,
            'first_name': data.first_name,
            'last_name':  data.last_name,
            'attribution': data.attribution
        }, now)
        return {"status": "ok", "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking lead: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Track form registration (full submission)
@api_router.post("/track/registration")
async def track_registration(data: RegistrationCreate):
    try:
        now = datetime.now(timezone.utc)
        await _upsert_contact({
            'contact_id': data.contact_id,
            'session_id': data.session_id,
            'email':      data.email,
            'phone':      data.phone,
            'name':       data.name,
            'first_name': data.first_name,
            'last_name':  data.last_name,
            'attribution': data.attribution
        }, now)
        if data.current_url:
            await _log_visit(
                data.contact_id, data.session_id,
                data.current_url, data.referrer_url, data.page_title or "Registration",
                data.attribution, now
            )
        return {"status": "ok", "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking registration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Get all contacts
@api_router.get("/contacts", response_model=List[ContactWithStats])
async def get_contacts(search: Optional[str] = None):
    try:
        query = {}
        if search:
            query = {"$or": [
                {"name":  {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}}
            ]}
        contacts_raw = await db.contacts.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        result = []
        for c in contacts_raw:
            c['created_at'] = str_to_dt(c.get('created_at'))
            c['updated_at'] = str_to_dt(c.get('updated_at'))
            if isinstance(c.get('attribution'), dict):
                c['attribution'] = Attribution(**{k: v for k, v in c['attribution'].items() if v})
            visit_count = await db.page_visits.count_documents({"contact_id": c['contact_id']})
            c['visit_count'] = visit_count
            result.append(ContactWithStats(**c))
        return result
    except Exception as e:
        logger.error(f"Error getting contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Get contact detail
@api_router.get("/contacts/{contact_id}", response_model=ContactDetail)
async def get_contact_detail(contact_id: str):
    try:
        contact = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        contact['created_at'] = str_to_dt(contact.get('created_at'))
        contact['updated_at'] = str_to_dt(contact.get('updated_at'))
        if isinstance(contact.get('attribution'), dict):
            contact['attribution'] = Attribution(**{k: v for k, v in contact['attribution'].items() if v})
        visits_raw = await db.page_visits.find(
            {"contact_id": contact_id}, {"_id": 0}
        ).sort("timestamp", 1).to_list(500)
        visits = []
        for v in visits_raw:
            v['timestamp'] = str_to_dt(v.get('timestamp'))
            if isinstance(v.get('attribution'), dict):
                v['attribution'] = Attribution(**{k: val for k, val in v['attribution'].items() if val})
            visits.append(PageVisit(**v))
        contact['visits'] = visits
        return ContactDetail(**contact)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contact detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Stats
@api_router.get("/stats")
async def get_stats():
    try:
        total_contacts = await db.contacts.count_documents({})
        total_visits   = await db.page_visits.count_documents({})
        today_start    = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_visits   = await db.page_visits.count_documents({"timestamp": {"$gte": dt_to_str(today_start)}})
        return {"total_contacts": total_contacts, "total_visits": total_visits, "today_visits": today_visits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
