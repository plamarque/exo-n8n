# Delivery Plan

This document is tracking-only. It does not define expected behavior.

## Current State

- Governance documentation lives in `docs/`; `AGENTS.md` is at the repository root. Workflow artifacts use the layout in [ADR 0002](ADR/0002-repository-layout-workflows.md) (`workflows/`, one `workflow.json` per portfolio workflow, `shared/` and `tools/`).
- **WF01**: canonical JSON and split specs; persistent email idempotence still open (see [ISSUES](ISSUES.md)).
- **WF02**: canonical JSON + split specs; **native refactor (2026-04-27)** plus **didactic slice (2026-05-07)** — HTML node for task description, Manual `create_task` mapping, Split Out on **`content[0].text`** for search, raw **`get_document_by_id`** (**`content[0].text`**) without UTIL (UTIL unwrap **create_task** only); **deferred** Data Table `createIfNotExists` (before first use, not on trigger); **Merge input** connects **`Get Processed Docs`** directly to **`Merge Docs to Process`** (no intermediate merge-input Code node); approval branch uses **`Approval Form`** → **`IF Valid Approval`** + **`Get Approval Rows`** and inline merge expressions (no **`Merge Decision`** Code node; plus optional guards elsewhere); unwrap via [subworkflow-dependencies.json](../workflows/wf02-document-validation/subworkflow-dependencies.json).
- **WF03**: canonical `workflow.json` + API snapshot in `fixtures/`; **Code-node reduction** still pending (contrast: WF01/WF04 more advanced).
- **WF04**: canonical `workflow.json` + `fixtures/workflow.export.snapshot.json`; didactic slice (2026-05-11) — **`WF04_SPACE_ID`** + parallel tracking ensure before merge; Manual **`add_content_to_category`**; optional API push via `tools/push-workflow-to-n8n-api.mjs` / `npm run deploy:workflow`.

## Didactic simplification slices (WF01 principles → WF02–WF04)

Normative checklist: [ADR 0004 — Didactic workflow simplification](ADR/0004-didactic-workflow-simplification-slices.md). WF01 is the reference slice (minimal expressions, Split Out for lists, IF for noise only, HTML node for description, MCP parameter hygiene, parser enums aligned with tools, no redundant `assign_task` when create carries assignee, optional omission of unwrap when payload allows).

| Slice | Workflow | Intent |
| ----- | -------- | ------ |
| [x] | **WF02** — Document validation | Apply ADR 0004 (2026-05-07): UTIL for **`create_task`** only; **`search_documents`** → Split Out on **`content[0].text`**; **`get_document_by_id`** inline from raw MCP item; HTML node for task body; `create_task` Manual + `removed` schema; trade-offs in [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) §7. |
| [ ] | **WF03** — Weekly steering | Apply ADR 0004: reduce Code-only branches where native Split/Aggregate/IF suffice for teaching path; simplify expressions; align any AI output schema with downstream MCP/UI; document unwrap/split assumptions. |
| [x] | **WF04** — Metadata enrichment | Apply ADR 0004 (2026-05-11): inject **`WF04_SPACE_ID`** (no runtime **`get_my_spaces`**); parallel **Ensure Tracking Table** → **Get Processed** before merge; **Map suggested label to category_id** + Manual **`add_content_to_category`**; trade-offs in [SPEC.technical.md](../workflows/wf04-metadata-enrichment/SPEC.technical.md) §7. |

Each completed slice updates canonical `workflow.json`, per-workflow `SPEC.*.md` / `README.md`, and cross-project docs when observable rules change.

## Near-Term Tasks

- [x] Authoritative artifact per workflow: `workflows/.../workflow.json` (see [ADR 0002](ADR/0002-repository-layout-workflows.md)); secondary snapshots in `fixtures/` only.
- [ ] Resolve configuration drift between per-workflow `config.env.example` and live n8n variables.
- [x] Re-import/update WF02 from repository JSON and rerun manual validation. (2026-04-27 — `./tools/deploy.sh wf02` push of refactored canonical JSON; manual end-to-end approval round-trip still recommended on the live tenant.)
- [ ] Add persistent email idempotence to WF01 if the workflow is expected to run repeatedly.
- [x] Refactor **WF02** toward more native n8n nodes. (2026-04-27 — baseline refactor.) Didactic slice (2026-05-07): [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) §7.
- [ ] Optional further **WF03** native-only tweaks (Split Out / Aggregate for tasks, etc.) — heavy HTML/report Code remains in portfolio-local UTILs; see [README](../workflows/wf03-weekly-steering/README.md) and [ISSUES](ISSUES.md).
- [x] Reuse shared `unwrap-mcp-json` sub-workflow in WF02 (2026-04-27, via [subworkflow-dependencies.json](../workflows/wf02-document-validation/subworkflow-dependencies.json) — WF03/WF04 evaluation still open).
- [x] **Deploy auto-bootstrap (`.env`-driven)** (2026-05-07 — `./tools/deploy.sh <shortId>` POST-creates workflows when `N8N_WORKFLOW_ID_<SHORTID>` is unset and writes the new id back to `.env`; same logic for declared subworkflow dependencies. Legacy `workflow.json.id` fallback removed; `--create-missing-deps` is now a no-op alias. Tests: [tools/lib/n8n-workflow-deploy-orchestrator.test.mjs](../tools/lib/n8n-workflow-deploy-orchestrator.test.mjs), [tools/lib/env-writer.test.mjs](../tools/lib/env-writer.test.mjs)).
- [ ] **Normalize tenant-specific ids before commit** — strip `id`, `webhookId`, etc., from canonical `workflow.json` so committed graphs stay portable across tenants. Tracked in [ISSUES.md](ISSUES.md#cross-cutting-issues). Deferred slice; pairs with the new bootstrap behavior.

## Done Criteria For Documentation Governance

- Governance docs exist in the expected locations.
- Assumptions and uncertainties are explicitly marked.
- Workflow-specific docs and governance docs do not knowingly contradict each other without a corresponding entry in `docs/ISSUES.md`.

