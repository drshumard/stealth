# StealthTrack (Hyros-like) — Development Plan (MVP → V1) **(Updated v3: Shumard Script + Deletion UI + No-Flash Loading + Always-on Logs)**

## 1) Objectives
- Capture **page visits + referrer attribution** and **StealthWebinar registration events** via a drop-in script served from this app (**`/api/shumard.js`**).
- Persist a unified visitor timeline using a stable:
  - **`contact_id`** (device+origin identifier; localStorage + cookie fallback)
  - **`session_id`** (tab/session identifier used to stitch parent + iframe activity)
- Mimic key **Hyros tracking patterns**:
  - Immediate initialization (IIFE)
  - **Field capture on change/blur** (not only on submit)
  - Robust field classification (class + attribute + type heuristics)
  - Attribution capture from URL params (UTMs, `fbclid`, `gclid`, etc.)
  - SPA navigation detection (URL change polling)
  - MutationObserver for dynamic/embedded forms
- **Cross-frame stitching (critical for StealthWebinar iframes):**
  - Track events in both the landing page and the StealthWebinar iframe.
  - **Stitch the two origins into one user** using:
    - `postMessage` bridge (primary)
    - IP-based auto-stitching (fallback, conservative)
- Persist a richer attribution model per contact + per visit.
- Provide a **dark, data-focused dashboard** to view contacts, search, and inspect each contact’s timeline.
- Provide marketer-ready UX:
  - Copy-to-clipboard embed snippet
  - “Live/Active” indicator
  - Contact detail modal with **Overview / Attribution / URL History**
  - **Stitched identity indicators** (badge count + merged children list)
  - **Contact deletion** (backend + UI)
- Provide developer-visibility UX:
  - **Always-on console logging** when events are captured (pageviews, attribution, lead field capture, registration, stitch messages).

**Current status:** All phases and P0/P1/P2 tasks are implemented and verified. Backend endpoints, Hyros-style tracker (now **Shumard**), cross-frame stitching, MongoDB indexes, dashboard UI (including deletion + no-flash loading) are working. Modal open is driven via **URL-based routing** (`?contact=`).

---

## 2) Implementation Steps

### Phase 1 — Core Flow POC (Isolation) ✅ Completed
**Goal:** Prove external JS capture + backend ingest works end-to-end before full UI.

**Delivered (POC outcomes)**
1. Script loads on any page and initializes immediately.
2. Pageview events are logged with full URL params + referrer.
3. Form submissions and field changes can be tied to the same `contact_id`.
4. Dashboard can be refreshed and new contacts appear.
5. A contact detail view shows chronological URL timeline.

**Implemented endpoints (POC → carried forward)**
- `POST /api/track/pageview`
- `POST /api/track/registration`
- `GET /api/contacts` (with `visit_count`)
- `GET /api/contacts/{contact_id}` (contact + visits)
- `GET /api/shumard.js` *(renamed from `/api/tracker.js`)*

**Notes**
- Early duplicate-brace bug in tracker generation fixed by switching to a proper JS builder.

---

### Phase 2 — V1 App Development (Build around proven core) ✅ Completed

**User stories delivered (V1)**
1. Copy a script snippet and paste it into the webinar page header.
2. View a contacts table with key columns and visit counts.
3. Search contacts client-side (name/email/phone).
4. Open contact details.
5. Review visited URLs with params in time order and copy IDs/URLs.
6. Delete contacts from the dashboard UI.

#### Backend (FastAPI + MongoDB) ✅ Completed (Extended)

**Data models (implemented & extended)**
- `Contact`
  - `id`, `contact_id`, `session_id?`
  - `client_ip?`
  - `name`, `email`, **`phone`**, `first_name`, `last_name`
  - `attribution` (UTM + click IDs)
  - **stitching fields**:
    - `merged_into?` (child pointer)
    - `merged_children?` (parent list)
  - `created_at`, `updated_at`
- `PageVisit`
  - `id`, `contact_id`, `session_id?`
  - `client_ip?`
  - `current_url`, `referrer_url`, `page_title`, `timestamp`
  - `attribution` (visit-level)
  - `original_contact_id?` (set when visits are reassigned during stitch)

