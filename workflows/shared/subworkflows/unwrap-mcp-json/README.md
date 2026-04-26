# UTIL - Unwrap MCP JSON (sub-workflow)

Decodes eXo MCP responses (often wrapped) into JSON usable by downstream n8n nodes.

## Files

- [`workflow.json`](workflow.json) — canonical import into n8n.
- [`fixtures/workflow.import.snapshot.json`](fixtures/workflow.import.snapshot.json) — UI import variant.
- [`fixtures/subworkflow-unwrap-mcp-json.sdk.js`](fixtures/subworkflow-unwrap-mcp-json.sdk.js) — SDK reference (not the sole execution source).

## Consumers

Used in particular by [WF01 - Email to task](../../wf01-email-to-task/README.md) (`Execute Workflow`).

## Remote id (reference)

- `E4OAThogWRG93MUG` (n8n name: `UTIL - Unwrap MCP JSON` — verify on the live instance).
