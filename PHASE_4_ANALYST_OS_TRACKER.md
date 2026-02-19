# Toeasy Analyst OS Phase 4 Tracker

Last updated: February 19, 2026
Owner: Product + Engineering
Execution window: 24 weeks
Scope: RevOps-first Analyst Team OS

## 1) Objective
Deliver a Decision Room that supports the full weekly RevOps analyst cycle end-to-end with evidence-first publish controls, team collaboration, and resilient automation.

## 2) Definition of Done
- 85% of weekly RevOps analyst workflow is completed in Toeasy without external BI switching.
- 90% of published claims have valid evidence links.
- Median time-to-first-insight < 30 minutes.
- Median insight-to-assigned-action < 24 hours.
- Manual status updates reduced by >= 60% in pilot teams.

## 3) Program Status
- Overall phase: `Phase 3.2 -> Phase 4 (in progress)`
- Current sprint focus: `Phase C + D + E foundations`
- RAG:
  - Data and query foundation: `Green`
  - Visualization and analyst exploration depth: `Green`
  - Semantic metrics and evidence contract: `Green`
  - Collaboration and communication: `Green`
  - Automation reliability and scheduling: `Yellow`

## 4) Completed (Implemented)
- [x] Report V2 evidence-first generate/latest/quality/publish endpoints.
- [x] Report V2 quality gate (unsupported claims block publish).
- [x] Room communication baseline (threads/comments/mentions/checkpoints/approvals).
- [x] New phase-4 schema foundations:
  - [x] `metric_definition_tests`
  - [x] `visual_specs`
  - [x] `automation_schedules`
  - [x] `automation_run_events`
  - [x] `room_outcome_attributions`
  - [x] `comment_thread_resolutions`
- [x] Completion schema expansion:
  - [x] `dataset_profiles`
  - [x] `query_versions`
  - [x] `visual_annotations`
  - [x] `review_submissions`
  - [x] `idempotency_keys`
- [x] Workspace feature flags seeded for phase-4 capabilities.
- [x] New Analyst OS APIs:
  - [x] `GET /metrics/catalog`
  - [x] `POST /metrics/validate`
  - [x] `POST /visuals/build`
  - [x] `POST /visuals/:visualId/drill`
  - [x] `POST /comments/:threadId/resolve`
  - [x] `GET /outcomes/attribution`
  - [x] `GET /playbooks/recommendations`
  - [x] `POST /automations/schedule`
  - [x] `GET /automations/runs`
- [x] Completion APIs (Phase 4 pilot-production slice):
  - [x] `POST /data/profile`
  - [x] `GET /data/trust`
  - [x] `POST /queries/save-version`
  - [x] `GET /queries/:queryId/versions`
  - [x] `POST /pivots/compute`
  - [x] `POST /visuals/:visualId/annotate`
  - [x] `POST /review/submit`
  - [x] `POST /review/respond`
  - [x] `GET /review/submissions`
  - [x] `GET /visuals/:visualId/annotations`
  - [x] `GET /evidence/coverage-trend`
  - [x] `GET /roi`
- [x] Idempotency guardrails:
  - [x] Report V2 publish idempotency
  - [x] Action sync idempotency
- [x] Studio wiring for completion slice:
  - [x] Sheets panel data profile trigger + trust state
  - [x] Pivot API compute action
  - [x] Report review lane controls (submit/respond/list with selector UX)
  - [x] Visual annotation controls in advanced visual flow
  - [x] Right-rail cards for trust, evidence trend, and room ROI
- [x] Studio UX upgrades:
  - [x] Semantic metrics panel with validation action.
  - [x] Advanced visual build + drill controls.
  - [x] Playbook recommendation panel.
  - [x] Automation reliability panel.
  - [x] Outcome attribution panel.
  - [x] Thread resolve/reopen controls.
- [x] API contract tests updated for all new Studio endpoints.
- [x] Queue-ready automation execution service extracted for reuse.
- [x] BullMQ automation runtime foundation:
  - [x] recurring due-schedule dispatcher worker
  - [x] scheduled execution worker with retry/backoff policy
  - [x] startup/shutdown queue lifecycle in backend server
  - [x] queue health API (`/automations/queue-state`)

