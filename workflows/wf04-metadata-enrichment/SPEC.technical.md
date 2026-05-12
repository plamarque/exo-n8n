# Workflow 04 - Metadata enrichment (technical specification)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json). Secondary snapshot: [fixtures/workflow.export.snapshot.json](fixtures/workflow.export.snapshot.json).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf04-metadata-enrichment/workflow.json`.
- Secondary snapshot for diff/traceability: `workflows/wf04-metadata-enrichment/fixtures/workflow.export.snapshot.json`.
- Remote id is tenant-bound through root `.env` (`N8N_WORKFLOW_ID_WF04`, optional when export carries a root `id`).

## 2) Configuration

Runtime inputs:

- **`WF04_SPACE_ID`** — eXo **`space_id`** (digits) passed to **`search_documents`**. Canonical **List Documents** uses MCP **Manual** mapping: numeric **`space_id`** (integer **`1`** in git, no n8n **`$vars`**); **`npm run generate:workflow-json`** / REST deploy set **`parameters.parameters.value.space_id`** from repository root `.env` when set ([`config.env.example`](config.env.example); see **`WF04_CANONICAL_SPACE_ID_DEMO`** in [`tools/lib/n8n-workflow-deploy-core.mjs`](../../tools/lib/n8n-workflow-deploy-core.mjs)). For legacy JSON-mode **`jsonInput`** strings only, injection also matches the didactic fragment **`"limit": 500, "space_id":`** … — if you change **`limit`** / field order there, update the deploy helper regex accordingly.
- **`EXO_SPACE_NAME`** — display label for tracking rows and LLM context. The canonical graph does **not** use n8n **`$vars.EXO_SPACE_NAME`**; **Prepare AI Input** carries the demo expression **`={{ "Festival Art2Rue - Documents" }}`** on **`spaceName`**. When **`EXO_SPACE_NAME`** is set in repository root **`.env`**, **`npm run generate:workflow-json`** (persist) and REST deploy (in-memory) rewrite that inner string to the tenant value. It does **not** resolve the space at runtime; keep the injected string aligned with the tenant for operator clarity.

Connectivity and credentials:

- `EXO_MCP_ENDPOINT` in root `.env` — **`npm run generate:workflow-json`** writes MCP Client `endpointUrl`; canonical nodes may ship a demo literal until then.
- n8n MCP credential (`mcpOAuth2Api`) must allow read and write on target documents/categories.
- LLM credential for chat/structured-output node(s).

AI contract:

- Model in the current graph: `gpt-4o-mini`.
- Structured output target: `{ description, suggestedCategories[] }`.

## 3) MCP contract

### 3.1 Tools used (workflow runtime)

- `search_documents`
- `get_document_by_id`
- `get_category_tree`
- `update_document_description`
- `add_content_to_category`

**Bootstrap only (not in canonical graph):** operators may use **`get_my_spaces`** during tenant setup to discover **`WF04_SPACE_ID`** (see [fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)).

### 3.2 Response envelope

The workflow expects MCP responses that can be either wrapped text JSON or direct objects. Parsing/normalization nodes handle both patterns before write operations.

### 3.3 Expected write behavior

- Description is updated first (`update_document_description`).
- Category assignment follows (`add_content_to_category`) only for suggestions that resolve against the **`exo_category_cache`** Data Table (see §5.3). Each run refreshes that table from **`get_category_tree`** (see step 6: one small **Code** node walks nested **`sub_categories`** because n8n has no built-in recursive JSON flatten; then **`Sync Category Table`** upserts by **`category_id`**). For each suggested name, **`Lookup Category By Label`** runs a Data Table **get** with **`category_label`** equal to **`categoryName`** (exact string). **`Enrich Category Lookup`** re-attaches **`documentId`** from **`Split Suggested Categories`**. **`Filter Matched Categories`** keeps rows with a **`category_id`**; **`Assign Categories`** maps **`documentId`** to MCP **`content_id`** as **`/document:`** plus the bare id (e.g. **`/document:d0fad7ca…`**), with **`content_type`** literal **`document`** and numeric **`category_id`**. Unmatched labels are skipped (no error). When **no** suggestion matches, **`Aggregate Matched Categories`** + **`IF Zero Category Matches`** still advance to **`Update Tracking`**.
- Explicit stop/error nodes guard partial failure cases on MCP writes (description / assign), not on unmatched labels.

