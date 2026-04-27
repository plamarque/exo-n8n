# Workflow 04 - Metadata enrichment

## Specifications

- [`SPEC.functional.md`](SPEC.functional.md) — goals and acceptance criteria.
- [`SPEC.technical.md`](SPEC.technical.md) — sequence, MCP, data, status.
- **Secondary export** (full snapshot): [`fixtures/workflow.export.snapshot.json`](fixtures/workflow.export.snapshot.json)

## Files

- [`workflow.json`](workflow.json) — **canonical** (re-import) artifact for n8n import and API.
- `fixtures/` — extracts and secondary snapshots (MCP export, debug) — not the canonical JSON.

## Instance reference

- Last aligned with n8n MCP `get_workflow_details` (workflowId: `aze2wAktXHYrTBTr`).

## Runtime behavior (summary)

- Manual trigger or daily schedule (e.g. 02:00).
- Requires `$vars.EXO_SPACE_NAME` (strict).
- eXo MCP for spaces, documents, categories.
- `gpt-4o-mini` with structured output for description and categories.
- Data table `exo_processed_documents` for idempotency.