## 5) In Progress (Current Slice)
- [x] Route-level execution unified on shared execution service paths.
- [x] Queue-backed runtime stabilization under multi-instance load.
- [x] Operational guardrails:
  - [x] deterministic dedupe behavior for schedule dispatch
  - [x] robust actor resolution for schedule-triggered runs
  - [x] retry/backoff observability in run event timeline
- [x] Full frontend UX adoption of newly added completion APIs (data trust, review lane, coverage trend, ROI cards).
- [x] UX polish and flow simplification for review controls (replaced raw ID inputs with role-aware pickers/selectors).

## 6) Pending by Phase
### Phase A (Weeks 1-4): Data + Query Hardening
- [ ] connector-native SQL profile management and credential validation depth
- [x] ingestion profiling API: missingness, duplicates, date continuity, invalid numerics
- [x] dataset profiling persistence and room trust endpoint
- [x] full Studio UI quality card polish for profile/trust

### Phase B (Weeks 5-8): Exploration Depth
- [x] pivot compute API with calculated outputs (`rank`, `% of total`, formula)
- [x] pivot UI depth/polish for calculated workflows
- [x] cross-filter interactions between visuals and result tables
- [x] visual annotation API persistence
- [x] chart annotation UX/pinned insight polish
- [x] RevOps visual template library polish

### Phase C (Weeks 9-12): Semantic Metrics + Evidence Contract
- [x] metric owner assignment/editing workflows
- [x] metric test policy rules and fail-fast publish linkage
- [x] room evidence coverage trend telemetry

### Phase D (Weeks 13-16): Collaboration + Communication
- [x] anchor-level assignment and resolved-state audit timeline
- [x] mention routing presets (manager, exec, owner group)
- [x] backend review workflow endpoints (submit/respond)
- [x] pre-publish review flow UI (draft -> manager approve -> exec notify)

### Phase E (Weeks 17-20): Automation Reliability
- [x] production scheduler with queue monitoring dashboard
- [ ] failure taxonomy and operator alerting
- [x] idempotency key persistence + publish/sync endpoint guards
- [x] extend idempotency and dedupe guarantees to remaining mutating endpoints

### Phase F (Weeks 21-24): Launch Readiness
- [x] persona presets finalized (analyst/manager/executive)
- [x] guided onboarding playbooks from first room to first publish
- [x] ROI dashboard tied to program KPIs
- [x] pilot conversion package and GTM launch checklist

## 7) Test Coverage Tracker
- [x] Studio API contract coverage for new phase-4 endpoints.
- [x] API contract tests updated for completion APIs (profile/query-version/pivot/annotate/review/coverage/roi).
- [ ] backend integration tests for visual build/drill, metrics validate, and attribution.
- [ ] backend integration tests for profile/query-version/review/idempotency paths.
- [ ] end-to-end flow test:
  - [ ] connect -> run -> pivot -> visual -> report -> publish -> action -> status draft
- [ ] queue reliability tests:
  - [ ] retry/backoff
  - [ ] duplicate prevention
  - [ ] failed schedule recovery

## 8) Risks and Mitigations
- Risk: Existing frontend type debt outside Studio slows full-repo `tsc`.
  - Mitigation: keep Studio/API scoped compile and incremental cleanup backlog.
- Risk: Schedule execution needs deterministic actor context for approvals.
  - Mitigation: actor fallback resolution (`workspace_members` admin/editor -> workspace owner).
- Risk: Multiple runtime replicas can enqueue duplicate schedule jobs.
  - Mitigation: claim row via optimistic `next_run_at` compare-and-update + stable BullMQ job IDs.

## 9) Next 7-Day Execution Plan
1. Complete BullMQ runtime integration and startup/shutdown lifecycle.
2. Add queue metrics endpoint for operator observability.
3. Add backend integration tests for schedule dispatch and run event history.
4. Validate end-to-end flow with one design-partner dataset and Slack handoff.

