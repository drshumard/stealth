<analysis>
The user requested building a Zapier-style automation builder for their Tether tracking application, replacing a rigid step-based builder with a flexible full-page interface. Additionally, they requested user agent tracking and fbc/fbp Facebook cookie tracking for Facebook Conversions API (CAPI) compatibility. During implementation, a comprehensive code review was conducted which uncovered and fixed 5 critical bugs in the fbc/fbp tracking flow that were causing null values in production.

Key achievements:
1. Built a new full-page automation builder at `/automations/new` and `/automations/builder/:id`
2. Implemented 4 step types: Wait For, Filter, Delay, Webhook with reordering via Up/Down arrows
3. Added user_agent tracking throughout the system
4. Added fbc/fbp Facebook cookie tracking with multiple timing-related fixes
5. Added "Exclude null fields" option for webhook payloads
6. Added backend validation for automation steps
7. Fixed 5 critical bugs in the fbc/fbp tracking pipeline
</analysis>

<product_requirements>
Primary problem: Replace rigid automation builder with flexible Zapier-style interface that allows dynamic step configuration

Specific features requested:
1. Full-page automation builder (not modal-based)
2. Four configurable step types:
   - Wait For: Pause until required fields (email/phone/name) are captured
   - Filter: Apply conditional logic (field equals/contains/exists)
   - Delay: Wait N seconds then refetch contact data
   - Webhook: Send data to configured URL with field mapping
3. Step reordering via Up/Down arrow buttons (not drag-and-drop)
4. User agent tracking in Facebook CAPI format (client_user_agent)
5. fbc/fbp cookie tracking for enhanced FB CAPI matching
6. Display fbc/fbp in contact detail modal
7. Option to exclude null fields from webhook payloads
8. Backward compatibility with legacy automations (no steps array)

Acceptance criteria:
- New automations use steps[] array format
- Legacy automations continue to work without modification
- fbc/fbp cookies captured even when FB Pixel loads slowly
- Webhook payloads include fbc, fbp, user_agent when available
- Null fields can be optionally excluded from payloads

Technical constraints:
- FastAPI backend with MongoDB
- React frontend with TanStack Query, Shadcn/UI, Tailwind
- Must work with existing shumard.js tracker script
- Brand colors: #030352 (navy), #A31800 (red)
</product_requirements>

<key_technical_concepts>
Languages and runtimes:
- Python 3.x (FastAPI backend)
- JavaScript/JSX (React frontend)
- MongoDB (database)

Frameworks and libraries:
- FastAPI with Pydantic models
- React with TanStack Query for server state
- Shadcn/UI component library
- Tailwind CSS for styling
- Framer Motion for animations

Design patterns:
- Step pipeline execution pattern for automations
- Webhook payload builder with field mapping
- Cookie-based attribution tracking
- Deduplication via atomic MongoDB operations

Architectural components:
- shumard.js: Client-side tracking script (embedded in server.py)
- _execute_step_pipeline(): Sequential step processor for new automations
- _run_automations(): Automation trigger system (supports both legacy and new)
- _build_webhook_payload(): Payload construction with exclude_nulls option
- _fire_webhook_task(): Async webhook delivery with delay support

External services:
- Facebook Pixel (sets _fbc/_fbp cookies)
- Webhook endpoints (httpbin.org for testing)
</key_technical_concepts>

<code_architecture>
Architecture overview:
- Tracker script (shumard.js) captures user data including FB cookies
- Backend stores contacts with attribution data including fbc/fbp
- Automations triggered on lead identification
- Step pipeline executes sequentially: wait_for → filter → delay → webhook
- Webhook payloads built from contact data with optional null filtering

Data flow:
```
Browser → shumard.js captures _fbc/_fbp cookies
       → POST /api/track/lead with attribution
       → safe_attribution() validates fbc/fbp as known fields
       → _upsert_contact() stores in MongoDB
       → _run_automations() triggers matching automations
       → _execute_step_pipeline() processes steps[]
       → _build_webhook_payload() extracts fbc/fbp from attribution
       → Webhook receives payload with fbc, fbp, user_agent
```

Files modified:

