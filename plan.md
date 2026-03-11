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
- POC: Not required (CRUD + simple auth only)

## 2) Implementation Steps (Phased)

### Phase 1 — V1 Builder Page (In Progress)
Core pages/components
- Add routes in App: /automations/new and /automations/builder/:id
- Create components/AutomationBuilderPage.jsx (full-page)
  - Header: name, enabled toggle, Save/Cancel
  - Steps list: render each step with editor + Up/Down + Remove
  - Add Step menu: Wait For, Filter, Delay + Refetch, Send Webhook
  - Empty, loading, and error states; data-testid attributes on all interactive controls
- Data model (frontend):
  - wait_for: { fields: string[] }
  - filter: { filters: [{ id, field, operator, value? }] }
  - delay: { seconds: number, refetch: true }
  - webhook: { name?, url, headers?: Record<string,string>, field_map?: [{ id, source, target }] }
- API integration (TanStack Query):
  - GET /api/automations/:id (edit); POST /api/automations (create); PUT /api/automations/:id (save)
  - On save, persist only steps (and name/enabled). Legacy fields sent empty unless explicitly needed.
- Reordering: Up/Down moves array elements (pure function) with optimistic UI; disable when first/last
- UX: “Back to Automations” breadcrumb, sticky footer Save, toasts via Sonner
- User Stories (Phase 1)
  1. As a user, I can create a new automation at /automations/new and set its name and enabled state.
  2. As a user, I can add a Wait For step and choose multiple required fields (email/phone/name).
  3. As a user, I can add Filter conditions with field/operator/value and remove conditions.
  4. As a user, I can add a Delay step and set seconds to wait (with refetch implied).
  5. As a user, I can add a Webhook step with URL, optional headers, and field mappings.
  6. As a user, I can reorder steps using Up/Down to change execution order.
  7. As a user, I can save and see my steps persisted to the automation.
- Testing (end of phase):
  - Call testing agent to verify add/remove/reorder/save flows and API payload consistency.

### Phase 2 — Integrate With Automations Index
- Update AutomationsPage: New button links to /automations/new; Edit opens /automations/builder/:id
- Legacy modal (AutomationBuilder.jsx) retained but hidden/not used by default
- When editing legacy automations (no steps), hydrate builder from legacy fields (required_fields → wait_for; filters → filter step; actions/webhook_url → one or more webhook steps)
- On save from new builder, store steps[]; keep legacy fields cleared or synced as needed for backend compatibility
- User Stories (Phase 2)
  1. As a user, clicking New Automation navigates to the new builder page.
  2. As a user, clicking Edit on an existing automation opens the full-page builder with prefilled data.
  3. As a user, a legacy automation loads into the builder as equivalent steps I can edit.
  4. As a user, saving redirects me back to /automations and refreshes the list.
  5. As a user, errors show friendly messages with a Retry action.
- Testing: playwright E2E (navigation, load, edit, save) + API payload snapshots

### Phase 3 — Polish & Reliability
- Add: duplicate step, confirm on remove, unsaved-changes prompt, keyboard reordering (optional)
- Improve headers editor UX (JSON textarea with validation for custom headers)
- Inline validation for URLs, seconds ≥ 0, at least one field in Wait For, etc.
- Visual pipeline: numbered badges and type icons for quick scanning
- User Stories (Phase 3)
  1. As a user, I can duplicate an existing step to speed up configuration.
  2. As a user, I get a confirm dialog before removing a configured step.
  3. As a user, I’m warned if I try to navigate away with unsaved changes.
  4. As a user, invalid inputs are clearly highlighted with guidance.
  5. As a user, the step list is visually scannable with clear type badges.
- Testing: validation and guardrails; ensure no regression on core flows

### Phase 4 — Stabilization & Back-Compat
- Ensure backend correctly prioritizes steps[] pipeline when present and falls back when absent
- Add converter in UI: “Convert legacy automation to steps” (one-click)
- Small migrations: ensure field_map id stability; maintain deterministic payload order
- Docs: quick how-to and examples for each step type
- User Stories (Phase 4)
  1. As a user, I can convert a legacy automation to steps with one click.
  2. As a user, I can safely revert edits without breaking legacy behavior.
  3. As a user, I see a short guide for each step type inline.
  4. As a user, I trust that saved automations won’t silently change behavior.
  5. As a user, I can export/import an automation JSON (optional later).
- Testing: verify backend honors steps pipeline; smoke test live triggers in staging

## 3) Next Actions (Immediate)
1. Add routes /automations/new and /automations/builder/:id in App
2. Scaffold components/AutomationBuilderPage.jsx with header, list, and add-step controls
3. Implement step editors (WaitForEditor, FilterEditor, DelayEditor, WebhookEditor)
4. Wire TanStack Query: fetch (edit) and save (create/update) with invalidate/redirect
5. Implement Up/Down reordering and optimistic UI; add data-testid on all controls
6. Run initial E2E via testing agent; fix critical issues

## 4) Success Criteria
- Dedicated builder routes load and render without console errors
- All four step types can be added, configured, reordered, and removed
- Saving persists steps[] to the backend and reloads correctly
- Legacy automations load into the builder and can be saved as steps
- TanStack Query cache invalidation keeps /automations list in sync
- UI follows brand (#030352, #A31800), Shadcn patterns, and includes data-testid
- Testing agent passes core add/remove/reorder/save scenarios; no regressions in Automations list
