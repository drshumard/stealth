from fastapi import FastAPI, APIRouter, HTTPException, Response
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app without a prefix
app = FastAPI(title="StealthTrack API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# ─────────────────────────── Models ───────────────────────────

class PageVisit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str
    current_url: str
    referrer_url: Optional[str] = None
    page_title: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PageVisitCreate(BaseModel):
    contact_id: str
    current_url: str
    referrer_url: Optional[str] = None
    page_title: Optional[str] = None


class Contact(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    contact_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RegistrationCreate(BaseModel):
    contact_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    current_url: Optional[str] = None
    referrer_url: Optional[str] = None
    page_title: Optional[str] = None


class ContactWithStats(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    visit_count: int = 0


class ContactDetail(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    visits: List[PageVisit] = []


# ─────────────────────────── Helper ───────────────────────────

def dt_to_str(dt):
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt


def str_to_dt(s):
    if isinstance(s, str):
        return datetime.fromisoformat(s)
    return s


# ─────────────────────────── Tracker.js ───────────────────────────

def build_tracker_js(backend_url: str) -> str:
    return r"""
(function() {
  'use strict';

  var BACKEND_URL = '""" + backend_url + r"""';
  var LS_KEY = 'st_contact_id';
  var _sent_pageview = false;

  // -- contact_id management --
  function getContactId() {
    var id = localStorage.getItem(LS_KEY);
    if (!id) {
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem(LS_KEY, id);
    }
    return id;
  }

  // -- HTTP helper: sendBeacon with XHR fallback --
  function send(endpoint, data) {
    var url = BACKEND_URL + '/api' + endpoint;
    var body = JSON.stringify(data);
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(body);
    }
  }

  // -- Send page view --
  function sendPageview() {
    if (_sent_pageview) return;
    _sent_pageview = true;
    var cid = getContactId();
    send('/track/pageview', {
      contact_id: cid,
      current_url: window.location.href,
      referrer_url: document.referrer || null,
      page_title: document.title || null
    });
  }

  // -- Extract field value by name/id/placeholder --
  function getFieldValue(form, names) {
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var el = form.querySelector('[name="' + n + '"], [id="' + n + '"], [placeholder*="' + n + '"]');
      if (el && el.value) return el.value.trim();
    }
    return null;
  }

  function getEmailValue(form) {
    var el = form.querySelector('input[type="email"]');
    if (el && el.value) return el.value.trim();
    return getFieldValue(form, ['email', 'Email', 'EMAIL', 'user_email', 'subscriber_email', 'attendee_email']);
  }

  function getNameValue(form) {
    var fullName = getFieldValue(form, ['full_name', 'fullname', 'name', 'Name', 'first_name', 'firstname', 'fname']);
    if (fullName) return fullName;
    var first = getFieldValue(form, ['first_name', 'firstname', 'fname']);
    var last = getFieldValue(form, ['last_name', 'lastname', 'lname', 'surname']);
    if (first && last) return (first + ' ' + last).trim();
    return first || last || null;
  }

  function getPhoneValue(form) {
    var el = form.querySelector('input[type="tel"]');
    if (el && el.value) return el.value.trim();
    return getFieldValue(form, ['phone', 'Phone', 'PHONE', 'telephone', 'mobile', 'cell', 'phone_number', 'attendee_phone']);
  }

  // -- Form submission handler --
  function handleFormSubmit(form) {
    var email = getEmailValue(form);
    var name = getNameValue(form);
    var phone = getPhoneValue(form);
    if (!email) return;
    var cid = getContactId();
    send('/track/registration', {
      contact_id: cid,
      name: name,
      email: email,
      phone: phone,
      current_url: window.location.href,
      referrer_url: document.referrer || null,
      page_title: document.title || null
    });
  }

  // -- Bind submit listeners to all forms --
  function bindForms() {
    var forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
      if (form._st_bound) return;
      form._st_bound = true;
      form.addEventListener('submit', function(e) {
        handleFormSubmit(form);
      }, { capture: true, passive: true });
    });
  }

  // -- Watch for dynamically injected forms (iframes, lazy renders) --
  var _observer = null;
  function watchForForms() {
    if (_observer) return;
    _observer = new MutationObserver(function() { bindForms(); });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  // -- Intercept submit button clicks (StealthWebinar SPA pattern) --
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT' && el.tagName !== 'A') {
      el = el.parentElement;
    }
    if (!el) return;
    var isSubmit = (el.tagName === 'INPUT' && el.type === 'submit') ||
                   (el.tagName === 'BUTTON' && (el.type === 'submit' || !el.type));
    if (!isSubmit) return;
    var form = el.closest('form');
    if (form) handleFormSubmit(form);
  }, { capture: true, passive: true });

  // -- Init --
  function init() {
    bindForms();
    watchForForms();
    sendPageview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.StealthTrack = {
    getContactId: getContactId,
    sendPageview: sendPageview
  };

})();
"""


# ─────────────────────────── Routes ───────────────────────────

@api_router.get("/")
async def root():
    return {"message": "StealthTrack API", "status": "running"}


# Serve tracker.js
@api_router.get("/tracker.js", response_class=PlainTextResponse)
async def get_tracker_js(request_url: str = None):
    # Detect backend URL from environment
    backend_url = os.environ.get('REACT_APP_BACKEND_URL', '')
    if not backend_url:
        # Try to build from request – fallback
        backend_url = ''
    
    js_content = TRACKER_JS_TEMPLATE.replace('{BACKEND_URL}', backend_url)
    return PlainTextResponse(
        content=js_content,
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Access-Control-Allow-Origin": "*",
        }
    )


# Track page view
@api_router.post("/track/pageview")
async def track_pageview(data: PageVisitCreate):
    try:
        visit = PageVisit(**data.model_dump())
        doc = visit.model_dump()
        doc['timestamp'] = dt_to_str(doc['timestamp'])
        await db.page_visits.insert_one(doc)
        
        # Ensure contact record exists (anonymous)
        existing = await db.contacts.find_one({"contact_id": data.contact_id}, {"_id": 0})
        if not existing:
            contact = Contact(contact_id=data.contact_id)
            cdoc = contact.model_dump()
            cdoc['created_at'] = dt_to_str(cdoc['created_at'])
            cdoc['updated_at'] = dt_to_str(cdoc['updated_at'])
            await db.contacts.insert_one(cdoc)
        
        return {"status": "ok", "visit_id": visit.id}
    except Exception as e:
        logger.error(f"Error tracking pageview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Track registration (form submission)
@api_router.post("/track/registration")
async def track_registration(data: RegistrationCreate):
    try:
        now = datetime.now(timezone.utc)
        now_str = dt_to_str(now)
        
        # Upsert contact by contact_id
        existing = await db.contacts.find_one({"contact_id": data.contact_id}, {"_id": 0})
        if existing:
            # Update fields if new data has values
            update_fields = {"updated_at": now_str}
            if data.name:
                update_fields["name"] = data.name
            if data.email:
                update_fields["email"] = data.email
            if data.phone:
                update_fields["phone"] = data.phone
            await db.contacts.update_one(
                {"contact_id": data.contact_id},
                {"$set": update_fields}
            )
        else:
            contact = Contact(
                contact_id=data.contact_id,
                name=data.name,
                email=data.email,
                phone=data.phone,
                created_at=now,
                updated_at=now
            )
            cdoc = contact.model_dump()
            cdoc['created_at'] = dt_to_str(cdoc['created_at'])
            cdoc['updated_at'] = dt_to_str(cdoc['updated_at'])
            await db.contacts.insert_one(cdoc)
        
        # Also log as a page visit (registration page)
        if data.current_url:
            visit = PageVisit(
                contact_id=data.contact_id,
                current_url=data.current_url,
                referrer_url=data.referrer_url,
                page_title=data.page_title or "Registration"
            )
            vdoc = visit.model_dump()
            vdoc['timestamp'] = dt_to_str(vdoc['timestamp'])
            await db.page_visits.insert_one(vdoc)
        
        return {"status": "ok", "contact_id": data.contact_id}
    except Exception as e:
        logger.error(f"Error tracking registration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Get all contacts with visit counts
@api_router.get("/contacts", response_model=List[ContactWithStats])
async def get_contacts(search: Optional[str] = None):
    try:
        query = {}
        if search:
            query = {
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"email": {"$regex": search, "$options": "i"}}
                ]
            }
        
        contacts_raw = await db.contacts.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        
        result = []
        for c in contacts_raw:
            # Fix datetime fields
            c['created_at'] = str_to_dt(c.get('created_at'))
            c['updated_at'] = str_to_dt(c.get('updated_at'))
            
            # Count visits
            visit_count = await db.page_visits.count_documents({"contact_id": c['contact_id']})
            c['visit_count'] = visit_count
            
            result.append(ContactWithStats(**c))
        
        return result
    except Exception as e:
        logger.error(f"Error getting contacts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Get contact detail with all visits
@api_router.get("/contacts/{contact_id}", response_model=ContactDetail)
async def get_contact_detail(contact_id: str):
    try:
        contact = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        
        contact['created_at'] = str_to_dt(contact.get('created_at'))
        contact['updated_at'] = str_to_dt(contact.get('updated_at'))
        
        # Get all visits sorted by timestamp
        visits_raw = await db.page_visits.find(
            {"contact_id": contact_id}, {"_id": 0}
        ).sort("timestamp", 1).to_list(500)
        
        visits = []
        for v in visits_raw:
            v['timestamp'] = str_to_dt(v.get('timestamp'))
            visits.append(PageVisit(**v))
        
        contact['visits'] = visits
        return ContactDetail(**contact)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting contact detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Stats endpoint for dashboard header
@api_router.get("/stats")
async def get_stats():
    try:
        total_contacts = await db.contacts.count_documents({})
        total_visits = await db.page_visits.count_documents({})
        
        # Today's events
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_str = dt_to_str(today_start)
        
        today_visits = await db.page_visits.count_documents({
            "timestamp": {"$gte": today_start_str}
        })
        
        return {
            "total_contacts": total_contacts,
            "total_visits": total_visits,
            "today_visits": today_visits
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Include the router in the main app
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