## 10) Change Log
- 2026-02-19 (Pilot conversion operations tranche):
  - Added pilot conversion and GTM execution artifact:
    - `PILOT_CONVERSION_CHECKLIST.md`
  - Captured day-0 to day-90 conversion workflow:
    - contract package
    - KPI baseline and weekly cadence
    - day-60 conversion motion
    - day-90 close/extend/exit outcomes
  - Defined internal ownership matrix for pilot-production operations.
- 2026-02-19 (Persona + onboarding + ROI scorecard tranche):
  - Added workspace persona profile APIs:
    - `GET /api/workspaces/:id/preferences/profile`
    - `POST /api/workspaces/:id/preferences/profile`
    - auto-seeded profile defaults per workspace/user when absent.
  - Added onboarding playbook API:
    - `GET /api/workspaces/:id/rooms/:roomId/playbooks/onboarding`
    - returns guided step cards with recommended panel routing and blockers.
  - Upgraded room ROI endpoint with program KPI scorecard:
    - target/actual status for time-to-insight, insight-to-action, manual update reduction, evidence coverage
    - overall status classification (`on_track|mixed|at_risk|unknown`).
  - Wired Studio right-rail UX:
    - persona preset selector (persona + mode)
    - onboarding playbook quick actions (`Open step`, `Mark done`)
    - ROI target attainment scorecard tied to program KPIs.
- 2026-02-19 (Analyst depth + metric policy tranche):
  - Shipped pivot UX depth controls for calculated workflows:
    - toggles for `% of total`, rank ordering, custom formula expression
    - optional pivot filter field/operator/value wiring to `pivots/compute`
  - Added Visuals cross-filter workflow between chart interactions and result tables:
    - preview + advanced chart point click applies contextual table filter
    - clearable filter state with row-count feedback
  - Added RevOps visual template library in Studio Visuals:
    - pipeline by owner, stage conversion, weekly trend, segment mix shift presets
    - template application also seeds pivot defaults for faster analyst flow
  - Upgraded Data Trust card polish in Studio right rail:
    - quality grade + threshold progress
    - issue risk counts by missingness/duplicates/date continuity/invalid numerics
    - generated timestamp visibility
  - Added semantic metric owner assignment workflow:
    - new endpoint `POST /api/workspaces/:id/rooms/:roomId/metrics/:metricId/owner`
    - owner selector in Studio Semantic Metrics panel with realtime refresh
  - Added metric-test fail-fast publish linkage for Report V2:
    - quality endpoint now merges metric policy checks into publish gating
    - publish endpoint now blocks when mapped metric validations are failed/missing/pending
    - blocker diagnostics returned in quality and publish responses.
  - Added evidence coverage telemetry enrichment:
    - quality-check event `decision_room_report_v2_quality_checked` recorded with coverage + unsupported claim counts
    - coverage-trend fallback stream now includes quality-check events.
- 2026-02-19 (Automation idempotency extension tranche):
  - Added idempotency handling to additional mutating automation APIs:
    - `POST /api/workspaces/:id/automations/:automationId/execute`
    - `POST /api/workspaces/:id/rooms/:roomId/automations/schedule`
  - Added replay/in-progress behavior for those endpoints:
    - deterministic replay payload for repeated idempotency keys
    - 409 conflict for concurrent in-flight duplicate requests
  - Persisted status/error payloads for idempotent completion on success and failure paths.
- 2026-02-19 (Phase 4 automation reliability tranche):
  - Hardened BullMQ schedule dispatch for multi-instance behavior:
    - deterministic schedule dedupe keys from `room+policy+cron+timezone`
    - dedupe-safe schedule creation returns existing schedule when intent matches
    - duplicate execute job detection during dispatch and safe skip behavior
    - schedule-claim revert when enqueue fails to prevent dropped runs
  - Upgraded actor resolution for scheduled runs:
    - validates preferred actor membership/ownership before use
    - deterministic fallback order: admin -> editor -> viewer -> workspace owner
    - actor resolution strategy now tracked in queue execution metadata
  - Added retry/backoff observability:
    - queue attempt/max-attempt/backoff context attached to run events
    - terminal vs retry-scheduled failure events recorded in `automation_run_events`
    - execution failure path now marks runs failed with structured event payloads
  - Expanded queue monitoring surfaces:
    - dispatch/execute job counts, dispatch history, and failure counters in queue state
    - Studio Automation panel now renders run-event timeline and queue runtime counters
