# Delivery Plan

This document is tracking-only. It does not define expected behavior.

## Current State

- Governance documentation lives in `docs/`; `AGENTS.md` is at the repository root. Workflow artifacts use the layout in [ADR 0002](ADR/0002-repository-layout-workflows.md) (`workflows/`, one `workflow.json` per portfolio workflow, `shared/` and `tools/`).
- **WF01**: canonical JSON and split specs; persistent email idempotence still open (see [ISSUES](ISSUES.md)).
- **WF02**: canonical JSON + split specs; **native refactor done (2026-04-27)** — 6 Code nodes → 2 small Code nodes: `Render Task Description HTML` + `Ensure Merge Processed Input` (empty-processed-table guard for `Merge`/`combineBySql`); approval state and intake idempotency now persist in two Data Tables (`wf02_approvals`, `wf02_processed_documents`); shared unwrap sub-workflow reused via [subworkflow-dependencies.json](../workflows/wf02-document-validation/subworkflow-dependencies.json).
- **WF03**: canonical `workflow.json` + API snapshot in `fixtures/`; **Code-node reduction** still pending (contrast: WF01/WF04 more advanced).
- **WF04**: canonical `workflow.json` + `fixtures/workflow.export.snapshot.json`; one Code node may remain for category mapping; optional API push via `tools/push-workflow-to-n8n-api.mjs` / `npm run deploy:workflow`.

## Near-Term Tasks

- [x] Authoritative artifact per workflow: `workflows/.../workflow.json` (see [ADR 0002](ADR/0002-repository-layout-workflows.md)); secondary snapshots in `fixtures/` only.
- [ ] Resolve configuration drift between per-workflow `config.env.example` and live n8n variables.
- [x] Re-import/update WF02 from repository JSON and rerun manual validation. (2026-04-27 — `./deploy.sh wf02` push of refactored canonical JSON; manual end-to-end approval round-trip still recommended on the live tenant.)
- [ ] Add persistent email idempotence to WF01 if the workflow is expected to run repeatedly.
- [x] Refactor **WF02** toward more native n8n nodes (per audit). (2026-04-27 — see [audit-code-vs-native.md](audit-code-vs-native.md) section *WF02 native refactor*.)
- [ ] Refactor **WF03** toward more native n8n nodes (per audit) — heavy HTML/report Code remains in portfolio-local UTILs.
- [x] Reuse shared `unwrap-mcp-json` sub-workflow in WF02 (2026-04-27, via [subworkflow-dependencies.json](../workflows/wf02-document-validation/subworkflow-dependencies.json) — WF03/WF04 evaluation still open).

## Done Criteria For Documentation Governance

- Governance docs exist in the expected locations.
- Assumptions and uncertainties are explicitly marked.
- Workflow-specific docs and governance docs do not knowingly contradict each other without a corresponding entry in `docs/ISSUES.md`.