**Tracking endpoints (implemented)**
- `POST /api/track/pageview`
  - Logs `PageVisit`
  - Ensures `Contact` exists (upsert)
  - Captures `client_ip`
  - Triggers conservative IP auto-stitch
- `POST /api/track/lead`
  - Hyros-style “field capture” endpoint (change/blur)
  - Upserts contact fields without requiring submit
  - Triggers conservative IP auto-stitch
- `POST /api/track/registration`
  - Upserts contact and logs a visit for the registration page
  - Triggers conservative IP auto-stitch
- **Stitching endpoints (new)**
  - `POST /api/track/stitch`
    - Merges child → parent
    - Copies identity fields (email/phone/name) into attribution-rich parent
    - Reassigns visits
    - **Supports re-stitch override**: un-merge from incorrect parent, then re-merge into correct parent
  - `POST /api/track/stitch/by-session` *(admin utility)*
    - Stitches all contacts sharing a `session_id` into the earliest parent

**Contact endpoints (implemented & extended)**
- `GET /api/contacts`
  - Returns contacts with `visit_count`
  - **Hides merged children by default** (`merged_into=None`)
  - Supports `include_merged=true` if needed
- `GET /api/contacts/{contact_id}`
  - Returns contact detail + chronological `visits`
- **`DELETE /api/contacts/{contact_id}`** *(new + verified)*
  - Deletes the contact
  - Deletes associated page visits
  - Removes contact from any parent’s `merged_children` list
- `GET /api/stats`
  - Returns `total_contacts` (excluding merged children), `total_visits`, `today_visits`

**Validation / safety implemented**
- Defensive attribution parsing with known-field allowlist + `extra` passthrough.
- Datetime normalization for Mongo serialization.
- **Auto-stitch safety fix**:
  - IP auto-stitch only triggers when:
    - one contact has **attribution**, and
    - the other has **identity** (email/phone), and
    - neither has both.
  - Prevents false positives for anonymous-only traffic.

**MongoDB indexes ✅ Completed**
Created/verified on startup:
- `contacts.contact_id` (unique)
- `contacts.email` (sparse)
- `contacts.session_id` (sparse)
- `contacts.client_ip` (sparse)
- `contacts.merged_into` (sparse)
- `contacts.created_at`
- `page_visits.contact_id`
- `page_visits.session_id` (sparse)
- `page_visits.timestamp`
- compound: `page_visits(contact_id, timestamp)`

#### Shumard.js (served from backend) ✅ Completed (Hyros-style + Cross-frame + Always-on Logs)

**Key behaviors implemented**
- IIFE wrapper, minimal globals.
- Stable visitor identity:
  - `contact_id` via localStorage + cookie fallback.
- **`session_id`** generation:
  - Stored in sessionStorage; iframe adopts parent’s `session_id` via `postMessage`.
- Attribution capture:
  - UTMs + click IDs (`fbclid`, `gclid`, `ttclid`) + tags like `sl`.
  - Persisted in localStorage/cookie.
- Pageview tracking:
  - On init and on SPA URL changes.
- Form + field capture:
  - Field classification strategy:
    - Special classes: `st-email` / `st-phone` + Hyros-compat `hyros-email` / `hyros-phone`.
    - Type-based detection (`email`, `tel`) + name/id/placeholder heuristics.
  - Sends `POST /track/lead` on **change/blur** for email/phone.
  - Sends `POST /track/registration` on submit/click-submit.
- Cross-frame stitching:
  - Parent broadcasts `{type:'st_parent_id', contactId, sessionId}` to all iframes for ~30s.
  - iframe receives identity, adopts sessionId, triggers `/track/stitch`, and replies `{type:'st_child_id', contactId}`.
  - Parent confirms stitch on child reply.
  - Includes basic listener for future webinar-platform `postMessage` registration payloads.
- Robustness:
  - MutationObserver to bind late-rendered forms.
  - Does not block submit.
  - Uses `fetch(keepalive)` with XHR fallback.
- **Always-on console logs (new)**
  - Logs initialization, attribution capture/cache, pageview send, email/phone field capture, registration send, and stitch messaging.
  - Uses `[Shumard]` prefix.

