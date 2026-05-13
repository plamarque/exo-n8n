# Issues And Deferred Work

This document is tracking-only. It does not define expected behavior.

## Known Limitations

### WF01

- Persistent email idempotence is missing. Recommended key: `email_id`, with fallback to `messageId` and `receivedDate`.
- No REST fallback exists in the latest documented workflow.
- No SLA sweep, relance, or escalation workflow is currently part of the final WF01 behavior.

### WF02

- Remote n8n workflow id for WF02 is pinned in the repository root `.env` as `N8N_WORKFLOW_ID_WF02`; the repository deploys it via `./tools/deploy.sh wf02` with [subworkflow-dependencies.json](../workflows/wf02-document-validation/subworkflow-dependencies.json) (auto-deploys the unwrap UTIL workflow first and injects its remote id into **`Unwrap MCP Create Task`** only — **`get_document_by_id`** reads **`content[0].text`** on the raw MCP item).
- **Breaking change (repo anglicization):** approval query params and state keys are now `role=artistic|technical` with decisions `PENDING|APPROVED|REJECTED` (replaces French `artistique` / `technique` and `EN_ATTENTE` / `APPROUVE`). Update any saved approval URLs or tests.
- The workflow uses static/demo actor mappings (`nadia`, `etienne`, fallback `claire`).
- **Resolved (2026-04-27):** approval state and intake idempotency now persist in two n8n Data Tables (`wf02_approvals`, `wf02_processed_documents`) instead of `$getWorkflowStaticData`; the workflow self-bootstraps via `Ensure Tracking Table` / `Ensure Approvals Table`. See [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) §5.1. New tenant prerequisite: the n8n Data Tables feature must be enabled (already required by WF04).
- **Intake search shape (2026-05-07):** **`Split Out Documents`** uses **`fieldToSplitOut`: `content[0].text`** on the raw **`MCP Search Folder Docs`** item (array of document rows). If the MCP adapter changes shape, see [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) §3.3 and §7.
- **Deferred Data Table bootstrap (2026-05-07):** `wf02_processed_documents` / `wf02_approvals` use `createIfNotExists` immediately before first read or write on their branch (see [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) §4). Intake runs **`Ensure Tracking Table`** in **parallel** with **`MCP Search Folder Docs`** from the same trigger. Two approvals ensures (`intake` + `form branch`) duplicate the same `createIfNotExists` for teaching and cold-start form paths.
- **`MCP Search Folder Docs` (2026-05-07):** Manual `search_documents` mapping with **`limit` 100** / **`offset` 0** — intake pulls up to **100** folder hits per run; **`Merge Docs to Process`** filters to unseen or updated docs. Folders with more than **100** candidates may need a higher `limit` or paginated `search_documents` calls (not in the current graph).
- **`Merge Docs to Process` / AlaSQL (2026-05-07):** Merge **SQL Query** runs on **AlaSQL**, not SQLite — **`json_extract`** is unavailable and causes **`alasql.fn.json_extract is not a function`**. Canonical SQL uses **`input1.created_username.username`** (see [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) §3.3).
- **`Merge Docs to Process` “No output data” (2026-05-07):** Usually **not** a crash — the SQL returned **zero rows**. Typical cause: **`wf02_processed_documents`** still has rows for those **`documentId`** values with **`lastProcessedDate` ≥** the document timestamp from search (idempotent skip). Inspect Merge **Input 2** (`Get Processed Docs`): real rows there mean the tracking table was **not** empty for that run. Empty **`input2`** (no Data Table rows) is handled without an intermediate Code node on verified n8n builds (**`alwaysOutputData`** on **`Get Processed Docs`**); if a future n8n version breaks **`combineBySql`** with zero **`input2`** items, reintroduce a placeholder guard (see [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) §6–§7).
- **MCP create_task_in_project:** execution **1657** showed the workflow emitting **`project_id`** while some error text showed **`projectId`** (n8n MCP Client layer). A separate root cause on reference tenant was using the **wrong `project_id`** (e.g. **117** vs board **2**); a minimal numeric payload matching [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md) succeeds. **`list_project_statuses`** (eXo MCP) returns all `status_id` values for a `project_id`; canonical defaults for reference tenant project **2** are now **`6` (InProgress)** and **`8` (Done)** in `workflow.json` / `config.env.example`.
- Production hardening still open: short-lived signed approval tokens, strict role checks, idempotent re-stamp protection, and dynamic `status_id` resolution via `list_project_statuses`.

### WF03

