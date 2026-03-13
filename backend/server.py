from fastapi import FastAPI, APIRouter, HTTPException, Request, BackgroundTasks, Query
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
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
    fbc: Optional[str] = None              # Facebook Click ID cookie (_fbc)
    fbp: Optional[str] = None              # Facebook Browser ID cookie (_fbp)
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
    user_agent: Optional[str] = None          # Browser user agent (for FB CAPI: client_user_agent)
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
    user_agent: Optional[str] = None          # Browser user agent string


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
    user_agent: Optional[str] = None          # Browser user agent string


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
    user_agent: Optional[str] = None          # Browser user agent string


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
    user_agent: Optional[str] = None          # Browser user agent (for FB CAPI)
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
    user_agent: Optional[str] = None          # Browser user agent (for FB CAPI)
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
    sales: List['SaleBasic'] = []


class TagCreate(BaseModel):
    contact_id: str
    tag: str                  # e.g. "registered", "attended", "thank-you"
    session_id: Optional[str] = None


# ─────────────────────────── Sale Models ───────────────────────────

class SaleBasic(BaseModel):
    """Embedded inside ContactDetail — no circular reference."""
    model_config = ConfigDict(extra="ignore")
    id: str
    amount: Optional[float] = None
    currency: Optional[str] = None
    product: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    created_at: datetime


class SaleOut(BaseModel):
    """Full sale record returned from GET /api/sales."""
    model_config = ConfigDict(extra="ignore")
    id: str
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    email: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    product: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    raw_data: Dict[str, Any] = {}
    created_at: datetime

class AutomationFilter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    field: str
    operator: str
    value: Optional[str] = None


