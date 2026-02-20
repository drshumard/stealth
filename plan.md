# StealthTrack (Hyros-like) — Development Plan (MVP)

## 1) Objectives
- Capture **page visits + referrer attribution** and **StealthWebinar registration form submissions** via a drop-in script (`/api/tracker.js`).
- Persist a unified timeline per visitor using a stable **`contact_id` UUID** stored in `localStorage`.
- Provide a **dark, data-focused dashboard** to view contacts, search, and inspect each contact’s URL history.
- Deliver a working **core flow** first (external page → tracker.js → API → Mongo → dashboard).

## 2) Implementation Steps

### Phase 1 — Core Flow POC (Isolation) 
**Goal:** prove the hardest part (external JS capture + backend ingest) works end-to-end before building the full UI.

**User stories (POC)**
1. As a marketer, I can load `/api/tracker.js` on any page and it initializes immediately.
2. As a marketer, I can see pageview events logged with full URL params + referrer.
3. As a marketer, I can submit a form and see name/email/phone tied to the same `contact_id`.
4. As a marketer, I can refresh the dashboard and see the new contact appear.
5. As a marketer, I can open the contact and see a chronological URL timeline.

**Steps**
- Websearch best practice for “capture embedded form submit + mutation observer + event delegation” (StealthWebinar embeds vary).
- Backend POC endpoints (minimal):
  - `POST /api/track/pageview`
  - `POST /api/track/registration`
  - `GET /api/contacts` (with visit_count)
  - `GET /api/contacts/{contact_id}` (contact + visits)
  - `GET /api/tracker.js` (served JS)
- Tracker POC behavior:
  - Create/get `contact_id` in `localStorage`.
  - On load: send pageview `{contact_id, current_url, referrer_url, page_title, timestamp}`.
  - Hook registration submit:
    - Capture values by common selectors (`input[type=email]`, `name`, `phone`) + fallback heuristic.
    - Send registration `{contact_id, name, email, phone, current_url, referrer_url}`.
- Add a tiny local “POC HTML page” (under `/app/tests/` or similar) that loads tracker.js and includes a dummy form to validate capture.
- Fix until stable:
  - Debounce duplicate pageview events.
  - Ensure CORS allows external origins.
  - Ensure Mongo inserts/updates are correct and idempotent for the same contact.

### Phase 2 — V1 App Development (Build around proven core)
**User stories (V1)**
1. As a user, I can copy a script snippet and paste it into my webinar page header.
2. As a user, I can see a contacts table with name/email/created/visit count.
3. As a user, I can search contacts by name/email.
4. As a user, I can click (or press Enter) on a row to open a detail modal.
5. As a user, I can review visited URLs (with params) in time order and copy a URL/contact_id.

**Backend (FastAPI + MongoDB)**
- Data models:
  - `Contact`: `id`, `contact_id`, `name`, `email`, `phone`, `created_at`, `updated_at`.
  - `PageVisit`: `id`, `contact_id`, `current_url`, `referrer_url`, `page_title`, `timestamp`.
- Implement:
  - Upsert contact on registration (by `contact_id`; optionally also by email if present).
  - Always log `PageVisit` on pageview; also log a visit on registration.
  - Aggregation for contacts list: visit_count per contact.
  - Basic validation + defensive parsing of URLs/params.

**Tracker.js (served from backend)**
- Serve JS with correct `Content-Type: application/javascript`.
- Include config via querystring (optional MVP): `?debug=1` to console.log.
- Robust hooking strategy:
  - Attach submit listeners at document level (capture phase).
  - MutationObserver to detect late-rendered iframe/embedded forms and bind.
  - Do not block the form submit; fire-and-forget with `navigator.sendBeacon` fallback.

**Frontend Dashboard (React + shadcn/ui)**
- Apply design system:
  - Update `index.css` tokens to dark-first cyan/mint/amber palette.
  - Add fonts (Space Grotesk, Work Sans, IBM Plex Mono) and use mono for IDs/URLs.
- Main layout:
  - TopNav: brand + live status pill (Idle/Receiving) + Copy Script + Refresh.
  - ScriptEmbedCard: copyable snippet with toast.
  - ContactsTable: dense table, keyboard accessible rows, empty state CTA.
  - ContactDetailModal: tabs (Overview / URLs) + ScrollArea timeline + copy buttons.
- Data:
  - `GET /api/contacts` on load + refresh.
  - `GET /api/contacts/{contact_id}` when opening modal.
  - Client-side search (MVP).

**End Phase 2:** run one full E2E pass (track pageview + registration → dashboard shows contact → modal shows URLs).

### Phase 3 — Hardening + “Real-time” UX polish (no auth yet)
**User stories (Hardening)**
1. As a user, I can trust duplicate submits won’t spam visits.
2. As a user, I can filter by date range (optional MVP+).
3. As a user, I can see clear “Receiving events” status when new events arrive.
4. As a user, I can export a contact’s URL history (CSV).
5. As a user, I can confirm tracking is installed via a “Test event” button.

**Steps**
- Add lightweight polling or SSE for “live” indicator (MVP: poll `/api/contacts?since=`).
- Add server-side query params: search, date range, pagination.
- Improve tracker compatibility:
  - Better field mapping; support multiple forms; stricter phone normalization.
- Add observability:
  - Backend request logging for tracking endpoints.
  - Basic rate limiting (optional).

### Phase 4 — Expansion (requires user approval)
- Authentication + workspace separation (multi-tenant).
- Webhooks / integrations (Zapier, Slack, CRM export).
- Websocket live stream.

## 3) Next Actions (Immediate)
1. Implement backend models + endpoints + Mongo indexes (`contact_id`, `timestamp`).
2. Implement `/api/tracker.js` with pageview + registration capture + sendBeacon fallback.
3. Add a minimal local POC HTML page to validate capture reliably.
4. Build dashboard skeleton (TopNav + ScriptEmbedCard + ContactsTable + Modal) per design tokens.
5. Run E2E test: load POC page → submit form → verify Mongo → verify dashboard.

## 4) Success Criteria
- Loading an external page with the embedded script produces **pageview** records with full URL + referrer params.
- Submitting the StealthWebinar form creates/updates a **Contact** and ties it to the same `contact_id`.
- Dashboard lists contacts with correct **visit counts**, searchable by name/email.
- Contact modal shows **all URLs visited** in chronological order with timestamps, and copy actions work.
- No obvious duplication (basic dedupe) and system remains usable after repeated reloads/submits.
