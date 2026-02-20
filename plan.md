# StealthTrack (Hyros-like) — Development Plan (MVP → V1) **(Updated)**

## 1) Objectives
- Capture **page visits + referrer attribution** and **StealthWebinar registration form submissions** via a drop-in script served from this app (`/api/tracker.js`).
- Persist a unified timeline per visitor using a stable **`contact_id` UUID** (stored in `localStorage` with cookie fallback).
- Mimic key **Hyros tracking patterns**:
  - Immediate initialization (IIFE)
  - **Field capture on change/blur** (not only on submit)
  - Robust field classification (class + attribute + type heuristics)
  - Attribution capture from URL params (UTMs, `fbclid`, `gclid`, etc.)
  - SPA navigation detection (URL change polling)
  - MutationObserver for dynamic/embedded forms
- Persist a richer attribution model per contact + per visit.
- Provide a **dark, data-focused dashboard** to view contacts, search, and inspect each contact’s URL history.
- Provide marketer-ready UX:
  - Copy-to-clipboard embed snippet
  - “Live/Active” indicator
  - Contact detail modal with **Overview / Attribution / URL History**
- Ensure the **core flow** works end-to-end (external page → tracker.js → API → Mongo → dashboard).

**Current status:** All phases are implemented and verified. Backend endpoints, Hyros-style tracker script, and dashboard UI are working. Modal open is implemented via **URL-based routing** for reliability.

---

## 2) Implementation Steps

### Phase 1 — Core Flow POC (Isolation) ✅ Completed
**Goal:** Prove external JS capture + backend ingest works end-to-end before full UI.

**Delivered (POC outcomes)**
1. `/api/tracker.js` loads on any page and initializes immediately.
2. Pageview events are logged with full URL params + referrer.
3. Form submissions and field changes can be tied to the same `contact_id`.
4. Dashboard can be refreshed and new contacts appear.
5. A contact detail view shows chronological URL timeline.

**Implemented endpoints (POC → carried forward)**
- `POST /api/track/pageview`
- `POST /api/track/registration`
- `GET /api/contacts` (with `visit_count`)
- `GET /api/contacts/{contact_id}` (contact + visits)
- `GET /api/tracker.js`

**Notes**
- Duplicate-brace bug in early tracker template was fixed by switching to a proper JS builder function.

---

### Phase 2 — V1 App Development (Build around proven core) ✅ Completed

**User stories delivered (V1)**
1. Copy a script snippet and paste it into the webinar page header.
2. View a contacts table with key columns and visit counts.
3. Search contacts client-side (name/email/phone).
4. Open contact details.
5. Review visited URLs with params in time order and copy IDs/URLs.

#### Backend (FastAPI + MongoDB) ✅ Completed
**Data models (implemented & extended)**
- `Contact`
  - `id`, `contact_id`, `session_id?`
  - `name`, `email`, `phone`, `first_name`, `last_name`
  - `attribution` (UTM + click IDs)
  - `created_at`, `updated_at`
- `PageVisit`
  - `id`, `contact_id`, `session_id?`
  - `current_url`, `referrer_url`, `page_title`, `timestamp`
  - `attribution` (visit-level)

**Tracking endpoints (implemented)**
- `POST /api/track/pageview`
  - Logs `PageVisit`
  - Ensures `Contact` exists (upsert)
- `POST /api/track/lead`
  - Hyros-style “field capture” endpoint (change/blur)
  - Upserts contact fields without requiring submit
- `POST /api/track/registration`
  - Upserts contact and logs a visit for the registration page
- `GET /api/contacts`
  - Returns contacts with `visit_count`
- `GET /api/contacts/{contact_id}`
  - Returns contact detail + chronological `visits`
- `GET /api/stats`
  - Returns `total_contacts`, `total_visits`, `today_visits`

**Validation / safety implemented**
- Defensive attribution parsing with known-field allowlist + `extra` passthrough.
- Datetime normalization for Mongo serialization.

#### Tracker.js (served from backend) ✅ Completed (Hyros-style)
**Key behaviors implemented**
- IIFE wrapper, minimal globals.
- Stable visitor identity:
  - `contact_id` via localStorage with cookie fallback.
