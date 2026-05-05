# WF04 — Fixture bootstrap prompt (metadata enrichment)

**Authoritative refs:** [SPEC.technical.md](../SPEC.technical.md), [config.env.example](../config.env.example).

## Goal

Ensure a target **space exists** whose **display name exactly matches** **`EXO_SPACE_NAME`** so **`get_my_spaces`** resolves **`spaceId`** on first run.

## Operator placeholders

| Placeholder | Example | Notes |
|-------------|---------|--------|
| `TARGET_SPACE_DISPLAY_NAME` | `Festival Art2Rue - Documents` | Must equal **`EXO_SPACE_NAME`** variable—case-sensitive match per graph validation |

## Prerequisites outside MCP

- **Documents:** optionally seed sample docs in that space so **`search_documents`** returns candidates (empty space yields **no work**, not necessarily error—see SPEC).
- **Categories:** **`get_category_tree`** supplies ids **at runtime**—no static category ids required for bootstrap env file.
- **Data Table `exo_processed_documents`:** created automatically by workflow—no MCP step.
- **LLM credential:** configured in n8n (OpenAI / compatible)—outside MCP bootstrap file.

## Ordered bootstrap steps

1. **`EXO_MCP_ENDPOINT`:** verify parity Cursor ↔ n8n MCP nodes.
2. **`get_my_spaces`** (SPEC §3): locate entry whose **`name`/`displayName`** field equals **`TARGET_SPACE_DISPLAY_NAME`** exactly as configured for **`EXO_SPACE_NAME`**.
   - If missing: **create space** via **eXo UI** (or MCP create-space tool **only if** documented on tenant); rerun listing until match exists.
3. Do **not** require separate **`EXO_SPACE_ID`** for canonical graph—confirm **`workflow.json`** resolves space via **`$vars.EXO_SPACE_NAME`** (or run **`npm run generate:workflow-json`** to hardcode); MCP **`endpointUrl`** is updated the same way from **`EXO_MCP_ENDPOINT`**.
4. **Merge** into repository root **`.env`** (meta-skill Part C; conflict → ask overwrite vs keep):

```env
EXO_MCP_ENDPOINT=<verified URL>
EXO_SPACE_NAME=<TARGET_SPACE_DISPLAY_NAME>
```

Optional scratch copy: `local/generated-wf04.env`.

## Fixture files (paths)

Optional trace artifacts only ([workflow.export.snapshot.json](workflow.export.snapshot.json))—not used for MCP bootstrap execution.

## Variables to emit

| Variable | Source |
|----------|--------|
| `EXO_MCP_ENDPOINT` | Tenant MCP URL |
| `EXO_SPACE_NAME` | Operator + **`get_my_spaces`** verification |

## Known gaps

| Gap | Fallback |
|-----|----------|
| Space creation API absent | UI |