class AutomationFieldMap(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: str
    target: str


class AutomationAction(BaseModel):
    """A single webhook step within an automation.  Automations can have
    multiple actions — each fires independently with its own URL and mapping."""
    id:             str = Field(default_factory=lambda: str(uuid.uuid4()))
    name:           Optional[str] = None           # e.g. "Send to GoHighLevel"
    webhook_url:    str = ""
    field_map:      List[AutomationFieldMap] = []  # per-step overrides; falls back to automation field_map
    custom_headers: Optional[Dict[str, str]] = None
    delay_seconds:  int = 0                        # wait N seconds then refetch contact before firing


class AutomationCreate(BaseModel):
    name:             str
    enabled:          bool = True
    # ── New flexible step pipeline ─────────────────────────────────────────
    # Each step: { id, type, config }
    # types: 'wait_for' | 'filter' | 'delay' | 'webhook'
    # When present, _run_automations uses this instead of the legacy fields.
    steps: Optional[List[Dict[str, Any]]] = None
    # ── Legacy fields — kept for backward compat (automations without steps) ──
    required_fields:  List[str] = ['email']
    actions:          List[AutomationAction] = []
    filters:          List[AutomationFilter] = []
    webhook_url:      Optional[str] = None
    field_map:        List[AutomationFieldMap] = []
    custom_headers:   Optional[Dict[str, str]] = None


class AutomationUpdate(BaseModel):
    name:             Optional[str] = None
    enabled:          Optional[bool] = None
    steps:            Optional[List[Dict[str, Any]]] = None
    required_fields:  Optional[List[str]] = None
    actions:          Optional[List[AutomationAction]] = None
    filters:          Optional[List[AutomationFilter]] = None
    webhook_url:      Optional[str] = None
    field_map:        Optional[List[AutomationFieldMap]] = None
    custom_headers:   Optional[Dict[str, str]] = None


class AutomationOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id:                 str
    name:               str
    enabled:            bool
    steps:              Optional[List[Dict[str, Any]]] = None   # new pipeline
    required_fields:    List[str] = ['email']
    actions:            List[AutomationAction] = []
    filters:            List[AutomationFilter] = []
    webhook_url:        Optional[str] = None
    field_map:          List[AutomationFieldMap] = []
    custom_headers:     Optional[Dict[str, str]] = None
    created_at:         datetime
    updated_at:         datetime
    last_triggered_at:  Optional[datetime] = None
    trigger_count:      int = 0


class AutomationRunOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id:             str
    automation_id:  str
    action_id:      Optional[str] = None    # which action step fired
    action_name:    Optional[str] = None    # human-readable step name
    run_type:       str
    contact_id:     Optional[str] = None
    contact_email:  Optional[str] = None
    contact_name:   Optional[str] = None
    fbclid:         Optional[str] = None
    payload:        Dict[str, Any] = {}
    webhook_url:    str
    http_status:    Optional[int] = None
    response_body:  Optional[str] = None
    success:        bool
    error:          Optional[str] = None
    duration_ms:    Optional[int] = None
    triggered_at:   datetime


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
            'fbclid', 'fbc', 'fbp',  # fbc/fbp are Facebook cookies for CAPI
            'gclid', 'ttclid', 'source_link_tag', 'fb_ad_set_id', 'google_campaign_id'
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
    """Recursively remove None values so MongoDB never stores null sub-fields."""
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


def parse_full_name(full_name: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a full name string into (first_name, last_name).
    
    Logic:
    - Single word: first_name only, no last_name
    - Two words: first = first_name, second = last_name
    - Three+ words: 
      - If last word is hyphenated (e.g., "Smith-Jones"), all before it = first_name
      - Otherwise: first N-1 words = first_name, last word = last_name
    - Hyphenated first names (e.g., "Mary-Jane") stay together as first_name
    
    Examples:
    - "John" → ("John", None)
    - "John Smith" → ("John", "Smith")
    - "John Paul Smith" → ("John Paul", "Smith")
    - "Mary-Jane Watson" → ("Mary-Jane", "Watson")
    - "John Smith-Jones" → ("John", "Smith-Jones")
    - "John Paul Smith-Jones" → ("John Paul", "Smith-Jones")
    """
    if not full_name or not isinstance(full_name, str):
        return (None, None)
    
    # Clean and normalize
    name = ' '.join(full_name.strip().split())  # Normalize whitespace
    if not name:
        return (None, None)
    
    parts = name.split()
    
    if len(parts) == 1:
        # Single name - treat as first name only
        return (parts[0], None)
    
    if len(parts) == 2:
        # Two names - simple first/last split
        return (parts[0], parts[1])
    
    # Three or more parts
    # Last word is the last name, everything else is first name
    last_name = parts[-1]
    first_name = ' '.join(parts[:-1])
    
    return (first_name, last_name)


def _tz_day_start(date_str: str, tz_name: Optional[str]) -> str:
    """UTC ISO string for 00:00:00 of date_str in tz_name. Falls back to treating date as UTC."""
    try:
        from zoneinfo import ZoneInfo
        z = ZoneInfo(tz_name) if tz_name else timezone.utc
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return dt_to_str(datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=z).astimezone(timezone.utc))
    except Exception:
        return date_str


def _tz_day_end(date_str: str, tz_name: Optional[str]) -> str:
    """UTC ISO string for 23:59:59.999999 of date_str in tz_name. Falls back to treating date as UTC."""
    try:
        from zoneinfo import ZoneInfo
        z = ZoneInfo(tz_name) if tz_name else timezone.utc
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return dt_to_str(datetime(d.year, d.month, d.day, 23, 59, 59, 999999, tzinfo=z).astimezone(timezone.utc))
    except Exception:
        return date_str.split("T")[0] + "T23:59:59.999999+00:00"


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
        # Store user_agent if provided and not already set (first-seen wins)
        if data.get('user_agent') and not existing.get('user_agent'):
            update['user_agent'] = data['user_agent'][:1000]  # Truncate to prevent bloat
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
            'fbclid', 'fbc', 'fbp',  # fbc/fbp are FB cookies for CAPI matching
            'gclid', 'ttclid', 'source_link_tag', 'fb_ad_set_id', 'google_campaign_id'
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
            user_agent=data.get('user_agent')[:1000] if data.get('user_agent') else None,
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
        try:
            await db.contacts.insert_one(cdoc)
        except DuplicateKeyError:
            # Race condition: two concurrent requests both saw "no existing document"
            # and both tried to insert. The second one wins with a graceful update
            # instead of crashing the endpoint with a 500.
            logger.info(f"DuplicateKey on insert for {cid[:12]} — falling back to update")
            update: dict = {"updated_at": dt_to_str(now)}
            for field in ['name', 'email', 'phone', 'first_name', 'last_name', 'session_id']:
                if data.get(field):
                    update[field] = data[field]
            if client_ip:
                update.setdefault('client_ip', client_ip)
            await db.contacts.update_one({"contact_id": cid}, {"$set": update})


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


def _build_webhook_payload(contact: dict, field_map: list, exclude_nulls: bool = False) -> dict:
    attr = contact.get('attribution') or {}
    src = {
        'email': contact.get('email'), 'name': contact.get('name'),
        'first_name': contact.get('first_name'), 'last_name': contact.get('last_name'),
        'phone': contact.get('phone'), 'contact_id': contact.get('contact_id'),
        'client_ip': contact.get('client_ip'),
        'user_agent': contact.get('user_agent'),  # For FB CAPI: client_user_agent
        'created_at': dt_to_str(contact.get('created_at')),
        'updated_at': dt_to_str(contact.get('updated_at')),
        'utm_source': attr.get('utm_source'), 'utm_medium': attr.get('utm_medium'),
        'utm_campaign': attr.get('utm_campaign'), 'utm_term': attr.get('utm_term'),
        'utm_content': attr.get('utm_content'), 'utm_id': attr.get('utm_id'),
        'campaign_id': attr.get('campaign_id'), 'adset_id': attr.get('adset_id'),
        'ad_id': attr.get('ad_id'), 'fbclid': attr.get('fbclid'),
        'fbc': attr.get('fbc'),       # Facebook Click ID cookie (_fbc)
        'fbp': attr.get('fbp'),       # Facebook Browser ID cookie (_fbp)
    }
    
    # Filter out null/empty values if exclude_nulls is True
    if exclude_nulls:
        src = {k: v for k, v in src.items() if v is not None and v != ''}
    
    if not field_map:
        return {k: v for k, v in src.items() if v is not None}
    payload = {}
    for m in field_map:
        s = m.get('source') if isinstance(m,dict) else getattr(m,'source','')
        t = (m.get('target') if isinstance(m,dict) else getattr(m,'target','')) or s
        if s in src:
            val = src[s]
            # Skip null values if exclude_nulls is enabled
            if exclude_nulls and (val is None or val == ''):
                continue
            payload[t] = val
    return payload


async def _fire_webhook_task(
    auto_id: str, url: str, payload: dict, headers: dict,
    run_type: str = "live", contact: Optional[dict] = None,
    fbclid: Optional[str] = None,
    action_id: Optional[str] = None,
    action_name: Optional[str] = None,
    delay_seconds: int = 0,
    field_map: Optional[list] = None,   # needed to rebuild payload after refetch
    exclude_nulls: bool = False,        # filter null values from payload
) -> None:
    """Fire a webhook, persist the run record, and update automation stats.
    If delay_seconds > 0: sleep first, then re-read the contact from the DB
    so the payload contains the freshest data available at fire time."""

    # ── Optional wait + refetch ───────────────────────────────────────────────
    if delay_seconds > 0 and contact:
        cid = contact.get("contact_id")
        logger.info(
            f"Automation {auto_id[:8]} action '{action_name or action_id or 'step'}' "
            f"waiting {delay_seconds}s before firing for {(cid or '')[:12]}"
        )
        await asyncio.sleep(delay_seconds)
        if cid:
            fresh = await db.contacts.find_one({"contact_id": cid}, {"_id": 0})
            if fresh:
                contact = fresh
                payload = _build_webhook_payload(fresh, field_map or [], exclude_nulls=exclude_nulls)
                logger.info(
                    f"Automation {auto_id[:8]} refetched {cid[:12]} after {delay_seconds}s "
                    f"— phone={'yes' if fresh.get('phone') else 'no'}"
                )
    # ─────────────────────────────────────────────────────────────────────────

    import time
    start         = time.monotonic()
    http_status   = None
    response_body = None
    success       = False
    error_msg     = None

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
        "action_id":     action_id,
        "action_name":   action_name,
        "run_type":      run_type,
        "contact_id":    contact.get("contact_id")  if contact else None,
        "contact_email": contact.get("email")        if contact else None,
        "contact_name":  contact.get("name")         if contact else None,
        "fbclid":        fbclid,
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


async def _execute_step_pipeline(
    auto_id: str, steps: list, contact: dict, fbclid: Optional[str]
) -> None:
    """Execute the new Zapier-style step pipeline sequentially.
    
    Steps types:
    - wait_for: Check if required fields are present (abort pipeline if not)
    - filter: Evaluate filter conditions (abort pipeline if not matched)
    - delay: Wait N seconds and refetch contact data
    - webhook: Fire webhook with optional field mapping
    """
    contact_id = contact.get('contact_id', '')
    logger.info(f"Automation {auto_id[:8]} executing {len(steps)} step(s) for contact {contact_id[:8]}")
    
    for idx, step in enumerate(steps):
        step_type = step.get('type', '')
        config = step.get('config', {})
        step_id = step.get('id', f'step-{idx}')
        
        try:
            if step_type == 'wait_for':
                # Check required fields - abort if any missing
                fields = config.get('fields', ['email'])
                missing = [f for f in fields if not _get_contact_field(contact, f)]
                if missing:
                    logger.info(
                        f"Automation {auto_id[:8]} step {idx+1} (wait_for) waiting for {missing} "
                        f"on contact {contact_id[:8]} — pipeline aborted, will retry later"
                    )
                    return  # Abort pipeline - will retry when fields arrive
                logger.info(f"Automation {auto_id[:8]} step {idx+1} (wait_for) passed — all fields present")
                
            elif step_type == 'filter':
                # Evaluate filter conditions - abort if not matched
                filters = config.get('filters', [])
                if filters and not _evaluate_filters(contact, filters):
                    logger.info(
                        f"Automation {auto_id[:8]} step {idx+1} (filter) not matched "
                        f"for contact {contact_id[:8]} — pipeline aborted"
                    )
                    return  # Abort pipeline - contact doesn't match
                logger.info(f"Automation {auto_id[:8]} step {idx+1} (filter) passed")
                
            elif step_type == 'delay':
                # Wait and refetch contact data
                seconds = int(config.get('seconds', 0))
                if seconds > 0:
                    logger.info(
                        f"Automation {auto_id[:8]} step {idx+1} (delay) waiting {seconds}s "
                        f"for contact {contact_id[:8]}"
                    )
                    await asyncio.sleep(seconds)
                    # Refetch contact with latest data
                    fresh = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
                    if fresh:
                        contact = fresh
                        logger.info(
                            f"Automation {auto_id[:8]} step {idx+1} (delay) refetched contact — "
                            f"phone={'yes' if fresh.get('phone') else 'no'}"
                        )
                        
            elif step_type == 'webhook':
                # Fire webhook with field mapping
                url = config.get('url', '')
                if not url:
                    logger.warning(
                        f"Automation {auto_id[:8]} step {idx+1} (webhook) has no URL — skipping"
                    )
                    continue
                    
                step_name = config.get('name', '')
                field_map = config.get('field_map', [])
                exclude_nulls = config.get('exclude_nulls', True)  # Default to excluding nulls
                payload = _build_webhook_payload(contact, field_map, exclude_nulls=exclude_nulls)
                headers = {"Content-Type": "application/json"}
                
                logger.info(
                    f"Automation {auto_id[:8]} step {idx+1} (webhook) firing to {url[:50]}..."
                )
                
                # Fire webhook (not in background - sequential execution)
                await _fire_webhook_task(
                    auto_id, url, payload, headers,
                    run_type="live", contact=contact, fbclid=fbclid,
                    action_id=step_id, action_name=step_name or f"Webhook Step {idx+1}",
                    delay_seconds=0,  # delay handled separately
                    field_map=field_map,
                    exclude_nulls=exclude_nulls,
                )
                
            else:
                logger.warning(f"Automation {auto_id[:8]} unknown step type: {step_type}")
                
        except Exception as e:
            logger.error(f"Automation {auto_id[:8]} step {idx+1} error: {e}")
            # Continue to next step on error (could also abort - configurable later)
    
    logger.info(f"Automation {auto_id[:8]} pipeline completed for contact {contact_id[:8]}")


async def _run_automations(contact_id: str) -> None:
    contact = await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})
    if not contact or not (contact.get('email') or contact.get('phone')):
        return

    fbclid = (contact.get('attribution') or {}).get('fbclid') or None

    automations = await db.automations.find({"enabled": True}, {"_id": 0}).to_list(100)
    for auto in automations:
        try:
            # ── New step-based pipeline ─────────────────────────────────────
            # If automation has steps[], use the new pipeline execution
            steps = auto.get('steps')
            if steps and len(steps) > 0:
                # Check for wait_for step at start to determine if we should dedup
                first_wait_for = next((s for s in steps if s.get('type') == 'wait_for'), None)
                if first_wait_for:
                    required = first_wait_for.get('config', {}).get('fields', ['email'])
                    missing = [rf for rf in required if not _get_contact_field(contact, rf)]
                    if missing:
                        logger.info(
                            f"Automation {auto['id'][:8]} waiting for {missing} "
                            f"on contact {contact_id[:8]} — will retry when fields arrive"
                        )
                        continue  # no dedup entry written — will try again
                
                # Check for filter step to determine if contact matches
                first_filter = next((s for s in steps if s.get('type') == 'filter'), None)
                if first_filter:
                    filters = first_filter.get('config', {}).get('filters', [])
                    if filters and not _evaluate_filters(contact, filters):
                        continue  # Contact doesn't match, skip
                
                # Dedup check for step-based automations
                dedup_key = f"{auto['id']}:{contact_id}:{fbclid or 'nofbclid'}"
                now_str = dt_to_str(datetime.now(timezone.utc))
                result = await db.automation_dedup.find_one_and_update(
                    {"dedup_key": dedup_key},
                    {"$setOnInsert": {
                        "dedup_key":     dedup_key,
                        "automation_id": auto['id'],
                        "contact_id":    contact_id,
                        "fbclid":        fbclid,
                        "created_at":    now_str,
                    }},
                    upsert=True,
                    return_document=False,
                )
                if result is not None:
                    logger.info(
                        f"Automation {auto['id'][:8]} deduped for {contact_id[:8]} "
                        f"(fbclid={fbclid[:12] if fbclid else 'none'})"
                    )
                    continue
                
                # Execute the step pipeline
                asyncio.create_task(
                    _execute_step_pipeline(auto['id'], steps, contact, fbclid)
                )
                continue  # Done with this automation
            # ─────────────────────────────────────────────────────────────────
            
            # ── Legacy automation execution (no steps) ──────────────────────
            if not _evaluate_filters(contact, auto.get('filters', [])):
                continue

            # ── Required fields gate ─────────────────────────────────────────
            required = auto.get('required_fields') or ['email']
            missing  = [rf for rf in required if not _get_contact_field(contact, rf)]
            if missing:
                logger.info(
                    f"Automation {auto['id'][:8]} waiting for {missing} "
                    f"on contact {contact_id[:8]} — will retry when fields arrive"
                )
                continue   # no dedup entry written — will try again
            # ─────────────────────────────────────────────────────────────────

            # ── Atomic dedup ─────────────────────────────────────────────────
            dedup_key = f"{auto['id']}:{contact_id}:{fbclid or 'nofbclid'}"
            now_str   = dt_to_str(datetime.now(timezone.utc))
            result    = await db.automation_dedup.find_one_and_update(
                {"dedup_key": dedup_key},
                {"$setOnInsert": {
                    "dedup_key":     dedup_key,
                    "automation_id": auto['id'],
                    "contact_id":    contact_id,
                    "fbclid":        fbclid,
                    "created_at":    now_str,
                }},
                upsert=True,
                return_document=False,
            )
            if result is not None:
                logger.info(
                    f"Automation {auto['id'][:8]} deduped for {contact_id[:8]} "
                    f"(fbclid={fbclid[:12] if fbclid else 'none'})"
                )
                continue
            # ─────────────────────────────────────────────────────────────────

            # Resolve the action steps — support both new `actions` array and
            # legacy single `webhook_url` field on old automations.
            raw_actions = auto.get('actions') or []
            if not raw_actions and auto.get('webhook_url'):
                raw_actions = [{
                    'id':           'legacy',
                    'name':         None,
                    'webhook_url':  auto['webhook_url'],
                    'field_map':    auto.get('field_map', []),
                    'custom_headers': auto.get('custom_headers') or {},
                }]

            for action in raw_actions:
                if not action.get('webhook_url'):
                    continue
                fm      = action.get('field_map') or auto.get('field_map', [])
                payload = _build_webhook_payload(contact, fm)
                hdrs    = {"Content-Type": "application/json"}
                hdrs.update(action.get('custom_headers') or auto.get('custom_headers') or {})
                asyncio.create_task(
                    _fire_webhook_task(
                        auto['id'], action['webhook_url'], payload, hdrs,
                        run_type="live", contact=contact, fbclid=fbclid,
                        action_id=action.get('id'), action_name=action.get('name'),
                        delay_seconds=int(action.get('delay_seconds') or 0),
                        field_map=fm,
                    )
                )
        except Exception as e:
            logger.error(f"Automation eval error {auto.get('id','?')}: {e}")


# ─────────────────────────── Tracker JS ───────────────────────────

def build_tracker_js(backend_url: str, auto_tag: str = '') -> str:
    return r"""/**
 * Shumard - Lead Attribution & Cross-Frame Identity Script
 * Architecture: Hyros-style field capture + postMessage cross-frame stitching
 */
(function () {
  'use strict';

  var BACKEND_URL = '""" + backend_url + r"""';
  var API_BASE    = BACKEND_URL + '/api';
  var AUTO_TAG    = '""" + auto_tag + r"""';   /* injected by server when ?tag=... is in script src */

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
        // Always refresh fbc/fbp cookies (they may have been set after initial cache)
        var fbc = getCookie('_fbc');
        var fbp = getCookie('_fbp');
        var needsUpdate = false;
        if (fbc && store.source.fbc !== fbc) { store.source.fbc = fbc; needsUpdate = true; }
        if (fbp && store.source.fbp !== fbp) { store.source.fbp = fbp; needsUpdate = true; }
        // Save updated attribution if fbc/fbp changed
        if (needsUpdate) {
          lsSet(ATTR_KEY, JSON.stringify(store.source));
        }
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

    /* Capture Facebook cookies (_fbc and _fbp) for FB CAPI matching */
    var fbc = getCookie('_fbc');
    var fbp = getCookie('_fbp');
    if (fbc) { store.source.fbc = fbc; found = true; }
    if (fbp) { store.source.fbp = fbp; found = true; }

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
      attribution:  store.source,
      user_agent:   navigator.userAgent || null   /* For FB CAPI: client_user_agent */
    }, extra || {});
  }

  /* ─── Tracking calls ─── */
  function sendPageview() {
    if (store.processedData.pageSent) return;
    store.processedData.pageSent = true;
    send('/track/pageview', buildPayload());
  }

  function sendLead(fields) {
    /* Refresh fbc/fbp from cookies right before sending (FB Pixel may have set them) */
    var fbc = getCookie('_fbc');
    var fbp = getCookie('_fbp');
    if (fbc && store.source.fbc !== fbc) { store.source.fbc = fbc; lsSet(ATTR_KEY, JSON.stringify(store.source)); }
    if (fbp && store.source.fbp !== fbp) { store.source.fbp = fbp; lsSet(ATTR_KEY, JSON.stringify(store.source)); }
    
    var email = fields && fields.email;
    var phone = fields && fields.phone;
    if (email || phone) {
      var parts = [];
      if (email) parts.push('email: ' + email);
      if (phone) parts.push('phone: ' + phone);
      logger('Tethered!');
    }
    send('/track/lead', buildPayload(fields));
  }

  function sendRegistration(fields) {
    /* Refresh fbc/fbp from cookies right before sending (FB Pixel may have set them) */
    var fbc = getCookie('_fbc');
    var fbp = getCookie('_fbp');
    if (fbc && store.source.fbc !== fbc) { store.source.fbc = fbc; lsSet(ATTR_KEY, JSON.stringify(store.source)); }
    if (fbp && store.source.fbp !== fbp) { store.source.fbp = fbp; lsSet(ATTR_KEY, JSON.stringify(store.source)); }
    
    var parts = [];
    if (fields && fields.email) parts.push('email: ' + fields.email);
    if (fields && fields.phone) parts.push('phone: ' + fields.phone);
    if (fields && fields.name)  parts.push('name: ' + fields.name);
    if (parts.length) logger('Tethered!');
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

    /* ─── Delayed fbc/fbp re-capture ─── */
    /* Facebook Pixel often sets _fbc/_fbp cookies AFTER initial page load.
       Re-check cookies after a delay to capture them if FB Pixel was slow. */
    setTimeout(function() {
      var fbc = getCookie('_fbc');
      var fbp = getCookie('_fbp');
      if ((fbc && store.source.fbc !== fbc) || (fbp && store.source.fbp !== fbp)) {
        if (fbc) store.source.fbc = fbc;
        if (fbp) store.source.fbp = fbp;
        lsSet(ATTR_KEY, JSON.stringify(store.source));
        logger('FB cookies captured (delayed)', {fbc: fbc, fbp: fbp});
      }
    }, 2000);  /* 2 second delay for FB Pixel to set cookies */

    /* ─── Auto-tag: fire when script was loaded with ?tag=... ─── */
    if (AUTO_TAG) {
      send('/track/tag', {
        contact_id: store.config.contactId,
        session_id: store.config.sessionId || null,
        tag:        AUTO_TAG
      });
      logger('Tethered!');
    }

    /* Parent page: broadcast session identity to iframes */
    if (!store.config.isIframe) {
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
async def get_shumard_js(tag: Optional[str] = None):
    backend_url = os.environ.get('REACT_APP_BACKEND_URL', '')
    # Sanitise tag: alphanumeric + dash/underscore, max 64 chars, no JS injection
    safe_tag = ''
    if tag:
        import re
        safe_tag = re.sub(r'[^a-zA-Z0-9_\-]', '', tag)[:64]
    return PlainTextResponse(
        content=build_tracker_js(backend_url, auto_tag=safe_tag),
        media_type="application/javascript",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Access-Control-Allow-Origin": "*"}
    )


@api_router.post("/track/tag")
async def track_tag(data: TagCreate, request: Request):
    """
    Add a tag to a contact.  Called automatically by the script when loaded with ?tag=...
    Uses $addToSet so the tag is stored exactly once no matter how many times the page loads.
    """
    try:
        now = datetime.now(timezone.utc)
        ip  = get_client_ip(request)
        eid = await _resolve_contact_id(data.contact_id)

        # Create the contact if it doesn't exist yet (e.g. thank-you page without prior pageview)
        existing = await db.contacts.find_one({"contact_id": eid}, {"_id": 0})
        if existing:
            await db.contacts.update_one(
                {"contact_id": eid},
                {"$addToSet": {"tags": data.tag},
                 "$set":      {"updated_at": dt_to_str(now)}}
            )
        else:
            # Minimal contact — no email yet, but we have a contact_id and tag
            contact = Contact(
                contact_id=eid,
                session_id=data.session_id,
                client_ip=ip,
                tags=[data.tag],
                created_at=now,
                updated_at=now,
            )
            cdoc = strip_nulls(contact.model_dump())
            cdoc['created_at'] = dt_to_str(now)
            cdoc['updated_at'] = dt_to_str(now)
            cdoc['tags']       = [data.tag]
            await db.contacts.insert_one(cdoc)

        logger.info(f"Tag '{data.tag}' applied to contact {eid[:12]}...")
        # Attempt to stitch by IP in case this is a thank-you page visit
        await _ip_auto_stitch(eid, ip, now)
        return {"status": "ok", "contact_id": data.contact_id, "tag": data.tag}
    except Exception as e:
        logger.error(f"Error applying tag: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/track/pageview")
async def track_pageview(data: PageViewCreate, request: Request):
    try:
        now = datetime.now(timezone.utc)
        ip  = get_client_ip(request)
        # Always resolve the effective (non-merged) contact_id before any operation
        eid = await _resolve_contact_id(data.contact_id)
        await _upsert_contact({
            'contact_id': eid, 'session_id': data.session_id,
            'attribution': data.attribution, 'user_agent': data.user_agent
        }, now, ip)
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
            'attribution': data.attribution, 'user_agent': data.user_agent
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
            'attribution': data.attribution, 'user_agent': data.user_agent
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

        contacts_raw = await db.contacts.find(query, {"_id": 0}).sort("updated_at", -1).to_list(10000)
        if not contacts_raw:
            return []

        # Batch all visit counts in ONE aggregation instead of one query per contact.
        # With thousands of contacts the per-contact approach times out.
        contact_ids   = [c['contact_id'] for c in contacts_raw]
        visit_pipeline = [
            {"$match":   {"contact_id": {"$in": contact_ids}}},
            {"$group":   {"_id": "$contact_id", "count": {"$sum": 1}}},
        ]
        visit_counts_raw = await db.page_visits.aggregate(visit_pipeline).to_list(len(contact_ids) + 1)
        visit_count_map  = {v["_id"]: v["count"] for v in visit_counts_raw}

        result = []
        for c in contacts_raw:
            fix_contact_doc(c)
            c['visit_count'] = visit_count_map.get(c['contact_id'], 0)
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
        # Attach linked sales
        sales_raw = await db.sales.find({"contact_id": contact_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
        contact['sales'] = [
            SaleBasic(
                id         = s["id"],
                amount     = s.get("amount"),
                currency   = s.get("currency", "USD"),
                product    = s.get("product"),
                status     = s.get("status"),
                source     = s.get("source"),
                created_at = str_to_dt(s["created_at"]),
            )
            for s in sales_raw
        ]
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


class LeadsExportRequest(BaseModel):
    ids:    Optional[List[str]] = None   # specific contact IDs (PDF export path)
    since:  Optional[str] = None
    until:  Optional[str] = None
    tz:     Optional[str] = None
    search: Optional[str] = None
    limit:  int = 5000


@api_router.post("/leads/export")
async def export_contacts(body: LeadsExportRequest):
    limit:  int = 5000


@api_router.post("/leads/export")
async def export_contacts(body: LeadsExportRequest):
    """
    Returns identified contacts (with email/phone/name) including their full
    page-visit history. Used by the PDF export on the Leads page.
    Date filters use the same timezone-aware day-bound logic as /automations/runs.
    """
    from collections import defaultdict

    query: dict = {
        "merged_into": None,
        "$or": [
            {"email": {"$ne": None}},
            {"phone": {"$ne": None}},
            {"name":  {"$ne": None}},
        ],
    }

    # If specific IDs provided (PDF export path), skip other filters for efficiency
    if body.ids:
        query = {"contact_id": {"$in": body.ids}, "merged_into": None}


    # Date filter on updated_at (when the lead was last identified)
    if body.since or body.until:
        ts_filter: dict = {}
        if body.since:
            ts_filter["$gte"] = _tz_day_start(body.since, body.tz)
        if body.until:
            ts_filter["$lte"] = _tz_day_end(body.until, body.tz)
        query["updated_at"] = ts_filter

    # Optional text search
    if body.search:
        sq = {"$regex": body.search, "$options": "i"}
        query["$and"] = [{"$or": [{"email": sq}, {"name": sq}, {"phone": sq}]}]

    try:
        contacts_raw = await db.contacts.find(query, {"_id": 0}) \
            .sort("updated_at", -1).limit(body.limit).to_list(body.limit)

        if not contacts_raw:
            return []

        # Batch fetch ALL page visits for these contacts in one query
        cids = [c["contact_id"] for c in contacts_raw]
        visits_raw = await db.page_visits.find(
            {"contact_id": {"$in": cids}},
            {"_id": 0, "contact_id": 1, "current_url": 1, "timestamp": 1, "page_title": 1}
        ).sort("timestamp", 1).to_list(200_000)

        visits_map: dict = defaultdict(list)
        for v in visits_raw:
            visits_map[v["contact_id"]].append({
                "url":       v.get("current_url", ""),
                "timestamp": v.get("timestamp", ""),
                "title":     v.get("page_title", ""),
            })

        result = []
        for c in contacts_raw:
            fix_contact_doc(c)
            result.append({
                "contact_id":      c.get("contact_id"),
                "name":            c.get("name"),
                "email":           c.get("email"),
                "phone":           c.get("phone"),
                "client_ip":       c.get("client_ip"),
                "session_id":      c.get("session_id"),
                "tags":            c.get("tags"),
                "merged_children": c.get("merged_children"),
                "merged_into":     c.get("merged_into"),
                "created_at":      dt_to_str(c.get("created_at")) if c.get("created_at") else None,
                "updated_at":      dt_to_str(c.get("updated_at")) if c.get("updated_at") else None,
                "visits":          visits_map.get(c.get("contact_id"), []),
            })
        return result
    except Exception as e:
        logger.error(f"Export error: {e}")
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

def _validate_automation_steps(steps: Optional[List[Dict[str, Any]]]) -> None:
    """Validate automation steps before saving.
    Raises HTTPException with 400 status if validation fails."""
    if not steps:
        return  # Legacy automation without steps - skip validation
    
    for idx, step in enumerate(steps):
        step_type = step.get('type', '')
        config = step.get('config', {})
        step_num = idx + 1
        
        if step_type == 'webhook':
            url = config.get('url', '').strip()
            if url and not (url.startswith('http://') or url.startswith('https://')):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Step {step_num}: Webhook URL must start with http:// or https://"
                )
        
        elif step_type == 'filter':
            filters = config.get('filters', [])
            for f in filters:
                operator = f.get('operator', '')
                value = f.get('value', '')
                # Operators that require a value
                if operator in ['equals', 'not_equals', 'contains']:
                    if not value or not value.strip():
                        field = f.get('field', 'unknown')
                        raise HTTPException(
                            status_code=400,
                            detail=f"Step {step_num}: Filter condition on '{field}' with operator '{operator}' requires a value"
                        )
        
        elif step_type == 'wait_for':
            fields = config.get('fields', [])
            if not fields:
                raise HTTPException(
                    status_code=400,
                    detail=f"Step {step_num}: Wait For step must have at least one required field"
                )


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
        # Validate steps if provided
        _validate_automation_steps(data.steps)
        
        now = datetime.now(timezone.utc)
        doc = {
            "id":              str(uuid.uuid4()),
            "name":            data.name,
            "enabled":         data.enabled,
            "steps":           data.steps,  # New steps format
            "required_fields": data.required_fields,
            "actions":         [a.model_dump() for a in data.actions],
            "filters":         [f.model_dump() for f in data.filters],
            # Legacy single-webhook fields
            "webhook_url":     data.webhook_url,
            "field_map":       [m.model_dump() for m in data.field_map],
            "custom_headers":  data.custom_headers or {},
            "created_at":      dt_to_str(now),
            "updated_at":      dt_to_str(now),
            "last_triggered_at": None,
            "trigger_count":   0,
        }
        await db.automations.insert_one(doc)
        doc['created_at'] = now
        doc['updated_at'] = now
        return AutomationOut(**doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/automations/{auto_id}", response_model=AutomationOut)
async def get_automation(auto_id: str):
    """Get a single automation by ID."""
    try:
        doc = await db.automations.find_one({"id": auto_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Automation not found")
        doc['created_at'] = str_to_dt(doc['created_at'])
        doc['updated_at'] = str_to_dt(doc['updated_at'])
        if doc.get('last_triggered_at'):
            doc['last_triggered_at'] = str_to_dt(doc['last_triggered_at'])
        return AutomationOut(**doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.put("/automations/{auto_id}", response_model=AutomationOut)
async def update_automation(auto_id: str, data: AutomationUpdate):
    try:
        existing = await db.automations.find_one({"id": auto_id}, {"_id": 0})
        if not existing:
            raise HTTPException(status_code=404, detail="Automation not found")
        
        # Validate steps if provided
        if data.steps is not None:
            _validate_automation_steps(data.steps)
        
        now = datetime.now(timezone.utc)
        update: dict = {"updated_at": dt_to_str(now)}
        if data.name            is not None: update["name"]            = data.name
        if data.enabled         is not None: update["enabled"]         = data.enabled
        if data.steps           is not None: update["steps"]           = data.steps
        if data.required_fields is not None: update["required_fields"] = data.required_fields
        if data.actions         is not None: update["actions"]         = [a.model_dump() for a in data.actions]
        if data.webhook_url     is not None: update["webhook_url"]     = data.webhook_url
        if data.filters         is not None: update["filters"]         = [f.model_dump() for f in data.filters]
        if data.field_map       is not None: update["field_map"]       = [m.model_dump() for m in data.field_map]
        if data.custom_headers  is not None: update["custom_headers"]  = data.custom_headers
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

    # Resolve webhook URL and field_map from actions[] (new) or legacy webhook_url (old)
    raw_actions = auto.get('actions') or []
    if raw_actions:
        # Test fires the first action
        first_action = raw_actions[0]
        test_url     = first_action.get('webhook_url', '')
        test_fm      = first_action.get('field_map') or auto.get('field_map', [])
        action_id    = first_action.get('id')
        action_name  = first_action.get('name')
    else:
        test_url     = auto.get('webhook_url', '')
        test_fm      = auto.get('field_map', [])
        action_id    = None
        action_name  = None

    if not test_url:
        raise HTTPException(status_code=400, detail="Automation has no webhook URL configured")

    payload = _build_webhook_payload(contact, test_fm)
    payload['_tether_test'] = True
    hdrs = {"Content-Type": "application/json"}
    hdrs.update(auto.get('custom_headers') or
                (raw_actions[0].get('custom_headers') if raw_actions else None) or {})

    # Fire synchronously so we can return the full result immediately
    import time
    start         = time.monotonic()
    http_status   = None
    response_body = None
    response_hint = None
    success       = False
    error_msg     = None

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.post(test_url, json=payload, headers=hdrs)
            http_status = resp.status_code
            raw_text    = resp.text.strip() if resp.text else ''
            response_body = raw_text[:2000] if raw_text else None
            success       = 200 <= resp.status_code < 300

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
        "action_id":     action_id,
        "action_name":   action_name,
        "run_type":      "test",
        "contact_id":    contact.get("contact_id"),
        "contact_email": contact.get("email"),
        "contact_name":  contact.get("name"),
        "payload":       payload,
        "webhook_url":   test_url,
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
async def get_automation_runs(
    auto_id: str,
    limit: int = 2000,
    since: Optional[str] = None,    # YYYY-MM-DD in user's timezone
    until: Optional[str] = None,    # YYYY-MM-DD in user's timezone
    run_type: Optional[str] = None, # 'live' | 'test' | None
    tz: Optional[str] = None,       # IANA timezone name, e.g. "America/New_York"
):
    """Return execution history for a specific automation, newest first.
    since/until are date strings in the user's timezone; tz converts them to
    exact UTC bounds so the filter matches the user's local day correctly."""
    auto = await db.automations.find_one({"id": auto_id}, {"_id": 0, "id": 1})
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")

    match: dict = {"automation_id": auto_id}
    if since or until:
        ts_filter: dict = {}
        if since:
            ts_filter["$gte"] = _tz_day_start(since, tz)
        if until:
            ts_filter["$lte"] = _tz_day_end(until, tz)
        match["triggered_at"] = ts_filter
    if run_type in ("live", "test"):
        match["run_type"] = run_type

    runs = await db.automation_runs.find(match, {"_id": 0}) \
        .sort("triggered_at", -1) \
        .limit(limit) \
        .to_list(limit)

    result = []
    for r in runs:
        r["triggered_at"] = str_to_dt(r.get("triggered_at"))
        result.append(AutomationRunOut(**r))
    return result


@api_router.post("/automations/{auto_id}/runs/{run_id}/retry")
async def retry_automation_run(auto_id: str, run_id: str):
    """
    Re-fire a specific run using its original payload and webhook URL.
    Creates a new run record so history is preserved; marks the run_type as 'retry'.
    """
    # Fetch the original run
    original = await db.automation_runs.find_one(
        {"id": run_id, "automation_id": auto_id}, {"_id": 0}
    )
    if not original:
        raise HTTPException(status_code=404, detail="Run not found")

    # Fetch the automation to get current webhook URL / headers
    auto = await db.automations.find_one({"id": auto_id}, {"_id": 0})
    if not auto:
        raise HTTPException(status_code=404, detail="Automation not found")

    # Use the URL that actually fired originally (stored in the run),
    # falling back to the automation's current config only if missing.
    payload = original.get("payload") or {}
    url     = original.get("webhook_url") or auto.get("webhook_url", "")
    if not url:
        raise HTTPException(status_code=400, detail="Automation has no webhook URL configured")
    hdrs    = {"Content-Type": "application/json"}
    if auto.get("custom_headers"):
        hdrs.update(auto["custom_headers"])

    # Fire synchronously so we can return the result immediately
    import time
    start         = time.monotonic()
    http_status   = None
    response_body = None
    success       = False
    error_msg     = None

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.post(url, json=payload, headers=hdrs)
            http_status   = resp.status_code
            raw_text      = resp.text.strip() if resp.text else ''
            response_body = raw_text[:2000] if raw_text else None
            success       = 200 <= resp.status_code < 300
    except httpx.TimeoutException:
        error_msg = "Request timed out after 30 seconds."
    except Exception as e:
        error_msg = str(e)

    duration_ms = round((time.monotonic() - start) * 1000)
    now         = datetime.now(timezone.utc)

    # Store as a new run (type = "retry") so history is preserved
    run_doc = {
        "id":            str(uuid.uuid4()),
        "automation_id": auto_id,
        "run_type":      "retry",
        "contact_id":    original.get("contact_id"),
        "contact_email": original.get("contact_email"),
        "contact_name":  original.get("contact_name"),
        "fbclid":        original.get("fbclid"),
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
    await db.automations.update_one(
        {"id": auto_id},
        {"$set": {"last_triggered_at": dt_to_str(now)}}
    )

    return {
        "status":        "ok" if success else "error",
        "run_id":        run_doc["id"],
        "http_status":   http_status,
        "response_body": response_body,
        "duration_ms":   duration_ms,
        "success":       success,
        "error":         error_msg,
    }




# ─────────────────────────── Sales ───────────────────────────

def _nested_get(obj: Any, path: str) -> Any:
    """Get a value from a nested dict/list using dot notation, e.g. 'customer.email'."""
    if not isinstance(obj, (dict, list)):
        return None
    if '.' not in path:
        if isinstance(obj, dict):
            return obj.get(path)
        try:
            return obj[int(path)]
        except Exception:
            return None
    head, tail = path.split('.', 1)
    child = obj.get(head) if isinstance(obj, dict) else None
    if child is None and isinstance(obj, list):
        try:
            child = obj[int(head)]
        except Exception:
            return None
    return _nested_get(child, tail) if child is not None else None


def _extract_sale_fields(payload: dict) -> dict:
    """
    Extract standardised sale fields from any webhook payload.
    Handles Stripe, Kajabi, GoHighLevel, generic CRMs, etc.
    """
    # ── email ──────────────────────────────────────────────────
    email = None
    for path in [
        'email', 'Email', 'customer_email', 'buyer_email', 'contact_email',
        'customer.email', 'customer_details.email', 'billing_details.email',
        'contact.email', 'metadata.email', 'data.email',
    ]:
        v = _nested_get(payload, path)
        if v and isinstance(v, str) and '@' in v:
            email = v.strip().lower()
            break

    # ── amount ─────────────────────────────────────────────────
    amount = None
    for key in ['amount', 'amount_total', 'amount_paid', 'total', 'price',
                'value', 'revenue', 'subtotal', 'grand_total', 'Amount']:
        v = _nested_get(payload, key)
        if v is not None:
            try:
                amount = round(float(v), 2)
                break
            except Exception:
                pass

    # ── currency ───────────────────────────────────────────────
    currency = 'USD'
    for key in ['currency', 'Currency']:
        v = _nested_get(payload, key)
        if v and isinstance(v, str):
            currency = v.upper()[:3]
            break

    # ── product name ───────────────────────────────────────────
    product = None
    for path in [
        'product', 'product_name', 'plan', 'plan_name', 'item_name',
        'description', 'name', 'offer_name', 'product.name',
        'line_items.0.description', 'line_items.0.name',
        'display_items.0.custom.name',
    ]:
        v = _nested_get(payload, path)
        if v and isinstance(v, str):
            product = v[:200]
            break

    # ── status ─────────────────────────────────────────────────
    status = 'completed'
    for key in ['status', 'Status', 'state', 'payment_status', 'fulfillment_status']:
        v = _nested_get(payload, key)
        if v and isinstance(v, str):
            status = v.lower()
            break

    # ── source/platform hint ───────────────────────────────────
    source = None
    for key in ['source', 'platform', 'type', 'event_type', 'object']:
        v = _nested_get(payload, key)
        if v and isinstance(v, str):
            source = v[:100]
            break

    return {
        'email':    email,
        'amount':   amount,
        'currency': currency,
        'product':  product,
        'status':   status,
        'source':   source,
    }


@api_router.post("/sales/webhook", status_code=201)
async def sales_webhook(request: Request):
    """
    Universal sale ingestion endpoint.
    POST any JSON payload from Stripe, Kajabi, GoHighLevel, n8n, Zapier, etc.
    Tether extracts the sale fields, matches the email to an existing contact,
    and links the sale record to that contact.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON")

    try:
        fields    = _extract_sale_fields(body)
        now       = datetime.now(timezone.utc)
        sale_id   = str(uuid.uuid4())
        email     = fields['email']

        # Match to an existing contact by email
        contact_id = None
        if email:
            contact = await db.contacts.find_one(
                {"email": {"$regex": f"^{email}$", "$options": "i"}, "merged_into": None},
                {"_id": 0, "contact_id": 1}
            )
            if contact:
                contact_id = contact['contact_id']

        sale_doc = {
            "id":         sale_id,
            "contact_id": contact_id,
            "email":      email,
            "amount":     fields['amount'],
            "currency":   fields['currency'],
            "product":    fields['product'],
            "status":     fields['status'],
            "source":     fields['source'],
            "raw_data":   body,
            "created_at": dt_to_str(now),
        }
        await db.sales.insert_one(sale_doc)

        logger.info(
            f"Sale {sale_id[:8]} ingested — "
            f"email={email} amount={fields['amount']} "
            f"linked_to={contact_id[:12] if contact_id else 'none'}..."
        )
        return {
            "status":     "ok",
            "sale_id":    sale_id,
            "contact_id": contact_id,
            "matched":    contact_id is not None,
            "email":      email,
            "amount":     fields['amount'],
            "product":    fields['product'],
        }
    except Exception as e:
        logger.error(f"Error ingesting sale: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/sales", response_model=List[SaleOut])
async def get_sales(limit: int = 500):
    """All sales, newest first, enriched with contact name."""
    try:
        sales_raw = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)

        # Batch-enrich with contact data
        contact_ids = list({s["contact_id"] for s in sales_raw if s.get("contact_id")})
        contacts_map: dict = {}
        if contact_ids:
            contacts_raw = await db.contacts.find(
                {"contact_id": {"$in": contact_ids}},
                {"_id": 0, "contact_id": 1, "name": 1, "email": 1}
            ).to_list(len(contact_ids))
            contacts_map = {c["contact_id"]: c for c in contacts_raw}

        result = []
        for s in sales_raw:
            c = contacts_map.get(s.get("contact_id") or "", {})
            result.append(SaleOut(
                id            = s["id"],
                contact_id    = s.get("contact_id"),
                contact_name  = c.get("name"),
                contact_email = c.get("email") or s.get("email"),
                email         = s.get("email"),
                amount        = s.get("amount"),
                currency      = s.get("currency", "USD"),
                product       = s.get("product"),
                status        = s.get("status"),
                source        = s.get("source"),
                raw_data      = s.get("raw_data", {}),
                created_at    = str_to_dt(s["created_at"]),
            ))
        return result
    except Exception as e:
        logger.error(f"Error fetching sales: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ─────────────────────────── Auth ───────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

def _make_token(email: str, password: str) -> str:
    """
    Daily-rotating HMAC token.  Valid until midnight UTC — users are automatically
    re-prompted after a day.  Simple enough for a single-user dashboard.
    """
    day = str(int(datetime.now(timezone.utc).timestamp()) // 86400)
    raw = __import__('hmac').new(
        password.encode(), f"{email.lower()}:{day}".encode(), __import__('hashlib').sha256
    ).hexdigest()
    import base64
    return base64.urlsafe_b64encode(raw.encode()).decode()

@api_router.post("/auth/login")
async def auth_login(data: LoginRequest):
    expected_email    = os.environ.get('TETHER_EMAIL',    'admin@tether.com')
    expected_password = os.environ.get('TETHER_PASSWORD', 'tether2024')

    email_ok    = data.email.strip().lower() == expected_email.strip().lower()
    password_ok = data.password == expected_password

    if not (email_ok and password_ok):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _make_token(expected_email, expected_password)
    return {"token": token, "email": expected_email}

@api_router.post("/auth/verify")
async def auth_verify(payload: dict):
    expected_email    = os.environ.get('TETHER_EMAIL',    'admin@tether.com')
    expected_password = os.environ.get('TETHER_PASSWORD', 'tether2024')
    token = payload.get('token', '')
    expected = _make_token(expected_email, expected_password)
    if __import__('hmac').compare_digest(token, expected):
        return {"valid": True, "email": expected_email}
    raise HTTPException(status_code=401, detail="Token invalid or expired")



# ─────────────────────────── StealthWebinar Registrations ────────────────────

@api_router.post("/stealth/webhook")
async def stealth_webhook(request: Request):
    """
    Receives registration data from StealthWebinar (or any external form platform).
    For each registration:
      1. Store the raw payload in stealth_registrations
      2. Look up the email in contacts to check if they came from Facebook (has fbclid)
      3. Upsert the contact with phone so automations with required_fields=['email','phone'] fire
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON")

    try:
        now   = datetime.now(timezone.utc)
        ip    = get_client_ip(request)

        # ── Extract common fields (flexible — handles various platforms) ──────
        def pick(obj: dict, *keys) -> Optional[str]:
            for k in keys:
                v = obj.get(k)
                if v and isinstance(v, str):
                    return v.strip()
            return None

        email = pick(body, 'email', 'Email', 'attendee_email', 'registrant_email')
        phone = pick(body, 'phone', 'Phone', 'phone_number', 'attendee_phone')
        name  = pick(body, 'name', 'Name', 'full_name', 'fullName',
                     'attendee_name', 'first_name', 'firstName')

        if not email:
            raise HTTPException(status_code=400, detail="'email' field is required")

        email_lower = email.lower()

        # ── Check if contact exists and has fbclid ────────────────────────────
        contact = await db.contacts.find_one(
            {"email": {"$regex": f"^{email_lower}$", "$options": "i"},
             "merged_into": None},
            {"_id": 0, "contact_id": 1, "attribution": 1, "name": 1, "phone": 1}
        )

        contact_id = contact.get("contact_id") if contact else None
        attr       = (contact.get("attribution") or {}) if contact else {}
        has_fbclid = bool(attr.get("fbclid"))

        # ── Store registration ────────────────────────────────────────────────
        reg_doc = {
            "id":           str(uuid.uuid4()),
            "email":        email_lower,
            "phone":        phone,
            "name":         name,
            "contact_id":   contact_id,
            "has_fbclid":   has_fbclid,
            "raw_data":     body,
            "registered_at": dt_to_str(now),
        }
        await db.stealth_registrations.insert_one(reg_doc)

        # ── Upsert the contact with phone + stealth tag ──────────────────────
        stealth_tag = 'stealth'
        if contact_id and phone:
            eid = await _resolve_contact_id(contact_id)
            await _upsert_contact({
                'contact_id': eid,
                'email':      email_lower,
                'phone':      phone,
                'name':       name or contact.get("name"),
            }, now, ip)
            # Add stealth tag
            await db.contacts.update_one(
                {"contact_id": eid},
                {"$addToSet": {"tags": stealth_tag}}
            )
            asyncio.create_task(_run_automations(eid))
        elif not contact_id:
            # Brand new contact — create them with all available data
            eid = str(uuid.uuid4())
            await _upsert_contact({
                'contact_id': eid,
                'email':      email_lower,
                'phone':      phone,
                'name':       name,
            }, now, ip)
            asyncio.create_task(_run_automations(eid))
            contact_id = eid
            # Add stealth tag to newly created contact
            await db.contacts.update_one(
                {"contact_id": eid},
                {"$addToSet": {"tags": stealth_tag}}
            )
            # Update the registration with the new contact_id
            await db.stealth_registrations.update_one(
                {"id": reg_doc["id"]},
                {"$set": {"contact_id": contact_id}}
            )

        logger.info(
            f"Stealth registration: {email_lower} | "
            f"phone={'yes' if phone else 'no'} | "
            f"fbclid={'YES' if has_fbclid else 'NO'} | "
            f"contact={'linked' if contact else 'created'}"
        )

        return {
            "status":     "ok",
            "id":         reg_doc["id"],
            "email":      email_lower,
            "contact_id": contact_id,
            "has_fbclid": has_fbclid,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Stealth webhook error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/stealth")
async def get_stealth_registrations(limit: int = 1000):
    """All StealthWebinar registrations, newest first, enriched with latest contact data."""
    try:
        regs = await db.stealth_registrations.find({}, {"_id": 0}) \
            .sort("registered_at", -1).limit(limit).to_list(limit)

        # Enrich with latest contact data (phone/fbclid may have updated since registration)
        contact_ids = list({r["contact_id"] for r in regs if r.get("contact_id")})
        contact_map: dict = {}
        if contact_ids:
            contacts_raw = await db.contacts.find(
                {"contact_id": {"$in": contact_ids}},
                {"_id": 0, "contact_id": 1, "name": 1, "email": 1,
                 "phone": 1, "attribution": 1, "tags": 1}
            ).to_list(len(contact_ids))
            contact_map = {c["contact_id"]: c for c in contacts_raw}

        result = []
        for r in regs:
            c = contact_map.get(r.get("contact_id") or "", {})
            attr = c.get("attribution") or {}
            # Re-evaluate fbclid from live contact data
            live_fbclid = bool(attr.get("fbclid"))
            result.append({
                "id":           r["id"],
                "email":        r.get("email"),
                "phone":        r.get("phone") or c.get("phone"),
                "name":         r.get("name")  or c.get("name"),
                "contact_id":   r.get("contact_id"),
                "has_fbclid":   live_fbclid,
                "fbclid":       attr.get("fbclid"),
                "tags":         c.get("tags"),
                "registered_at": r.get("registered_at"),
            })
        return result
    except Exception as e:
        logger.error(f"Error fetching stealth registrations: {e}")
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
        await db.contacts.create_index("tags",         sparse=True)
        await db.page_visits.create_index("contact_id")
        await db.page_visits.create_index("session_id", sparse=True)
        await db.page_visits.create_index("timestamp")
        await db.page_visits.create_index([("contact_id", 1), ("timestamp", 1)])
        await db.automations.create_index("id", unique=True, sparse=True)
        await db.automations.create_index("enabled")
        await db.automation_runs.create_index("automation_id")
        await db.automation_runs.create_index("triggered_at")
        await db.automation_runs.create_index([("automation_id", 1), ("triggered_at", -1)])
        await db.automation_runs.create_index(
            [("automation_id", 1), ("contact_id", 1), ("run_type", 1), ("fbclid", 1)],
            sparse=True
        )
        # Unique index on dedup collection — enforces at-most-once delivery
        # atomically even under concurrent requests
        await db.automation_dedup.create_index("dedup_key", unique=True)
        await db.stealth_registrations.create_index("id",           unique=True, sparse=True)
        await db.stealth_registrations.create_index("email",        sparse=True)
        await db.stealth_registrations.create_index("contact_id",   sparse=True)
        await db.stealth_registrations.create_index("registered_at")
        await db.sales.create_index("id",         unique=True, sparse=True)
        await db.sales.create_index("contact_id", sparse=True)
        await db.sales.create_index("email",      sparse=True)
        await db.sales.create_index("created_at")
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
