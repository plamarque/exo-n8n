# UTIL - WF03 compose steering note HTML (sub-workflow)

Composes the weekly steering note HTML, `createNoteInput`, and `searchNotesInput` from the report context and the AI agent output. Used by [WF03 - Weekly steering preparation](../workflow.json).

## Input (from parent `Execute Workflow`)

Each item must include:

- `context` — JSON from **Execute WF03 Build Report Context** (full report context).
- `aiOutput` — raw output from **Analyze COPIL Signals** (agent + structured parser).

## Output

Same shape as the former in-workflow **Compose COPIL Note** Code node.

## Remote id (reference)

WF03’s **Execute WF03 Compose Steering Note** node references the live id in the portfolio [workflow.json](../workflow.json) (tenant-specific). On **meeds.app.n8n.cloud** the UTIL was created as `dDeDXkNJkWxxqxPb`; elsewhere use [tools/import-wf03-subworkflows.mjs](../../../../tools/import-wf03-subworkflows.mjs).

## Files

- [`workflow.json`](workflow.json) — canonical import.