## 4) Technical sequence

1. Trigger (`Manual Start` or daily schedule).
2. **Parallel branches** from the trigger (no separate input Set / IF):
   - **Documents:** `List Documents` uses **`search_documents`** with **`space_id`** as a plain integer in MCP **Manual** `parameters.value` (demo **`1`** in git; **`.env`** **`WF04_SPACE_ID`** via generate/deploy rewrites that field—no **`$vars.WF04_SPACE_ID`**).
   - **Tracking:** `Ensure Tracking Table` (create if missing) → `Get Processed For Doc` → **Merge** (input 2).
   - **Category cache:** **`Ensure Category Table`** → **`Get Category Tree`** → **`Flatten Category Tree`** → **`Sync Category Table`** → **`Get Categories`** — see step 6; **`Ready to Process`** is a **Merge** in **`chooseBranch`** mode so only document items (input 1) are emitted once the cache branch has finished.
3. Document branch continues: **Split Out Documents** (one item per `search_documents` hit) → **Merge** (input 1). **Merge** SQL maps MCP field names to the shape the loop expects: **`document_id` → `id`**, **`updated_date` → `updatedDate`**, plus **`description`** (see **Merge Documents to Process** query).
4. Merge SQL keeps only new/changed docs vs tracking.
5. Limit batch size (current graph hard-caps to 5 per run).
6. **Category cache (parallel to listing, before the document loop):** **`Ensure Category Table`** → **`Get Category Tree`** (**`executeOnce`**) → **`Flatten Category Tree`** (single **Code** node: emits one item per category from nested **`sub_categories`**) → **`Sync Category Table`** → **`Get Categories`** (**`returnAll`**, **`executeOnce`**). **`Limit to 5 Documents`** (merge **input 1**) and **`Get Categories`** (merge **input 2**) meet at **`Ready to Process`** (**Merge**, **`chooseBranch`**, **`waitForAll`**, output **input 1** / documents only): the cache branch only **gates** execution; document **`id`** values are unchanged for **`Read Document`**. **`Prepare AI Input`** builds **`availableCategories`** with **`$('Get Categories').all().map(...)`** (no separate aggregate **Code** node). After the LLM, **`Split Suggested Categories`** → **`Lookup Category By Label`** (Data Table **get**, filter on **`category_label`**) → **`Enrich Category Lookup`** (Set) → **`Filter Matched Categories`** → **`Assign Categories`**; **`Enrich Category Lookup`** also feeds **`Aggregate Matched Categories`** (native **Aggregate** node) so **`IF Zero Category Matches`** can detect “suggestions present but no cache hits” and still call **`Update Tracking`**.
7. **Per document loop:** **`Read Document`** → **`Prepare AI Input`** ( **`availableCategories`** from **`Get Categories`** via expression; **`spaceName`** literal still **`={{ "…" }}`** from **`.env`** injection).
8. Run structured LLM analysis.
9. Write description and categories via MCP (`Assign Categories` uses **Manual** parameter mapping for readability).
10. Upsert tracking row and emit processing summary.

## 5) Data and mappings

### 5.1 Tracking table

`exo_processed_documents` stores idempotency metadata:

- `documentId`
- `lastProcessedDate`
- `description`
- `categories`
- `spaceName`
- `documentName`
- `documentUrl`
- `editorUrl`

### 5.2 LLM schema

```json
{
  "description": "Short text (<=30 words)",
  "suggestedCategories": ["Category1", "Category2"]
}
```

Category **labels** from structured output must **repeat tenant labels exactly** (see **Analyze Document** prompt). Resolution is **`Lookup Category By Label`** (Data Table **get**) → **`Enrich Category Lookup`** → **`Filter Matched Categories`** → **`Assign Categories`** (uses **`category_id`** from the table row; **`content_id`** = **`/document:`** + **`documentId`** when the id is not already prefixed; **`content_type`** = **`document`**).

