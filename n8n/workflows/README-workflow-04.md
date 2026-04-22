# Workflow 04 - eXo Document Enrichment with AI (Reverse Engineered)

## Files
- `n8n/workflows/workflow-04-document-enrichment-ai.export.json`
- `workflow-04-document-enrichment-ai.md`

## Source of truth
- Retrieved from n8n MCP using:
  - `search_workflows` (query: `eXo Document Enrichment with AI`)
  - `get_workflow_details` (workflowId: `aze2wAktXHYrTBTr`)

## Export format
- This export is a reverse-engineered JSON artifact based on MCP `get_workflow_details` output.
- It captures workflow identity, node inventory, connection graph, trigger info, and operational settings.

## Key runtime behavior
- Triggered manually or by daily schedule at 02:00.
- Requires `$vars.EXO_SPACE_NAME`.
- Uses MCP tools for spaces/documents/categories and metadata updates.
- Uses `gpt-4o-mini` with structured output for description + category suggestions.
- Tracks processed documents in Data Table `exo_processed_documents`.

## Important note
- The current implementation in n8n uses a hard requirement on `EXO_SPACE_NAME` and does not implement a fallback when missing.
