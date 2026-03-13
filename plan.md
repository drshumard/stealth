# Tether – Zapier-style Automation Builder Plan

## 1) Objectives
- Ship a full-page, flexible Automation Builder at routes:
  - /automations/new (create)
  - /automations/builder/:id (edit)
- Model: persist flexible steps array on automations: steps = [{ id, type, config }]
  - Supported step types: wait_for, filter, delay, webhook (delay implies refetch before firing)
- Simple step reordering via Up/Down buttons (no drag-and-drop)
- Integrate with existing TanStack Query patterns and Shadcn UI
- Backward compatible: gracefully load legacy automations (required_fields, filters, actions/webhook_url) and allow converting to steps on save
- **Track user_agent for Facebook Conversions API compatibility**
- **Track fbc/fbp cookies for enhanced Facebook CAPI matching**
- **Display FB CAPI data (user_agent, fbc, fbp) in Contact Detail Modal**
- **Support excluding null fields from webhook payloads for cleaner integrations**
- POC: Not required (CRUD + simple auth only)

## 2) Implementation Steps (Phased)

### Phase 1 — V1 Builder Page (COMPLETED ✅)
Core pages/components
- ✅ Added routes in App: /automations/new and /automations/builder/:id
- ✅ Created components/AutomationBuilderPage.jsx (full-page)
  - Header: name input, enabled toggle, Save/Cancel
  - Steps list: render each step with editor + Up/Down + Remove
  - Add Step dropdown menu: Wait For, Filter, Delay + Refetch, Send Webhook
  - Empty, loading, and error states; data-testid attributes on all interactive controls
- ✅ Data model (frontend):
  - wait_for: { fields: string[] }
  - filter: { filters: [{ id, field, operator, value? }] }
  - delay: { seconds: number }
  - webhook: { name?, url, field_map?: [{ id, source, target }], exclude_nulls?: boolean }
- ✅ API integration (TanStack Query):
  - GET /api/automations/:id (edit); POST /api/automations (create); PUT /api/automations/:id (save)
  - On save, persist steps[] (and name/enabled). Legacy fields cleared.
- ✅ Reordering: Up/Down moves array elements with optimistic UI; disabled when first/last
- ✅ UX: "Back to Automations" breadcrumb, sticky footer Save, toasts via Sonner
- ✅ Added missing GET /api/automations/{id} backend endpoint
- ✅ Added steps field support in PUT /api/automations/{id}
- ✅ Testing agent verified: 90%+ success rate, all core flows working

**Completed User Stories (Phase 1)**:
1. ✅ As a user, I can create a new automation at /automations/new and set its name and enabled state.
2. ✅ As a user, I can add a Wait For step and choose multiple required fields (email/phone/name).
3. ✅ As a user, I can add Filter conditions with field/operator/value and remove conditions.
4. ✅ As a user, I can add a Delay step and set seconds to wait (with refetch implied).
5. ✅ As a user, I can add a Webhook step with URL, optional name, and field mappings.
6. ✅ As a user, I can reorder steps using Up/Down to change execution order.
7. ✅ As a user, I can save and see my steps persisted to the automation.

### Phase 2 — Integrate With Automations Index (COMPLETED ✅)
- ✅ Updated AutomationsPage: New button links to /automations/new; Edit opens /automations/builder/:id
- ✅ Legacy modal (AutomationBuilder.jsx) retained but no longer used by default
- ✅ When editing legacy automations (no steps), builder hydrates from legacy fields:
  - required_fields → wait_for step
  - filters → filter step  
  - actions/webhook_url → webhook steps (with delay steps if delay_seconds > 0)
- ✅ On save from new builder, stores steps[]; legacy fields cleared
- ✅ Navigation and redirects working correctly

**Completed User Stories (Phase 2)**:
1. ✅ As a user, clicking New Automation navigates to the new builder page.
2. ✅ As a user, clicking Edit on an existing automation opens the full-page builder with prefilled data.
3. ✅ As a user, a legacy automation loads into the builder as equivalent steps I can edit.
4. ✅ As a user, saving redirects me back to /automations and refreshes the list.
5. ✅ As a user, errors show friendly messages via toast notifications.

### Phase 3 — Production Readiness & Code Review (COMPLETED ✅)
Code review completed with all critical issues fixed:
- ✅ **CRITICAL**: Implemented `_execute_step_pipeline()` backend function - automations with steps[] now execute correctly
- ✅ **Backend Validation**: Added `_validate_automation_steps()` function with comprehensive validation:
  - URL validation: Webhook URLs must start with http:// or https:// (returns 400 error)
  - Filter value validation: Operators like equals/not_equals/contains require non-empty values (returns 400 error)
  - Wait For validation: Must have at least one required field selected
