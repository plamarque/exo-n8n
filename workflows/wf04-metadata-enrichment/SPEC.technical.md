# Workflow 04 - Metadata enrichment (technical specification)

> Product context: [`SPEC.functional.md`](SPEC.functional.md). Server diff snapshot: [`fixtures/workflow.export.snapshot.json`](fixtures/workflow.export.snapshot.json).

## 1) eXo MCP (QAUI) feasibility

### Tools used in the current workflow

- `get_my_spaces`, `search_documents`, `get_document_by_id`, `get_category_tree`, `update_document_description`, `add_content_to_category`

### Conclusion

The implementation is **MCP-first**; there is no REST fallback in the current version.

## 2) Settings and prerequisites

### Variables / input

- `EXO_SPACE_NAME` via `$vars.EXO_SPACE_NAME` — **required**

### Connectivity

- MCP endpoint (e.g. `https://exo-qaui.meeds.io/mcp-server/mcp` — match your target env)
- n8n auth: `mcpOAuth2Api`

### AI

- Model: `gpt-4o-mini`
- Temperature: `0.3`
- Structured output: `{ description, suggestedCategories[] }`

## 3) Detailed sequence (as observed)

1. **Trigger** — `Manual Start` or `Daily Schedule` (02:00)
2. **Input** — `Workflow Input` sets `spaceName`; `Validate Input` fails if empty
3. **Tracking** — `Ensure Tracking Table` creates `exo_processed_documents` if needed
4. **Space** — `get_my_spaces` → map `spaceName` to `spaceId` (or stop on error)
5. **List docs** — `search_documents` (limit 500)
6. **Normalize** — `documentId`, `updatedDate`, `description` …
7. **Incremental** — read tracking for batch, filter new/changed, **limit 5** per run
8. **Per item** — `get_document_by_id`, `get_category_tree`, `Prepare AI Input`
9. **LLM** — `Analyze Document` with structured output
10. **Write** — `update_document_description`, then `add_content_to_category` with id resolution
11. **Stops** — error nodes on MCP/assign failures
12. **Record** — upsert tracking with metadata and URLs
13. **Out** — `Processing Summary` with `processedCount`

## 4) Data structures

### Tracking table

- `exo_processed_documents` for idempotency and incremental re-run
- columns include `documentId`, `lastProcessedDate`, `description`, `categories`, `spaceName`, `documentName`, `documentUrl`, `editorUrl`

### LLM target shape

```json
{
  "description": "Short text (<=30 words)",
  "suggestedCategories": ["Category1", "Category2"]
}
```

## 5) Technical highlights

- Strong incremental check (`updatedDate` vs `lastProcessedDate`).
- Explicit error stops after description update and after category add.
- MCP + Data table centric.

## 6) Demo runbook

1. Set `EXO_SPACE_NAME`.
2. `Manual Start`.
3. Observe which docs are new vs already processed.
4. Check structured output.
5. Verify in eXo: description and categories.
6. Confirm tracking row in `exo_processed_documents`.

## 7) Exported artifacts

- Canonical: `workflows/wf04-metadata-enrichment/workflow.json`
- Full server snapshot: `fixtures/workflow.export.snapshot.json`

## 8) Suggested follow-ups

1. Single MCP endpoint variable in n8n.
2. Configurable default when `EXO_SPACE_NAME` is empty (if desired).
3. Retry/queue for transient MCP errors.
4. Quality instrumentation (LLM confidence, prompt/output audit log).

## 9) Status

Reverse engineered from n8n workflow id `aze2wAktXHYrTBTr` (historically titled `eXo Document Enrichment with AI`; repository canonical name `WF04 - Metadata enrichment`) via MCP on 2026-04-22.