- **WF03 didactic slice (2026-05-13)**: the parent graph is now self-contained — the two WF03 UTIL exports (`wf03-build-report-context`, `wf03-compose-steering-note-html`) and every `Unwrap MCP JSON` Execute Workflow hop were removed; the report table, AI agenda/watch lists, and annexes links are produced by native **Split Out** + **Aggregate** + **HTML** nodes, with one short **`Compose Steering Note HTML`** Code node for template token surgery. REST deploy uses `./tools/deploy.sh wf03` (no `subworkflow-dependencies.json`); see [README](../workflows/wf03-weekly-steering/README.md) and [SPEC.technical.md §7](../workflows/wf03-weekly-steering/SPEC.technical.md#7-didactic-simplification-slice-adr-0004).
- **WF03 deferred hardening (tutorial trade-offs)** — reintroduce only when a tenant requires it:
  - MCP envelope variance: the graph trusts `content[0].text.<field>` for every MCP response (template body, task list, search results, note url). Tenants that wrap responses differently must re-add `unwrap-mcp-json` Execute Workflow hops upstream of each affected node.
  - Task shape variance: the progress table HTML and the LLM payload trust each task to carry `task_id`, `title`, `assignee.username`, `status.status`, `due_date`, `priority`, and `description`. Missing fields render as `undefined`.
  - Template language: French→English heading translation and HTML entity decoding (previously in the compose UTIL) are gone. If a tenant ships a legacy French template, restore the translation map inside `Compose Steering Note HTML` or update the template note in eXo to English.
  - Upsert concurrency: `IF Note Exists` keys on exact title-match only (last write wins on concurrent reruns of the same meeting slot).
  - URL building: `space_slug` and `exo_base_url` are static literals inside `Prepare Steering Config`; not externalized to root `.env`.
- [UNCERTAIN] Activation status and latest successful execution evidence are not documented in the same style as WF01.

### WF04

- **`EXO_SPACE_NAME`** and **`WF04_SPACE_ID`** must be set correctly in root **`.env`** (or literals hand-edited in **`workflow.json`**); the canonical graph has **no** entry IF that blocks empty or wrong values.
- Wrong **`WF04_SPACE_ID`** misroutes **`search_documents`**; there is no in-graph **`get_my_spaces`** check (didactic trade-off — see [SPEC.technical.md §7](../workflows/wf04-metadata-enrichment/SPEC.technical.md)).
- WF04 no longer filters list rows for missing **`document_id`** before merge; operators rely on **`search_documents`** returning usable rows (see [SPEC.technical.md §5.3](../workflows/wf04-metadata-enrichment/SPEC.technical.md)).
- MCP **`endpointUrl`** is repeated on each MCP Client node (demo literal in git until **`npm run generate:workflow-json`** rewrites from **`EXO_MCP_ENDPOINT`**).
- Processing is capped at five documents per run.
- There is no rollback if description update succeeds but category assignment fails.
- Category suggestions are matched to **`exo_category_cache`** on **exact** string equality with **`category_label`** (Unicode/accent drift is not normalized in the two-column slice); optional evolution is a **`normalized_label`** column at sync time (see [SPEC.technical.md §5.3](../workflows/wf04-metadata-enrichment/SPEC.technical.md)).
- **`Flatten Category Tree`** is the only **Code** node left in WF04: MCP **`get_category_tree`** returns nested **`sub_categories`**, which n8n does not flatten natively without a loop or custom tool; label → **`category_id`** resolution uses **Data Table** **get** (`Lookup Category By Label`) instead of merge/Code lookup.

## Cross-Cutting Issues

- MCP response formats are heterogeneous and often require envelope parsing before business logic.
- Some `.env.example` files contain older-looking settings that may not match the latest workflow specs.
- WF04’s import-shaped canonical JSON plus optional full-export snapshot under `fixtures/` is described in [ADR 0002](ADR/0002-repository-layout-workflows.md); other workflows should keep a single `workflow.json` unless a `fixtures/`* snapshot is explicitly documented.
- Secrets and live API keys must not be committed; example config should remain placeholder-only.
- **[deferred] Normalize tenant-specific ids before commit.** n8n exports often carry tenant-bound fields (top-level `"id"`, per-node `webhookId`, embedded credential ids, `meta.instanceId`, …). Since deploy bootstrap (2026-05-07) no longer reads `workflow.json.id` as a fallback, those fields are dead weight in git and a portability hazard across tenants. Open question (to be designed in a follow-up slice): introduce a normalization step — for example a `tools/normalize-workflow-json.mjs` pre-commit hook or an opt-in flag on `download:workflow` — that strips the agreed list of tenant-specific fields. Until then, treat any committed remote id as informational and rely on `.env` for deploy resolution. Tracked alongside the bootstrap delivery in [PLAN.md](PLAN.md).