# Workflow 04 - Metadata enrichment (technical specification)

> Product rules: [SPEC.functional.md](SPEC.functional.md). Canonical graph: [workflow.json](workflow.json). Secondary snapshot: [fixtures/workflow.export.snapshot.json](fixtures/workflow.export.snapshot.json).

## 1) Scope and artifacts

- Canonical export in git: `workflows/wf04-metadata-enrichment/workflow.json`.
- Secondary snapshot for diff/traceability: `workflows/wf04-metadata-enrichment/fixtures/workflow.export.snapshot.json`.
- Remote id is tenant-bound through root `.env` (`N8N_WORKFLOW_ID_WF04`, optional when export carries a root `id`).

## 2) Configuration

Runtime inputs:

- `EXO_SPACE_NAME` via n8n **`$vars.EXO_SPACE_NAME`** when set; otherwise the canonical graph uses a **demo fallback literal** (REST deploy may replace that literal from repository root `.env`). Operators must align the resolved name with a real space on the tenant.

Connectivity and credentials:

- `EXO_MCP_ENDPOINT` configured on MCP nodes (or through node defaults in your n8n instance).
- n8n MCP credential (`mcpOAuth2Api`) must allow read and write on target documents/categories.
- LLM credential for chat/structured-output node(s).

AI contract:

- Model in the current graph: `gpt-4o-mini`.
- Structured output target: `{ description, suggestedCategories[] }`.

## 3) MCP contract

### 3.1 Tools used

- `get_my_spaces`
- `search_documents`
- `get_document_by_id`
- `get_category_tree`
- `update_document_description`
- `add_content_to_category`

### 3.2 Response envelope

The workflow expects MCP responses that can be either wrapped text JSON or direct objects. Parsing/normalization nodes handle both patterns before write operations.

### 3.3 Expected write behavior

- Description is updated first (`update_document_description`).
- Category assignment follows (`add_content_to_category`) using category ids resolved from `get_category_tree`.
- Explicit stop/error nodes guard partial failure cases.

## 4) Technical sequence

1. Trigger (`Manual Start` or daily schedule).
2. Validate input (resolved space name must not be empty after trim — `$vars` overrides demo fallback literal).
3. Ensure tracking table `exo_processed_documents` exists.
4. Resolve target space (`get_my_spaces` -> `spaceId`).
5. List candidates (`search_documents`) and normalize fields.
6. Compare with tracking data and keep only new/changed docs.
7. Limit batch size (current graph hard-caps to 5 per run).
8. Per document: load details + category tree + prepare LLM input.
9. Run structured LLM analysis.
10. Write description and categories via MCP.
11. Upsert tracking row and emit processing summary.

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

Category labels are matched against the category tree to resolve `category_id` values.

## 6) Validation and operations

Validation checklist:

1. Set **`$vars.EXO_SPACE_NAME`** to an existing target space on the instance (or rely on the canonical fallback literal after aligning `.env` / demo export with your tenant).
2. Run manually and confirm selection of new/changed docs.
3. Verify generated structured output.
4. Verify description/category updates in eXo.
5. Confirm tracking rows in `exo_processed_documents`.

Operational notes:

- Workflow is MCP-first (no REST fallback path documented).
- Trim-empty resolved space name is a deliberate hard stop before MCP reads (`$vars` unset falls through to the demo fallback literal unless rewritten at deploy).
- Batch cap is a safety guard; increase only with quota/throughput review.

Suggested follow-ups:

1. Externalize batch limit as a variable.
2. Add retries/queue behavior for transient MCP failures.
3. Add quality instrumentation for LLM outputs.