- 2026-02-19 (Phase 4 collaboration/annotation polish tranche):
  - Added role-based mention routing presets in Studio for:
    - report publish mentions
    - comms thread creation
    - thread reply drafting
  - Added review lane workflow controls for:
    - `Submit Draft -> Manager`
    - manager approval response
    - `Notify Exec Review` escalation
  - Added comms thread ownership + anchor visibility:
    - owner selection when creating a thread
    - anchor/owner display in thread list and thread detail
    - resolution timeline details in selected thread view
  - Added visual annotation quality-of-life controls:
    - pin/unpin insights
    - push annotation to report draft
    - send annotation to comms as a new evidence thread
- 2026-02-19 (Phase 4 UX continuation tranche):
  - Added backend read endpoints for new UI flows:
    - `GET /review/submissions`
    - `GET /visuals/:visualId/annotations`
  - Upgraded Report review lane UX from raw ID fields to selectors:
    - reviewer dropdown from workspace members
    - submission selector and recent submission list
  - Added visual annotation UX to the Visuals panel and wired persisted annotation loading.
  - Updated Studio API contracts/tests for new read endpoints.
- 2026-02-19 (Phase 4 completion tranche):
  - Added migration `034_phase4_completion_core.js` with additive tables:
    - `dataset_profiles`, `query_versions`, `visual_annotations`, `review_submissions`, `idempotency_keys`.
  - Added Studio backend endpoints:
    - `POST /data/profile`, `GET /data/trust`
    - `POST /queries/save-version`, `GET /queries/:queryId/versions`
    - `POST /pivots/compute`
    - `POST /visuals/:visualId/annotate`
    - `POST /review/submit`, `POST /review/respond`
    - `GET /evidence/coverage-trend`, `GET /roi`
  - Added request idempotency handling for:
    - `POST /reports/v2/:bundleId/publish`
    - `POST /actions/sync`
  - Frontend API client expanded for all new completion endpoints and idempotency payload support.
  - Analytics Studio wired to new completion APIs:
    - Data profile generation in `Sheets`
    - Pivot compute via API
    - Report review submit/respond controls
    - Right-rail trust/coverage/ROI visibility
  - Contract tests updated (`studioMvpApi.test.ts`) and passing.
- 2026-02-19:
  - Added phase-4 schema and APIs for metrics, visuals, attribution, communication resolution, and automation scheduling.
  - Upgraded Studio UX with analyst-oriented panels and controls.
  - Added API contracts tests for new endpoints.
  - Added BullMQ queue runtime foundation and queue-state health endpoint.
  - Unified manual automation execution on shared execution service.
- 2026-02-19 (Flow Reset cutover update, commit pending):
  - Studio-first routing now canonical from login/signup/onboarding and `/app` entry.
  - Added Studio context bootstrap/navigation APIs:
    - `POST /api/workspaces/:id/studio/bootstrap`
    - `GET /api/workspaces/:id/studio/navigation`
  - Added soft-cutover feature flags in Studio API payloads:
    - `legacy_surfaces_enabled` (default false)
    - `studio_visuals_tab_enabled` (default true)
    - `studio_comms_tab_enabled` (default true)
  - Upload and dataset-library handoff now open Studio directly; no default path to `clean`.
  - Studio tabs expanded and clarified for `visuals` and `comms`; duplicated sidebar comms controls removed.
  - Sidebar now surfaces active project/room context and recent rooms from Studio navigation state.
  - Quick validation matrix:
    - backend build: PASS
    - frontend production build: PASS
    - strict full-repo `tsc --noEmit`: FAIL (pre-existing unrelated legacy type debt)
