# Delivery Plan

This document is tracking-only. It does not define expected behavior.

## Current State

- Governance documentation lives in `docs/`; `AGENTS.md` is at the repository root. Workflow artifacts use the layout in [ADR 0002](ADR/0002-repository-layout-workflows.md) (`workflows/`, one `workflow.json` per portfolio workflow, `shared/` and `tools/`).
- **WF01**: canonical JSON and split specs; persistent email idempotence still open (see [ISSUES](ISSUES.md)).
- **WF02**: canonical JSON, split specs; audit of Code → native not finished; last README notes re-import for MCP/credential issues.
- **WF03**: canonical `workflow.json` + API snapshot in `fixtures/`; **Code-node reduction** still pending (contrast: WF01/WF04 more advanced).
- **WF04**: canonical `workflow.json` + `fixtures/workflow.export.snapshot.json`; one Code node may remain for category mapping; optional API push via `tools/wf04-push-to-n8n-api.mjs`.

## Near-Term Tasks

- [x] Authoritative artifact per workflow: `workflows/.../workflow.json` (see [ADR 0002](ADR/0002-repository-layout-workflows.md)); secondary snapshots in `fixtures/` only.
- [ ] Resolve configuration drift between per-workflow `config.env.example` and live n8n variables.
- [ ] Re-import/update WF02 from repository JSON and rerun manual validation.
- [ ] Add persistent email idempotence to WF01 if the workflow is expected to run repeatedly.
- [ ] Refactor **WF02** and **WF03** toward more native n8n nodes (per audit).
- [ ] Decide if MCP unwrap / extract should be shared by WF02–WF04 the same way as WF01 (beyond current shared `unwrap` under `workflows/shared/`).

## Done Criteria For Documentation Governance

- Governance docs exist in the expected locations.
- Assumptions and uncertainties are explicitly marked.
- Workflow-specific docs and governance docs do not knowingly contradict each other without a corresponding entry in `docs/ISSUES.md`.

