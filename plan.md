# Tether – Zapier-style Automation Builder Plan

## 1) Objectives
- Ship a full-page, flexible Automation Builder at routes:
  - `/automations/new` (create)
  - `/automations/builder/:id` (edit)
- Model: persist flexible steps array on automations: `steps = [{ id, type, config }]`
  - Supported step types: `wait_for`, `filter`, `delay`, `webhook` (delay implies refetch before firing)
- Simple step reordering via Up/Down buttons (no drag-and-drop)
- Integrate with existing TanStack Query patterns and Shadcn UI
- Backward compatible: gracefully load legacy automations (`required_fields`, `filters`, `actions/webhook_url`) and allow converting to `steps[]` on save
- Facebook CAPI compatibility:
  - Track `user_agent`
  - Track `fbc`/`fbp` cookies
  - Display `user_agent`, `fbc`, `fbp` in Contact Detail
- Webhooks:
  - Support excluding null fields from webhook payloads
- Re-identification attribution:
  - Refresh attribution on new click IDs only (fbclid/gclid/ttclid differs)
  - Archive old attribution to `attribution_history` (cap 20)
- Automation triggering:
  - Support firing for new contacts, returning contacts, or both via `trigger_audience`
- ✅ **Tech debt completed:** migrate React Router to Data Router for native navigation blocking (`useBlocker`) so unsaved-changes protection applies to *all* in-app navigation (TopNav + back button)

## 2) Implementation Steps (Phased)

### Phase 1 — V1 Builder Page (COMPLETED ✅)
Core pages/components
- ✅ Added routes in App: `/automations/new` and `/automations/builder/:id`
- ✅ Created `components/AutomationBuilderPage.jsx` (full-page)
  - Header: name input, enabled toggle, Save/Cancel
  - Steps list: render each step with editor + Up/Down + Remove
  - Add Step dropdown menu: Wait For, Filter, Delay + Refetch, Send Webhook
  - Empty, loading, and error states; `data-testid` attributes on all interactive controls
- ✅ Data model (frontend):
  - `wait_for`: `{ fields: string[] }`
  - `filter`: `{ filters: [{ id, field, operator, value? }] }`
  - `delay`: `{ seconds: number }`
  - `webhook`: `{ name?, url, field_map?: [{ id, source, target }], exclude_nulls?: boolean }`
- ✅ API integration (TanStack Query):
  - GET `/api/automations/:id` (edit)
  - POST `/api/automations` (create)
  - PUT `/api/automations/:id` (save)
  - On save, persist `steps[]` (and name/enabled). Legacy fields cleared.
- ✅ Reordering: Up/Down moves array elements with optimistic UI; disabled when first/last
- ✅ UX: “Back to Automations” breadcrumb, sticky footer Save, toasts via Sonner
- ✅ Added missing GET `/api/automations/{id}` backend endpoint
- ✅ Added `steps` field support in PUT `/api/automations/{id}`
- ✅ Testing agent verified core flows

**Completed User Stories (Phase 1)**:
1. ✅ Create a new automation at `/automations/new`
2. ✅ Add Wait For step and choose required fields
3. ✅ Add Filter conditions and remove them
4. ✅ Add Delay step and set seconds
5. ✅ Add Webhook step with URL, optional name, and field mappings
6. ✅ Reorder steps using Up/Down
7. ✅ Save and reload persisted steps

### Phase 2 — Integrate With Automations Index (COMPLETED ✅)
- ✅ Updated `AutomationsPage`: New button links to `/automations/new`; Edit opens `/automations/builder/:id`
- ✅ Legacy modal (`AutomationBuilder.jsx`) retained but no longer used by default
- ✅ Legacy automations hydrate into steps:
  - `required_fields` → wait_for step
  - `filters` → filter step
  - `actions/webhook_url` → webhook steps (delay converted to delay step)
- ✅ On save from new builder, stores `steps[]`; legacy fields cleared
- ✅ Navigation and redirects working

### Phase 3 — Production Readiness & Code Review (COMPLETED ✅)
- ✅ Implemented backend `_execute_step_pipeline()` to actually run `steps[]`
- ✅ Backend validation `_validate_automation_steps()`:
  - URL validation (`http://` or `https://`)
  - Filter value validation for operators requiring values
  - Wait For validation (must have ≥1 field)
- ✅ Matching frontend validation
- ✅ Friendly error state page on load failure
- ✅ Fixed `hasChanges` tracking initialization

### Phase 4 — Facebook CAPI Integration (COMPLETED ✅)
#### User Agent Tracking
- ✅ Added `user_agent` fields to models and request payloads
- ✅ Stored user_agent (first-seen wins; truncation to prevent bloat)
- ✅ Tracker captures `navigator.userAgent` and sends it
- ✅ Webhook payload includes `user_agent`

#### fbc/fbp Cookie Tracking
- ✅ Added `fbc`/`fbp` to Attribution model and safe parsing
- ✅ Tracker captures `_fbc` and `_fbp` cookies
- ✅ Webhook payload includes `fbc`/`fbp`

### Phase 5 — UI Enhancements & Webhook Options (COMPLETED ✅)
- ✅ Contact Detail modal shows `user_agent` and `fbc`/`fbp`
- ✅ Webhook step supports `exclude_nulls` (default on)
- ✅ Delayed webhook refetch respects `exclude_nulls`

### Phase 6 — Critical fbc/fbp Bug Fixes (COMPLETED ✅)
- ✅ Fixed 5 production bugs around cookie persistence, delayed pixel capture, and payload rebuild behavior

### Phase 7 — Re-identification Attribution Refresh + Returning Contact Triggers (COMPLETED ✅)
**Problem (resolved):** returning contacts from new ads were stuck with old `fbclid/fbc` in CRM; automations couldn’t intentionally target returning leads.