- Attribution capture:
  - UTMs + click IDs (`fbclid`, `gclid`, `ttclid`) + tags like `sl`.
  - Persisted in localStorage/cookie.
- Pageview tracking:
  - On init and on SPA URL changes.
- Form + field capture:
  - Field classification strategy:
    - Special classes support: `st-email` / `st-phone` + Hyros-compat classes `hyros-email` / `hyros-phone`.
    - Type-based detection (`email`, `tel`) and name/id/placeholder heuristics.
  - Sends `POST /track/lead` on **change/blur** for email/phone.
  - Sends `POST /track/registration` on submit/click-submit.
- Robustness:
  - MutationObserver to bind late-rendered forms.
  - Does not block submit.
  - Uses `fetch(keepalive)` with XHR fallback.
- Public API:
  - `window.StealthTrack.getContactId()`
  - `window.StealthTrack.identify()`
  - `window.StealthTrack.trackEvent()`
  - `window.StealthTrack.store`
  - Custom event listener: `stealthtrack_email`

#### Frontend Dashboard (React + shadcn/ui) ✅ Completed
**Design system delivered**
- Dark-first analytics aesthetic with cyan/mint/amber accents.
- Fonts: Space Grotesk (display), Work Sans (body), IBM Plex Mono (IDs/URLs).

**UI delivered**
- TopNav
  - Brand + Active indicator + Refresh + Copy Script
- ScriptEmbedCard
  - Copyable embed snippet for `/api/tracker.js`
- ContactsTable
  - Columns: Name, Email, **Source**, Created, Visits
  - Client-side search (name/email/phone)
  - Empty state CTA to copy script
- ContactDetailModal
  - Tabs: Overview / **Attribution** / URL History
  - Copy controls for key fields

**Modal routing implementation (important change)**
- Modal open/close is driven by URL query param:
  - Open: `/?contact=<contact_id>`
  - Close: clears query params
- This provides stable deep-linking and avoids flaky click-state issues in automated environments.

---

### Phase 3 — Hardening + “Real-time” UX polish (no auth yet) ✅ Completed (core items)
**Delivered / partially delivered**
- Live-feel polling (dashboard refresh) via periodic fetch.
- Duplicate reduction:
  - Tracker marks pageview as sent per URL event cycle.
  - Lead events only send when value changes and passes validation.

**Remaining (optional MVP+)**
- True real-time transport (SSE/WebSocket).
- Server-side pagination and date-range filtering.
- CSV export per contact.
- Tracking-install verification (“test event” button).
- Mongo indexes (`contact_id`, `timestamp`) if performance requires.

---

### Phase 4 — Expansion (requires user approval)
- Authentication + workspace separation (multi-tenant).
- Webhooks / integrations (Zapier, Slack, CRM export).
- WebSocket live stream + event timeline streaming.
- Advanced attribution reporting (first-touch vs last-touch, campaign rollups).

---

## 3) Next Actions (Immediate)
**Current state is shippable.** Recommended next steps:
1. Add Mongo indexes:
   - `contacts.contact_id` unique
   - `page_visits.contact_id`, `page_visits.timestamp`
2. Add backend query options:
   - pagination (`limit`, `offset`)
   - server-side search
   - date range filtering
3. Add export:
   - `GET /api/contacts/{contact_id}/export.csv`
4. Add “Test Tracking” page:
   - Minimal external HTML sample showing form fields + UTM params for validation.

---

## 4) Success Criteria ✅ Met
- External page with embedded script produces **pageview** records with full URL + referrer params.
- Field changes (email/phone) can be captured pre-submit (Hyros-style) via `/track/lead`.
- Submitting a form creates/updates a **Contact** and ties it to the same `contact_id`.
- Dashboard lists contacts with correct **visit counts**, searchable by name/email/phone.
- Contact modal shows:
  - Overview details
  - Attribution details (UTMs + click IDs)
  - URLs visited in chronological order with params
- Basic dedupe prevents obvious spamming and system remains usable after repeated reloads/submits.
