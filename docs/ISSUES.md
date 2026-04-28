# Issues And Deferred Work

This document is tracking-only. It does not define expected behavior.

## Known Limitations

### WF01

- Persistent email idempotence is missing. Recommended key: `email_id`, with fallback to `messageId` and `receivedDate`.
- No REST fallback exists in the latest documented workflow.
- No SLA sweep, relance, or escalation workflow is currently part of the final WF01 behavior.

### WF02

- Remote n8n workflow id for WF02 is pinned in the repository root `.env` as `N8N_WORKFLOW_ID_WF02`; the repository deploys it via `./tools/deploy.sh wf02` with the new [subworkflow-dependencies.json](../workflows/wf02-document-validation/subworkflow-dependencies.json) (auto-deploys the shared unwrap sub-workflow first and injects its remote id into the three `Unwrap MCP …` Execute Workflow nodes).
- **Breaking change (repo anglicization):** approval query params and state keys are now `role=artistic|technical` with decisions `PENDING|APPROVED|REJECTED` (replaces French `artistique` / `technique` and `EN_ATTENTE` / `APPROUVE`). Update any saved approval URLs or tests.
- The workflow uses static/demo actor mappings (`nadia`, `etienne`, fallback `claire`).
- **Resolved (2026-04-27):** approval state and intake idempotency now persist in two n8n Data Tables (`wf02_approvals`, `wf02_processed_documents`) instead of `$getWorkflowStaticData`; the workflow self-bootstraps via `Ensure Tracking Table` / `Ensure Approvals Table`. See [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) section 12.5. New tenant prerequisite: the n8n Data Tables feature must be enabled (already required by WF04).
- **MCP create_task_in_project:** execution **1657** showed the workflow emitting **`project_id`** while some error text showed **`projectId`** (n8n MCP Client layer). A separate root cause on exo-mips-ft was using the **wrong `project_id`** (e.g. **117** vs board **2**); a minimal numeric payload matching [SPEC.technical.md §12.3](../workflows/wf02-document-validation/SPEC.technical.md) succeeds. **`list_project_statuses`** (eXo MCP) returns all `status_id` values for a `project_id`; canonical defaults for exo-mips-ft project **2** are now **`6` (InProgress)** and **`8` (Done)** in `workflow.json` / `config.env.example`.
- Production hardening still open: short-lived signed approval tokens, strict role checks, idempotent re-stamp protection, and dynamic `status_id` resolution via `list_project_statuses`.

### WF03

- **WF03**: heavy HTML/report logic lives in portfolio-local UTIL exports under `workflows/wf03-weekly-steering/subworkflows/`; main graph uses **Set**, **Execute Workflow** (unwrap + report + compose), and one small **Decide Note Upsert** Code node. REST deploy from git uses `./tools/deploy.sh wf03` with [subworkflow-dependencies.json](../workflows/wf03-weekly-steering/subworkflow-dependencies.json) (see [README](../workflows/wf03-weekly-steering/README.md)). Further native-only tweaks (Split Out / Aggregate for tasks) remain optional; see this document and the workflow README.
- [UNCERTAIN] Activation status and latest successful execution evidence are not documented in the same style as WF01.

### WF04

- `EXO_SPACE_NAME` is mandatory and missing values stop the workflow.
- The MCP endpoint is documented as hardcoded in multiple nodes in the reverse-engineered workflow.
- Processing is capped at five documents per run.
- There is no rollback if description update succeeds but category assignment fails.
- One Code node remains for category assignment mapping after the native-node refactor.

## Cross-Cutting Issues

- MCP response formats are heterogeneous and often require envelope parsing before business logic.
- Some `.env.example` files contain older-looking settings that may not match the latest workflow specs.
- WF04’s import-shaped canonical JSON plus optional full-export snapshot under `fixtures/` is described in [ADR 0002](ADR/0002-repository-layout-workflows.md); other workflows should keep a single `workflow.json` unless a `fixtures/`* snapshot is explicitly documented.
- Secrets and live API keys must not be committed; example config should remain placeholder-only.