- ✅ **Frontend Validation**: Matching validation in AutomationBuilderPage.jsx before save
- ✅ Error state UI when automation fetch fails (404, 500 errors show friendly error page with "Return to Automations" button)
- ✅ Removed unused `useMemo` import and fixed `hasChanges` tracking logic with proper `initialized` state
- ✅ Backend correctly prioritizes steps[] pipeline when present, falls back to legacy when absent

**Completed User Stories (Phase 3)**:
1. ✅ As a user, automations with steps[] execute correctly when triggered.
2. ✅ As a user, invalid webhook URLs are rejected with clear error messages (frontend toast + backend 400).
3. ✅ As a user, I see a friendly error page if an automation fails to load.
4. ✅ As a user, filter conditions with empty values are caught before save (frontend toast + backend 400).
5. ✅ As a user, Wait For steps without any fields selected are rejected.

### Phase 4 — Facebook CAPI Integration (COMPLETED ✅)
Added comprehensive tracking for Facebook Conversions API compatibility:

#### User Agent Tracking
- ✅ Added `user_agent` field to all Pydantic models:
  - Contact, ContactWithStats, ContactDetail (response models)
  - PageViewCreate, LeadCreate, RegistrationCreate (request models)
- ✅ Updated `_upsert_contact()` to store user_agent:
  - First-seen wins (won't overwrite existing user_agent)
  - Truncated to 1000 chars to prevent database bloat
- ✅ Updated `shumard.js` tracker to capture `navigator.userAgent` and include in all payloads
- ✅ Updated `_build_webhook_payload()` to include user_agent in webhook data
  - Field name: `user_agent` (maps to FB CAPI: `client_user_agent`)
- ✅ Added `user_agent` to TETHER_FIELDS in AutomationBuilderPage for field mapping
  - Label: "User Agent (FB CAPI)"

#### fbc/fbp Cookie Tracking
- ✅ Added `fbc` and `fbp` fields to Attribution model:
  - `fbc`: Facebook Click ID cookie (_fbc) - Format: `fb.1.{timestamp}.{fbclid}`
  - `fbp`: Facebook Browser ID cookie (_fbp) - Format: `fb.1.{timestamp}.{random}`
- ✅ Updated `safe_attribution()` to recognize fbc/fbp as known fields
- ✅ Updated `shumard.js` tracker to capture `_fbc` and `_fbp` cookies:
  - Captured on initial page load
  - Refreshed on each attribution capture (cookies may be set after initial cache)
- ✅ Updated `_build_webhook_payload()` to include fbc/fbp in webhook data
- ✅ Added fbc/fbp to TETHER_FIELDS in AutomationBuilderPage for field mapping:
  - "Facebook Click ID (fbc)"
  - "Facebook Browser ID (fbp)"

**Completed User Stories (Phase 4)**:
1. ✅ As a user, the tracker script captures and sends the browser's user agent string.
2. ✅ As a user, I can see user_agent in contact details via the API.
3. ✅ As a user, I can map user_agent to custom webhook fields for FB CAPI integration.
4. ✅ As a user, webhook payloads include user_agent automatically for FB CAPI compatibility.
5. ✅ As a user, the tracker script captures _fbc and _fbp cookies from the browser.
6. ✅ As a user, fbc/fbp values are stored in the contact's attribution data.
7. ✅ As a user, I can map fbc/fbp to custom webhook fields for enhanced FB CAPI matching.
8. ✅ As a user, webhook payloads include fbc/fbp automatically when available.

### Phase 5 — UI Enhancements & Webhook Options (COMPLETED ✅)
Enhanced Contact Detail Modal and webhook configuration:

#### Contact Detail Modal Enhancements
- ✅ Added **User Agent** display to Overview tab:
  - Shows full user agent string with copy button
  - Displayed alongside IP Address and Session ID
- ✅ Enhanced Attribution tab with **"Click IDs & FB Cookies"** section:
  - Renamed section from "Click IDs" to "Click IDs & FB Cookies"
  - Displays fbc (FB Click) with copy button
  - Displays fbp (FB Browser) with copy button
  - Shows alongside existing fbclid, gclid, ttclid, source_link_tag

#### Webhook "Exclude Null Fields" Option
- ✅ Added **"Exclude null fields"** checkbox to webhook step config:
  - Default: checked (true) - null fields are excluded by default
  - UI: Checkbox with label "Exclude null fields — Don't send fields that have no value"
  - Stored in step config as `exclude_nulls: boolean`
- ✅ Updated `_build_webhook_payload()` to respect `exclude_nulls` parameter:
  - When `exclude_nulls=True`: Filters out null and empty string values from payload
  - When `exclude_nulls=False`: Includes all fields (original behavior)
  - Works with both default payload and custom field mappings
- ✅ Updated `_execute_step_pipeline()` to pass `exclude_nulls` config to payload builder:
  - Reads `config.exclude_nulls` from webhook step (defaults to True)
  - Passes to `_build_webhook_payload()` function

**Completed User Stories (Phase 5)**:
1. ✅ As a user, I can see the user agent in the contact detail modal Overview tab.
2. ✅ As a user, I can see fbc and fbp cookies in the contact detail modal Attribution tab.
3. ✅ As a user, I can copy fbc/fbp/user_agent values with one click.
4. ✅ As a user, I can toggle "Exclude null fields" on webhook steps to reduce payload clutter.
5. ✅ As a user, null fields are excluded from webhooks by default for cleaner integrations.
6. ✅ As a user, I can disable null field exclusion if my webhook endpoint requires all fields.

### Phase 6 — Polish & Future Enhancements (Not Started - Optional)
- Add: duplicate step, unsaved-changes prompt, keyboard reordering (optional)
- Improve headers editor UX (JSON textarea with validation for custom headers)
- Visual pipeline enhancements: animation on reorder, better visual feedback
- Add converter in UI: "Convert legacy automation to steps" (one-click)
- Docs: quick how-to and examples for each step type
- Add gclid/wbraid/gbraid tracking for Google Ads Enhanced Conversions
- User Stories (Phase 6)
  1. As a user, I can duplicate an existing step to speed up configuration.
  2. As a user, I'm warned if I try to navigate away with unsaved changes.
  3. As a user, the step list has smooth animations when reordering.
  4. As a user, I see a short guide for each step type inline.
- Testing: validation and guardrails; ensure no regression on core flows

## 3) Next Actions (Immediate)
1. ✅ ~~Add routes /automations/new and /automations/builder/:id in App~~
2. ✅ ~~Scaffold components/AutomationBuilderPage.jsx with header, list, and add-step controls~~
3. ✅ ~~Implement step editors (WaitForEditor, FilterEditor, DelayEditor, WebhookEditor)~~
4. ✅ ~~Wire TanStack Query: fetch (edit) and save (create/update) with invalidate/redirect~~
5. ✅ ~~Implement Up/Down reordering and optimistic UI; add data-testid on all controls~~
6. ✅ ~~Run initial E2E via testing agent; fix critical issues~~
7. ✅ ~~Implement backend step pipeline execution for new steps[] format~~
8. ✅ ~~Code review and production hardening~~
9. ✅ ~~Add backend validation for steps (URL format, filter values, wait_for fields)~~
10. ✅ ~~Add user_agent tracking for Facebook Conversions API compatibility~~
11. ✅ ~~Add fbc/fbp cookie tracking for enhanced Facebook CAPI matching~~
12. ✅ ~~Add fbc/fbp/user_agent display to Contact Detail Modal~~
13. ✅ ~~Add "Exclude null fields" option to webhook steps~~
14. (Optional) Add polish features: duplicate step, unsaved changes warning, animations
15. (Optional) Add Google Ads tracking (gclid/wbraid/gbraid)

## 4) Success Criteria (ALL ACHIEVED ✅)
- ✅ Dedicated builder routes load and render without console errors
- ✅ All four step types can be added, configured, reordered, and removed
- ✅ Saving persists steps[] to the backend and reloads correctly
- ✅ Legacy automations load into the builder and can be saved as steps
- ✅ TanStack Query cache invalidation keeps /automations list in sync
- ✅ UI follows brand (#030352, #A31800), Shadcn patterns, and includes data-testid
- ✅ Testing agent passes core add/remove/reorder/save scenarios; no regressions in Automations list
- ✅ Backend executes step-based automations correctly when triggered
- ✅ Input validation prevents invalid data on BOTH frontend AND backend
- ✅ Error states handled gracefully with user-friendly UI
- ✅ Backend returns proper 400 status codes for validation errors
- ✅ User agent captured, stored, and available in webhook payloads for FB CAPI
- ✅ fbc/fbp cookies captured, stored in attribution, and available for FB CAPI matching
- ✅ **NEW**: Contact Detail Modal displays user_agent, fbc, and fbp with copy functionality
- ✅ **NEW**: Webhook steps support "Exclude null fields" option for cleaner payloads

## 5) Files Changed/Created
- `/app/frontend/src/components/AutomationBuilderPage.jsx` - NEW: Full-page Zapier-style builder with validation + FB CAPI fields (user_agent, fbc, fbp) in TETHER_FIELDS + exclude_nulls checkbox
- `/app/frontend/src/components/ContactDetailModal.jsx` - MODIFIED: Added user_agent to Overview tab, added fbc/fbp to Attribution tab "Click IDs & FB Cookies" section
- `/app/frontend/src/App.js` - MODIFIED: Added routes for /automations/new and /automations/builder/:id
- `/app/frontend/src/components/AutomationsPage.jsx` - MODIFIED: Updated to use navigation instead of modal
- `/app/backend/server.py` - MODIFIED: 
  - Added GET /api/automations/{id} endpoint
  - Added steps field support in PUT /api/automations/{id}
  - Added `_validate_automation_steps()` function for backend validation
  - Added `_execute_step_pipeline()` function for step-based execution
  - Updated `_run_automations()` to detect and route to step pipeline
  - Added `user_agent` field to Contact, ContactWithStats, ContactDetail, PageViewCreate, LeadCreate, RegistrationCreate models
  - Updated `_upsert_contact()` to store user_agent (first-seen wins, truncated to 1000 chars)
  - Updated `_build_webhook_payload()` to include user_agent, fbc, fbp and support `exclude_nulls` parameter
  - Added `fbc` and `fbp` fields to Attribution model
  - Updated `safe_attribution()` to recognize fbc/fbp as known fields
  - Updated `shumard.js` tracker to capture `navigator.userAgent`, `_fbc`, and `_fbp` cookies

## 6) Summary
**Phases 1-5: COMPLETED** - The Zapier-style Automation Builder is PRODUCTION READY with full FB CAPI support and enhanced UX:

### Core Features
- Users can create new automations with a flexible step-based pipeline
- Users can edit existing automations (including legacy ones that auto-convert)
- All 4 step types working: Wait For, Filter, Delay, Webhook
- Reordering, removal, and configuration all working
- Testing agent verified 90%+ success rate

### Backend Execution
- `_execute_step_pipeline()` processes steps sequentially
- wait_for: Checks required fields, aborts pipeline if missing (will retry later)
- filter: Evaluates conditions, aborts if not matched
- delay: Waits N seconds and refetches contact data
- webhook: Fires webhook with optional field mapping and null exclusion
- Full backward compatibility with legacy automations

### Production Hardening (Dual-Layer Validation)
**Frontend Validation:**
- URL validation (http/https required) - toast error
- Filter value validation (empty string check) - toast error
- Wait For field validation - toast error
- Error state UI for failed loads (404/500)
- Clean code with proper state management

**Backend Validation:**
- `_validate_automation_steps()` validates all steps before save
- Returns HTTP 400 with descriptive error messages:
  - "Step X: Webhook URL must start with http:// or https://"
  - "Step X: Filter condition on 'field' with operator 'op' requires a value"
  - "Step X: Wait For step must have at least one required field"
- Applied to both POST /api/automations and PUT /api/automations/{id}

### Facebook Conversions API Support (Complete)
**User Agent Tracking:**
- `user_agent` field added to all contact models
- Tracker script captures `navigator.userAgent` automatically
- User agent stored on first contact (first-seen wins)
- Webhook payloads include `user_agent` for FB CAPI `client_user_agent` mapping
- **Displayed in Contact Detail Modal Overview tab with copy button**
- Available in automation builder field mapping dropdown

**fbc/fbp Cookie Tracking:**
- `fbc` (Facebook Click ID) and `fbp` (Facebook Browser ID) fields added to Attribution model
- Tracker script captures `_fbc` and `_fbp` cookies from browser
- Cookies refreshed on each attribution capture (handles late cookie setting)
- Webhook payloads include `fbc` and `fbp` for enhanced FB CAPI event matching
- **Displayed in Contact Detail Modal Attribution tab "Click IDs & FB Cookies" section**
- Available in automation builder field mapping dropdown:
  - "Facebook Click ID (fbc)" → maps to FB CAPI `fbc`
  - "Facebook Browser ID (fbp)" → maps to FB CAPI `fbp`

### Webhook Enhancements
**Exclude Null Fields Option:**
- Checkbox in webhook step config: "Exclude null fields — Don't send fields that have no value"
- Default: enabled (true) - cleaner payloads out of the box
- Backend `_build_webhook_payload()` filters null/empty values when enabled
- Works with both default payload and custom field mappings
- Reduces payload clutter for integrations that don't need null fields

### Ready for Production ✅