### 5.3 Category cache (`exo_category_cache`)

Two-column Data Table, bootstrapped like tracking:

- **`category_id`** (number) — primary key for upsert and for **`add_content_to_category`**.
- **`category_label`** (string) — display name from **`get_category_tree`** (updated when upsert sees a renamed label).

**Evolution (out of scope for the two-column slice):** if strict label equality is too brittle in production, add a derived **`normalized_label`** column populated at sync time and join on that field instead of expanding JSON maps in memory.

### 5.4 `search_documents` list rows (didactic)

**Merge Documents to Process** expects each **Split Out** item to carry MCP list fields **`document_id`**, **`updated_date`**, and **`description`** (snake_case as in current tenant responses). The SQL selects `document_id AS id` and `updated_date AS updatedDate` so **`Process Each Document`** and **`Read Document`** keep using **`$json.id`** / **`updatedDate`**. There is **no** upstream Filter for missing ids—wrong or partial MCP rows surface as merge or downstream errors instead.

## 6) Validation and operations

Validation checklist:

1. Set **`WF04_SPACE_ID`** and **`EXO_SPACE_NAME`** in repository root **`.env`**, then run **`npm run generate:workflow-json`** and/or rely on REST deploy injection. The canonical graph does **not** read either value from n8n Variables—use **`.env`** + generate/deploy (or hand-edit **List Documents** **`parameters.value.space_id`** and the **`spaceName`** literal if you must).
2. Run manually and confirm selection of new/changed docs.
3. Verify generated structured output.
4. Verify description/category updates in eXo.
5. Confirm tracking rows in `exo_processed_documents`.
6. Optionally inspect **`exo_category_cache`** after a run (labels refreshed from **`get_category_tree`**).

Operational notes:

- Workflow is MCP-first (no REST fallback path documented).
- **Didactic slice:** no runtime **`get_my_spaces`** — wrong **`WF04_SPACE_ID`** misroutes **`search_documents`** without an in-graph name check against the tenant.
- Batch cap is a safety guard; increase only with quota/throughput review.

Suggested follow-ups:

1. Externalize batch limit as a variable.
2. Add retries/queue behavior for transient MCP failures.
3. Add quality instrumentation for LLM outputs.

## 7) Didactic simplification (ADR 0004)

This graph favors **explainability** over defensive discovery:

- **Removed:** MCP **`get_my_spaces`**, in-graph name→id resolution, **Workflow Input**, **IF Space Name**, the related stop node, n8n **`$vars.WF04_SPACE_ID`**, **Filter - Has document_id**, and **Normalize Documents**—tenant **`space_id`** / display strings are **literals** in git (rewritten from **`.env`** + generate/deploy), and list rows from **`search_documents`** are trusted with **`document_id` / `updated_date` / `description`** mapped only in **Merge** SQL.
- **Added:** **`WF04_SPACE_ID`** on **`search_documents`** as a plain integer in **List Documents** MCP **Manual** `parameters.value`, alongside **`EXO_SPACE_NAME`** on **Prepare AI Input**—no n8n **`$vars.EXO_SPACE_NAME`** or **`$vars.WF04_SPACE_ID`**.
- **Data Table:** `Ensure Tracking Table` runs on a **parallel branch** immediately before **`Get Processed For Doc`** (same pattern as WF02), not ahead of the whole MCP chain.
- **Category ids:** **`get_category_tree`** runs **once** per execution (**`executeOnce`**); categories are flattened with the single **`Flatten Category Tree`** **Code** node (nested MCP JSON), upserted into **`exo_category_cache`** via **`Sync Category Table`**, listed with **`Get Categories`**, and suggested names are resolved per row via **`Lookup Category By Label`** (Data Table **get**) before **`add_content_to_category`** (**Manual** MCP parameter rows for readability).

Deferred hardening (reintroduce only if needed on a tenant): runtime space discovery, stricter MCP envelope normalization, richer idempotency keys.