**Public API (updated)**
- `window.Shumard.getContactId()`
- `window.Shumard.getSessionId()`
- `window.Shumard.identify()`
- `window.Shumard.stitch(parentCid, childCid)`
- `window.Shumard.trackEvent()`
- `window.Shumard.store`

#### Frontend Dashboard (React + shadcn/ui) ✅ Completed (Extended)

**Design system delivered**
- Dark-first analytics aesthetic with cyan/mint/amber accents.
- Fonts: Space Grotesk (display), Work Sans (body), IBM Plex Mono (IDs/URLs).

**UI delivered**
- TopNav
  - Brand + Active indicator + Refresh + Copy Script
- ScriptEmbedCard
  - Copyable embed snippet for **`/api/shumard.js`** *(updated from tracker.js)*
- ContactsTable
  - Columns: Name, Email, **Source**, Created, Visits
  - Client-side search (name/email/phone)
  - Empty state CTA to copy script
  - **Stitch indicator badge** (merged children count)
  - **No-flash loading polish (new/verified):** skeleton rows only appear on first load when table is empty (not on background refresh/polling).
- ContactDetailModal
  - Tabs: Overview / Attribution / URL History
  - Copy controls for key fields
  - Overview includes: `client_ip`, `session_id`, stitched children list
  - **Delete button (new/verified):** delete contact via confirm dialog; closes modal and removes contact from list.

**Modal routing implementation (important)**
- Modal open/close is driven by URL query param:
  - Open: `/?contact=<contact_id>`
  - Close: clears query params
- Provides deep-linking and stable state.

---

### Phase 3 — Hardening + “Real-time” UX polish (no auth yet) ✅ Completed
**Delivered**
- Live-feel polling (dashboard refresh) via periodic fetch.
- Duplicate reduction:
  - Script sends pageview once per URL cycle.
  - Lead events only send when value changes and passes validation.
- Stitch reliability:
  - postMessage bridge + explicit stitch endpoint
  - conservative IP stitch fallback
  - explicit stitch can override wrong auto-stitch
- **Deletion hardening (new/verified):** backend cascade deletes visits + removes child reference from merged parent.

**Remaining (optional MVP+)**
- True real-time transport (SSE/WebSocket).
- Server-side pagination and date-range filtering.
- CSV export per contact.
- Tracking-install verification (“test event” button).
- Stitch diagnostics view (session graph / merge history audit log).

---

### Phase 4 — Expansion (requires user approval)
- Authentication + workspace separation (multi-tenant).
- Webhooks / integrations (Zapier, Slack, CRM export).
- WebSocket live stream + event timeline streaming.
- Advanced attribution reporting (first-touch vs last-touch, campaign rollups).

---

## 3) Next Actions (Immediate)
**Current state is shippable** for real StealthWebinar flows that involve an iframe.

Recommended next steps:
1. **StealthWebinar-specific event hooks**
   - Confirm if `joinnow.live` posts structured registration messages via `postMessage` and parse them.
2. Add backend query options:
   - pagination (`limit`, `offset`)
   - server-side search
   - date range filtering
3. Add export:
   - `GET /api/contacts/{contact_id}/export.csv`
4. Add a “Stitch Debug” utility:
   - list contacts by `session_id` and show merge operations.

---

## 4) Success Criteria ✅ Met
- External page with embedded script produces **pageview** records with full URL + referrer params.
- Field changes (email/phone) can be captured pre-submit (Hyros-style) via `/track/lead`.
- Cross-origin iframe flows are unified:
  - landing page + StealthWebinar iframe events are **stitched into one contact**.
- Dashboard lists contacts with correct visit counts and Source attribution.
- Contact modal shows:
  - Overview details (+ session/IP + stitched children)
  - Attribution details (UTMs + click IDs)
  - URLs visited in chronological order with params
  - **Phone field displayed**
  - **Delete contact available**
- Embed snippet uses **`/api/shumard.js`**.
- Script produces **always-on console logs** with `[Shumard]` prefix for captured events.
- MongoDB indexes are in place for production-like performance.
- Auto-stitch does not generate false positives (conservative rules) and explicit stitch can override.
