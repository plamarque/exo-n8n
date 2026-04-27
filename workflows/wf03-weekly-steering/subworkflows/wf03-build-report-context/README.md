# UTIL - WF03 build report context (sub-workflow)

Builds the steering report context (task table HTML, `ai_prompt_payload`, template fields) from bundled inputs. Used by [WF03 - Weekly steering preparation](../workflow.json).

## Input (from parent `Execute Workflow`)

Each item must include:

- `config` — object from **Prepare COPIL Config** (space/project IDs, meeting dates, thresholds, etc.).
- `template_payload` — parsed note template (from **UTIL - Unwrap MCP JSON** after `get_note`).
- `tasks_payload` — parsed task list (from **UTIL - Unwrap MCP JSON** after `list_tasks`).

## Output

Same shape as the former in-workflow **Build Report Context** Code node (flat JSON with `report_html`, `ai_prompt_payload`, `template_html`, etc.).

## Remote id (reference)

WF03’s **Execute WF03 Build Report Context** node references the live workflow id in [workflow.json](../workflow.json) (tenant-specific). On **meeds.app.n8n.cloud** the UTIL was created as `KBsZj9ClCJX2wNFH`; on another instance run `node tools/import-wf03-subworkflows.mjs` from the repo root (see [tools/import-wf03-subworkflows.mjs](../../../../tools/import-wf03-subworkflows.mjs)).

## Files

- [`workflow.json`](workflow.json) — canonical import.
