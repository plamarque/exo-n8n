# WF04 — Metadata enrichment

**TL;DR** — On a **schedule** or **manual** run, scan a configured eXo document **space**, process each **new or changed** file (within a **per-run cap**) with **structured LLM output** to propose a **short description** and **categories**, write back through MCP, and **record state** in n8n **Data Tables** so reruns stay incremental.

## n8n canvas

![WF04 — Metadata enrichment workflow in the n8n editor](wf04.png)

**Manual Start** or **Daily Schedule (02:00)** fan out to **three parallel branches**:

- **Document selection** — **List Documents** → **Split Out Documents**; **Ensure Tracking Table** → **Get Processed For Doc** → **Merge Documents to Process** (new/changed only) → **Limit to 5 Documents**.
- **Category read** — **Ensure Category Table** → **Get Category Tree** → **Flatten Category Tree** → **Sync Category Table** → **Get Categories**.
- **Gate** — **Ready to Process** (**Merge**, **chooseBranch**: waits for capped documents + refreshed **Get Categories**, outputs document items only) → **Process Each Document**.

**Per document** (analysis, description, categories):

- **Read Document** → **Prepare AI Input** → **Analyze Document** with **GPT-4o Mini Model** and **Structured Output** → **Extract Results** → **Add Description** → **IF Description MCP OK** → **Check Description Result** (failure → **Stop - Description update failed**).
- **IF Suggested Categories** → **Split Suggested Categories** → **Lookup Category By Label** → **Enrich Category Lookup** → **Filter Matched Categories** / **Aggregate Matched Categories** → **IF Zero Category Matches** → **Assign Categories** → **IF Assign MCP OK** → **Check Assign Result** (failure → **Stop - Category assign failed**); no suggestions or no matches → **Update Tracking** directly.
- Loop ends with **Update Tracking**; when the batch finishes → **Processing Summary**.

Self-contained graph on one canvas. For tool names and payloads, see [`workflow.json`](workflow.json) and [SPEC.technical.md](SPEC.technical.md).

---

## Problem context

Without steady upkeep, document libraries accumulate **weak titles**, **missing descriptions**, and **inconsistent tagging**. Manual cleanup does not scale; fully automated tagging without guardrails can **overwrite** trusted metadata. Teams need a **hybrid**: platform writes with **AI assist**, **bounded batch size**, and **idempotency**.

## Automation objective

- **List** documents in a target space via MCP **`search_documents`** using **`WF04_SPACE_ID`** baked into **List Documents** (demo literal in git; rewritten from root **`.env`**).
- **Skip** unchanged files using **`exo_processed_documents`** and SQL merge logic (same idempotency pattern as WF02).
- **Refresh** **`exo_category_cache`** from **`get_category_tree`** once per run before the document loop.
- For each capped item: **structured** LLM analysis, **`update_document_description`**, **`add_content_to_category`** only when a suggested label matches the cache **exactly**.
- **Upsert** tracking rows and emit **Processing Summary** counts.