**Implemented:**
- ✅ Attribution refresh only when a new click-id is detected (fbclid/gclid/ttclid differs)
  - Archives old attribution to `attribution_history` (capped at 20)
  - Sets `attribution_refreshed_at`
  - Synthesizes `fbc` from `fbclid` if needed
- ✅ Stitch logic refreshes parent attribution from newer child when click ID differs
- ✅ New automation field `trigger_audience`: `new | returning | both` (default `both`)
  - Audience gating in `_run_automations(contact_id, is_returning)`
  - Returning detection stable via `first_identified_at`
- ✅ Frontend builder supports selecting trigger audience; list shows badge
- ✅ testing_agent iteration_3: 36/36 backend PASS, frontend verified

### Phase 8 — Polish & Future Enhancements (Not Started - Optional)
- **P1:** Google Ads click-id tracking (gclid/wbraid/gbraid) for Enhanced Conversions attribution
- Improve headers editor UX
- Docs and examples

---

## Phase 9 — React Router Data Router Refactor (COMPLETED ✅)
**Motivation (resolved):** the unsaved-changes warning previously used a custom `safeNavigate` workaround and could not intercept all in-app navigation (notably TopNav/sidebar links and certain history navigations). Data Router enables native blocking via `useBlocker`.

### Phase 9A — Migrate App Router Setup (COMPLETED ✅)
**File:** `/app/frontend/src/App.js`
- ✅ Migrated from `<BrowserRouter><Routes>...` to `createBrowserRouter([...])` + `<RouterProvider router={router} />`
- ✅ Converted `AppShell` into a layout route rendering:
  - existing frame UI (`TopNav`, `ContactDetailModal`, etc.)
  - `<Outlet context={shared} />`
- ✅ Added thin wrapper routes (`LeadsRoute`, `StealthRoute`, `SalesRoute`, `VisitorsRoute`, `AnalyticsRoute`) that read `useOutletContext()` so page components remained unchanged
- ✅ Preserved auth early-return:
  - `if (!authToken) return <LoginPage onLogin={handleLogin} />;`

### Phase 9B — Replace Custom Navigation Guard With `useBlocker` (COMPLETED ✅)
**File:** `/app/frontend/src/components/AutomationBuilderPage.jsx`
- ✅ Removed `safeNavigate` + `pendingTargetRef` workaround
- ✅ Added native `useBlocker` guard:
  - Predicate reads `hasChangesRef` (synced via effect)
  - `handleSave` flips the ref synchronously before navigating to avoid stale blocking
- ✅ Dialog wired to blocker control:
  - “Stay” → `blocker.reset()`
  - “Leave without saving” → `blocker.proceed()`
- ✅ Kept `beforeunload` warning for refresh/close-tab
- ✅ Result: unsaved-changes protection now intercepts **TopNav navigation + browser back button** (previously uncovered edge cases)

### Phase 9C — Testing (COMPLETED ✅)
- ✅ Compile check
- ✅ Screenshot/UX verification: TopNav navigation is blocked when unsaved changes exist; save flow is not blocked
- ✅ testing_agent iteration_4: **100% pass** (7 frontend scenarios + 3 backend endpoint checks)
- ✅ testing agent also fixed a **pre-existing** critical crash on `/logs`:
  - `LogsPage.jsx` `timeAgo()` referenced `timezone` out of scope causing a white-screen error
  - Fix: `timeAgo(ts, timezone)` now accepts timezone as a parameter; all call sites updated

## 3) Next Actions (Immediate)
1. 🔥 **P1:** Add Google Ads click-id tracking (gclid/wbraid/gbraid) for Enhanced Conversions
2. (Optional) Improve webhook headers editor UX
3. (Optional) Documentation/examples for automation steps and triggers

## 4) Success Criteria
### Phases 1–7 (ACHIEVED ✅)
- ✅ Automation builder works and persists steps
- ✅ Automations execute via backend step pipeline
- ✅ FB CAPI fields tracked and visible
- ✅ Returning contact attribution refresh works (history retained)
- ✅ Automations support trigger audience gating
- ✅ testing_agent verified returning attribution fix end-to-end

### Phase 9 (ACHIEVED ✅)
- ✅ Data Router migration did not break routing, auth, modals, or query wiring
- ✅ Builder unsaved-changes warning blocks:
  - TopNav navigation
  - browser back button
  - in-app programmatic navigations
- ✅ Save flow does not trigger a blocker
- ✅ testing_agent regression passed (iteration_4)

## 5) Files Changed/Created
### Already changed (Phases 1–7)
- `/app/frontend/src/components/AutomationBuilderPage.jsx`
- `/app/frontend/src/components/AutomationsPage.jsx`
- `/app/frontend/src/components/ContactDetailModal.jsx`
- `/app/frontend/src/App.js`
- `/app/backend/server.py`
- `/app/test_reports/iteration_3.json`

### Phase 9 changes
- `/app/frontend/src/App.js` (migrated to Data Router)
- `/app/frontend/src/components/AutomationBuilderPage.jsx` (native `useBlocker` unsaved-changes guard)
- `/app/frontend/src/components/LogsPage.jsx` (timezone scope crash fix)
- `/app/test_reports/iteration_4.json`

## 6) Summary
Phases 1–7 are complete and production-ready, including returning-lead attribution refresh and returning/new automation trigger audiences.

**Phase 9 is now complete:** the frontend uses React Router Data Router and the automation builder now uses native `useBlocker`, so unsaved-changes protection applies to *all* in-app navigation (TopNav + back button). A pre-existing `/logs` crash was also fixed and verified.

**Next priority:** Google Ads click-id tracking (gclid/wbraid/gbraid) for Enhanced Conversions attribution (P1).