/app/backend/server.py
- Purpose: Main backend application with API routes and tracker script
- Changes:
  - Added fbc/fbp to Attribution model (lines 45-46)
  - Added fbc/fbp to safe_attribution known fields (line 350)
  - Added fbc/fbp to attr_signal_fields in _upsert_contact (line 483)
  - Added user_agent field to Contact, ContactWithStats, ContactDetail models
  - Added _execute_step_pipeline() function for new automation format
  - Added _validate_automation_steps() for backend validation
  - Added GET /api/automations/{id} endpoint
  - Updated _build_webhook_payload() with exclude_nulls parameter
  - Updated _fire_webhook_task() with exclude_nulls parameter
  - Updated shumard.js: captureAttribution() saves fbc/fbp to localStorage
  - Updated shumard.js: Added 2-second delayed fbc/fbp re-capture
  - Updated shumard.js: sendLead/sendRegistration refresh cookies before sending
  - Updated shumard.js: buildPayload() includes user_agent

/app/frontend/src/components/AutomationBuilderPage.jsx
- Purpose: New full-page Zapier-style automation builder
- Changes: Created new file (853 lines)
- Key components:
  - WaitForEditor: Toggle email/phone/name fields
  - FilterEditor: Add/remove conditions with operators
  - DelayEditor: Set seconds value
  - WebhookEditor: URL, name, field mapping, exclude_nulls checkbox
  - StepCard: Renders step with reorder/delete controls
  - AddStepMenu: Dropdown to add new steps

/app/frontend/src/components/AutomationsPage.jsx
- Purpose: Automations list page
- Changes:
  - Removed AutomationBuilder modal import
  - Added useNavigate for routing to new builder
  - Updated handlers to navigate to /automations/new and /automations/builder/:id

/app/frontend/src/components/ContactDetailModal.jsx
- Purpose: Contact detail view modal
- Changes:
  - Added User Agent row to Overview tab
  - Added fbc (FB Click) and fbp (FB Browser) to Attribution tab
  - Renamed section to "Click IDs & FB Cookies"

/app/frontend/src/App.js
- Purpose: Main application router
- Changes:
  - Added import for AutomationBuilderPage
  - Added routes: /automations/new and /automations/builder/:id
</code_architecture>

<pending_tasks>
Tasks not completed:
1. Add exclude_nulls option to legacy automations (only new step-based automations have it)
2. Add gclid/wbraid/gbraid tracking for Google Ads Enhanced Conversions
3. Add unsaved changes warning when navigating away from builder
4. Add step duplication feature
5. Add smooth reorder animations (currently instant)

Known limitations:
- fbc/fbp cookies depend on Facebook Pixel being loaded on the page
- 2-second delay may not be sufficient for very slow FB Pixel loads
- Legacy automations without steps[] don't have exclude_nulls option
</pending_tasks>

<current_work>
Features now working:
1. Full-page automation builder at /automations/new and /automations/builder/:id
2. Four step types: Wait For, Filter, Delay, Webhook
3. Step reordering with Up/Down arrows
4. Step deletion with confirmation dialog
5. Legacy automation conversion when editing (converts to steps format)
6. Backend validation for webhook URLs (must start with http/https)
7. Backend validation for filter values (required for equals/contains)
8. User agent tracking: captured by tracker, stored on contact, sent in webhooks
9. fbc/fbp tracking: captured from _fbc/_fbp cookies, stored in attribution, sent in webhooks
10. Exclude null fields option in webhook steps (default: enabled)
11. Contact detail modal shows user_agent, fbc, fbp with copy buttons

Verified working via testing:
- End-to-end test: fbc/fbp flow from tracker → backend → webhook payload
- Legacy automations continue to work
- New step-based automations execute correctly
- Webhook payloads include: email, contact_id, client_ip, user_agent, utm_source, fbclid, fbc, fbp

Build status:
- Frontend compiles without errors (esbuild verified)
- Backend starts without errors
- All services running (supervisorctl status: RUNNING)

Test coverage:
- Manual API testing via curl
- Testing agent verification (90%+ success rate)
- End-to-end fbc/fbp tracking verified
</current_work>

<optional_next_step>
1. Deploy to production and verify fbc/fbp cookies are captured from real Facebook traffic
2. Monitor webhook payloads to confirm fbc/fbp values are populated
3. If fbc/fbp still null in production, consider increasing delayed re-capture from 2s to 3-5s
4. Add exclude_nulls option to legacy automations for consistency
</optional_next_step>