The graph does **not** call **`get_my_spaces`** at runtime or block on misconfigured space ids in-graph (didactic trade-off — [SPEC.technical.md §7](SPEC.technical.md#7-didactic-simplification-adr-0004)).

## Prerequisites

WF04 needs a **document space**, a **category tree** with usable labels, and MCP write permissions. On a **new tenant**, discover **`space_id`** once during bootstrap, then align root `.env` with [config.env.example](config.env.example). Details: [SPEC.technical.md](SPEC.technical.md) §2.

**eXo**

| Prerequisite | Typical `.env` key | Why |
|--------------|-------------------|-----|
| **Space** | `WF04_SPACE_ID`, `EXO_SPACE_NAME` | **`search_documents`** scope and tracking / LLM labels; discover ids via [fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](fixtures/FIXTURE_BOOTSTRAP_PROMPT.md). |
| **Documents** in that space | — | `search_documents` lists candidates; an **empty** space yields **no work** (not an error). |
| **Category tree** | — | **`get_category_tree`** runs once per execution; LLM suggestions must **match tenant labels exactly** for assignment. |
| **MCP write access** | — | `update_document_description` and `add_content_to_category` must be allowed for the MCP user. |

**n8n**

| Prerequisite | Why |
|--------------|-----|
| **MCP OAuth** + `EXO_MCP_ENDPOINT` | All reads and writes are MCP-first; rewrite endpoint with **`npm run generate:workflow-json`** or deploy. |
| **OpenAI** or equivalent | **Analyze Document** agent with **`gpt-4o-mini`** on **GPT-4o Mini Model** and **Structured Output** parser. |
| **Data Tables** | `exo_processed_documents` and **`exo_category_cache`** — auto-created by the graph; no manual bootstrap. |
| **Self-contained graph** | No `subworkflow-dependencies.json`; set `N8N_WORKFLOW_ID_WF04` in root `.env` for deploy only. |

Wrong **`WF04_SPACE_ID`** misroutes **`search_documents`**; misaligned **`EXO_SPACE_NAME`** confuses tracking labels — verify after a tenant copy.

## Runtime variables

Set keys in **repository root `.env`**. **`./tools/deploy.sh wf04`** and **`npm run generate:workflow-json`** rewrite **List Documents** `space_id` and **Prepare AI Input** `spaceName` literals ([`tools/lib/n8n-workflow-deploy-core.mjs`](../../tools/lib/n8n-workflow-deploy-core.mjs)).

| Variable | Meaning |
|----------|---------|
| `EXO_MCP_ENDPOINT` | MCP endpoint for all WF04 MCP Client nodes. |
| `WF04_SPACE_ID` | eXo **`space_id`** (digits) for **`search_documents`** — plain integer in **List Documents** MCP **Manual** `parameters.value`. |
| `EXO_SPACE_NAME` | Display / tracking / LLM context string in **Prepare AI Input** `spaceName` literal. |
| `N8N_WORKFLOW_ID_WF04` | Remote workflow id for REST deploy; empty on first POST-create. |

## High-level flow

1. **Trigger** — **Manual Start** or **Daily Schedule** (02:00).
2. **Triple parallel** — **List Documents** | **Ensure Tracking Table** → **Get Processed For Doc** | **Ensure Category Table** → **Get Category Tree**.
3. **Document intake** — **Split Out Documents** → **Merge Documents to Process** (SQL: new/changed vs **`exo_processed_documents`**) → **Limit to 5 Documents**.
4. **Category cache** — **Flatten Category Tree** → **Sync Category Table** → **Get Categories** (`executeOnce` on tree read).
5. **Gate** — **Ready to Process** → **Process Each Document**.
6. **Per item — read & analyze** — **Read Document** → **Prepare AI Input** → **Analyze Document** → **Extract Results**.
7. **Description write** — **Add Description** → **IF Description MCP OK** → **Check Description Result**; MCP failure → **Stop - Description update failed**.
8. **Categories** — **IF Suggested Categories** → lookup path (**Lookup Category By Label**, **Enrich Category Lookup**, **Filter Matched Categories**, **Aggregate Matched Categories**, **IF Zero Category Matches**) → **Assign Categories** → **IF Assign MCP OK** → **Check Assign Result**; MCP failure → **Stop - Category assign failed**; no suggestions or no matches → **Update Tracking**.
9. **Tracking** — **Update Tracking** upserts **`exo_processed_documents`**; loop continues until the batch is done.
10. **Summary** — **Processing Summary** after **Process Each Document** completes.

## n8n design choices

| Area | Choice | Why |
|------|--------|-----|
| Readability | **Five canvas zones** | Document selection, category read, analysis, description write, category assign — one question per region (ADR 0004). |
| Intake | **Triple parallel from trigger** | Listing, tracking read, and category sync proceed without a single front-loaded Set/IF chain. |
| Safety | **Hard cap** on documents per execution | **`Limit to 5 Documents`** prevents runaway LLM + MCP cost ([SPEC.functional.md](SPEC.functional.md)). |
| Correctness | **Structured LLM output** (schema) | Short descriptions and machine-verifiable category names before MCP writes. |
| Idempotency | **Data Table `exo_processed_documents`** | Merge SQL skips unchanged docs across scheduled runs. |
| Categories | **`exo_category_cache`** refreshed each run | Tenant labels vary; exact string match required — unmatched suggestions are skipped without error. |
| Gate | **Ready to Process** (`chooseBranch`) | Category branch only **gates** the loop; document ids are unchanged for **Read Document**. |
| Failure handling | **Stop nodes** after partial MCP writes | Description or assign failures halt the item path ([SPEC.technical.md](SPEC.technical.md) §3.3). |
| Configuration | **Plain literals** in `workflow.json`; deploy from root `.env` | Tenant **`space_id`** and display name injected at generate/deploy time. |
| MCP | **No REST fallback** | MCP-first portfolio consistency ([SPEC.technical.md](SPEC.technical.md)). |

## MCP eXo interaction model

Tools used:

- **`search_documents`** — enumerate candidates in the space.
- **`get_document_by_id`** — fetch details for enrichment.
- **`get_category_tree`** — called **once** per execution; **Flatten Category Tree** walks nested JSON before **Sync Category Table**.
- **`update_document_description`** — persist summary text.
- **`add_content_to_category`** — attach resolved categories (`content_id` = `/document:` + id).

See [SPEC.technical.md](SPEC.technical.md) §3 for envelope shape, write order, and lookup rules.

## Operational considerations

- **Demo literals** — set **`WF04_SPACE_ID`** and **`EXO_SPACE_NAME`** in root **`.env`** and run **`npm run generate:workflow-json`** or **`./tools/deploy.sh wf04`** before testing on a new tenant.
- **OAuth / OpenAI** — authorize MCP and LLM credentials on the target n8n instance.
- **Category labels** — LLM output must **mirror** tenant labels exactly or assignment is skipped.
- **Per-run cap** and **no rollback** on partial failure — see [SPEC.functional.md](SPEC.functional.md) §4.

## Code vs native

The graph uses **Split Out**, **Merge**, **IF**, **Data Table**, and an **AI Agent** with structured output, plus one **`Flatten Category Tree`** Code node for nested category JSON — no other custom Code on the main path.

## Import and deploy

**REST:** From the repo root, `./tools/deploy.sh wf04` — see [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md). No `subworkflow-dependencies.json`. On a fresh tenant, leave `N8N_WORKFLOW_ID_WF04` empty: the first deploy POST-creates the workflow and writes the id back — [Deploy bootstrap](../../docs/DEVELOPMENT.md#deploy-bootstrap-env-driven). Use `--dry-run` to preview the PUT target once the id is set.

**Manual UI:** Import `workflow.json`. Run **`npm run generate:workflow-json`** so `EXO_MCP_ENDPOINT`, `WF04_SPACE_ID`, and `EXO_SPACE_NAME` match your tenant; verify MCP OAuth and OpenAI on the instance. Demo verification steps: [SPEC.technical.md](SPEC.technical.md) §6.

## References

| Artifact | Role |
|----------|------|
| [workflow.json](workflow.json) | Canonical export — name on instance: `WF04 - Metadata enrichment`. |
| [SPEC.functional.md](SPEC.functional.md) | Goals, limits, acceptance criteria. |
| [SPEC.technical.md](SPEC.technical.md) | Sequence, MCP tools, Data Table, LLM schema, demo runbook. |
| [config.env.example](config.env.example) | Example `.env` keys for deploy injection. |
| [fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](fixtures/FIXTURE_BOOTSTRAP_PROMPT.md) | Tenant bootstrap prompt for space id and display name. |
| [fixtures/workflow.export.snapshot.json](fixtures/workflow.export.snapshot.json) | Secondary full snapshot (traceability). |
