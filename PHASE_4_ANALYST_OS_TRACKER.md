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
  - Visualization and analyst exploration depth: `Yellow`
  - Semantic metrics and evidence contract: `Yellow`
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
- [ ] Queue-backed runtime stabilization under multi-instance load.
- [ ] Operational guardrails:
  - [ ] deterministic dedupe behavior for schedule dispatch
  - [ ] robust actor resolution for schedule-triggered runs
  - [ ] retry/backoff observability in run event timeline

## 6) Pending by Phase
### Phase A (Weeks 1-4): Data + Query Hardening
- [ ] connector-native SQL profile management and credential validation depth
- [ ] ingestion quality card: missingness, duplicates, date continuity, invalid numerics
- [ ] dataset profiling artifact and room trust summary card

### Phase B (Weeks 5-8): Exploration Depth
- [ ] pivot calculated columns and % of total/ranking UX
- [ ] cross-filter interactions between visuals and result tables
- [ ] chart annotations and pinned insight workflows
- [ ] RevOps visual template library polish

### Phase C (Weeks 9-12): Semantic Metrics + Evidence Contract
- [ ] metric owner assignment/editing workflows
- [ ] metric test policy rules and fail-fast publish linkage
- [ ] room evidence coverage trend telemetry

### Phase D (Weeks 13-16): Collaboration + Communication
- [ ] anchor-level assignment and resolved-state audit timeline
- [ ] mention routing presets (manager, exec, owner group)
- [ ] pre-publish review flow UI (draft -> manager approve -> exec notify)

### Phase E (Weeks 17-20): Automation Reliability
- [ ] production scheduler with queue monitoring dashboard
- [ ] failure taxonomy and operator alerting
- [ ] exactly-once publish/sync protections with request dedupe keys

### Phase F (Weeks 21-24): Launch Readiness
- [ ] persona presets finalized (analyst/manager/executive)
- [ ] guided onboarding playbooks from first room to first publish
- [ ] ROI dashboard tied to program KPIs
- [ ] pilot conversion package and GTM launch checklist

## 7) Test Coverage Tracker
- [x] Studio API contract coverage for new phase-4 endpoints.
- [ ] backend integration tests for visual build/drill, metrics validate, and attribution.
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
- 2026-02-19:
  - Added phase-4 schema and APIs for metrics, visuals, attribution, communication resolution, and automation scheduling.
  - Upgraded Studio UX with analyst-oriented panels and controls.
  - Added API contracts tests for new endpoints.
  - Added BullMQ queue runtime foundation and queue-state health endpoint.
  - Unified manual automation execution on shared execution service.
