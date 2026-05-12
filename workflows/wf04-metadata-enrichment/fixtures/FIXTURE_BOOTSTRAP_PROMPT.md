# WF04 — Fixture bootstrap prompt (metadata enrichment)

**Authoritative refs:** [SPEC.technical.md](../SPEC.technical.md), [config.env.example](../config.env.example).

## Goal

Ensure a target **space exists** on the tenant and emit **`WF04_SPACE_ID`** plus **`EXO_SPACE_NAME`** into the repository root **`.env`** so the canonical graph can call **`search_documents`** and label tracking rows **without** calling **`get_my_spaces`** at runtime ([SPEC.technical.md](../SPEC.technical.md) §7).

## Operator placeholders

| Placeholder | Example | Notes |
|-------------|---------|--------|
| `TARGET_SPACE_DISPLAY_NAME` | `Festival Art2Rue` | Human label to find in **`get_my_spaces`** results. The value you write as **`EXO_SPACE_NAME`** should be the **exact** string you want in n8n tracking and LLM context—usually the same field the API lists (`name`, `displayName`, or equivalent). If the tenant shows both **`Festival Art2Rue`** and a longer name such as **`Festival Art2Rue - Documents`**, do **not** guess: match the operator’s chosen target or ask. |

## Prerequisites outside MCP

- **Documents:** optionally seed sample docs in that space so **`search_documents`** returns candidates (empty space yields **no work**, not necessarily an error—see SPEC).
- **Categories:** **`get_category_tree`** supplies ids at runtime—no static category ids in the bootstrap env file.
- **Data Table `exo_processed_documents`:** created by the workflow—no MCP step.
- **LLM credential:** configured in n8n (OpenAI / compatible)—outside this prompt.

## Ordered bootstrap steps

0. **Read the MCP tool descriptor** for **`get_my_spaces`** on the connected eXo MCP server **before** invoking it (parameter names and response shape differ by build). Same discipline as WF01 for **`list_projects`**.

1. Confirm **`EXO_MCP_ENDPOINT`** matches the MCP URL used by **both** Cursor (this bootstrap session) and **n8n** MCP Client nodes on the same tenant.

2. Call **`get_my_spaces`** per the descriptor (often empty input). Parse the payload using the **live** response—common pattern is a list under `content[0].text` with entries carrying **`space_id`** and a display field such as **`name`** (see [SPEC.technical.md](../SPEC.technical.md) §3 and tenant reality; do not invent field names).

3. **Match** `TARGET_SPACE_DISPLAY_NAME` to exactly one space:
   - Prefer **strict equality** after `trim()` on each candidate field the API exposes for display (`name`, `displayName`, etc.).
   - If no strict match: **stop and ask** the operator unless they explicitly allow a **light** normalization pass (case fold, collapse internal whitespace). Never pick between **`Festival Art2Rue`** and **`Festival Art2Rue - Documents`** without confirmation if both exist.

4. **If no matching space exists**
   - If the MCP catalog documents a **space-creation** tool: read its descriptor, create the space with the agreed display name, then call **`get_my_spaces`** again and capture **`space_id`**.
   - Else **MANUAL**: create the space in the **eXo UI** with the agreed name, then repeat step 2 until the listing contains a match (see **Known gaps** and [EXO-MCP-WORKFLOW-TOOL-MAP.md](../../../docs/EXO-MCP-WORKFLOW-TOOL-MAP.md)).

5. **Merge** into repository root **`.env`** (meta-skill [Part C](../../../.cursor/skills/exo-fixture-bootstrap/SKILL.md); on conflicting existing values → ask **Overwrite** vs **Keep**):

```env
EXO_MCP_ENDPOINT=<verified URL>
EXO_SPACE_NAME=<exact display string chosen for tracking, typically the matched listing field>
WF04_SPACE_ID=<numeric space_id from get_my_spaces>
```

Optional scratch copy: `local/generated-wf04.env`.

6. **After merge:** remind the operator that **`npm run generate:workflow-json`** persists the same literals into **`workflow.json`** on disk. WF04 **`EXO_SPACE_NAME`** is injected into the **`spaceName`** expression literal and **`WF04_SPACE_ID`** into **`List Documents`** MCP **Manual** **`parameters.value.space_id`** (canonical graph does **not** use n8n **`$vars.EXO_SPACE_NAME`** or **`$vars.WF04_SPACE_ID`**).

## Fixture files (paths)

Optional trace artifacts only ([workflow.export.snapshot.json](workflow.export.snapshot.json))—not used for MCP bootstrap execution.

## Variables to emit

| Variable | Source |
|----------|--------|
| `EXO_MCP_ENDPOINT` | Verified tenant MCP URL |
| `EXO_SPACE_NAME` | Exact string for tracking / LLM (matched listing or operator override) |
| `WF04_SPACE_ID` | **`space_id`** from **`get_my_spaces`** for the chosen space |

## Known gaps

| Gap | Fallback |
|-----|----------|
| Space creation API absent on MCP | Create space in **eXo UI**, then re-run **`get_my_spaces`** |
