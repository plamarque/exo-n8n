# Fixture bootstrap prompts (convention)

Portfolio workflows may ship **natural-language bootstrap instructions** for agents with **eXo MCP** access:

- **Path:** `workflows/wf0X-*/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md`
- **Template:** [templates/FIXTURE_BOOTSTRAP_PROMPT.template.md](templates/FIXTURE_BOOTSTRAP_PROMPT.template.md)
- **Orchestration:** Cursor skill [`.cursor/skills/exo-fixture-bootstrap/SKILL.md`](../.cursor/skills/exo-fixture-bootstrap/SKILL.md)
- **MCP ↔ graph tool inventory and audits:** [EXO-MCP-WORKFLOW-TOOL-MAP.md](EXO-MCP-WORKFLOW-TOOL-MAP.md)

Authoritative variable names remain in each workflow’s `config.env.example` and `SPEC.technical.md`; prompts must stay aligned with those files.

**WF04:** The canonical graph does not call **`get_my_spaces`** at runtime; the **`wf04-metadata-enrichment`** fixture prompt still uses **`get_my_spaces`** once during bootstrap to populate **`WF04_SPACE_ID`** (and **`EXO_SPACE_NAME`**) in root **`.env`**—see that workflow’s `fixtures/FIXTURE_BOOTSTRAP_PROMPT.md`. **`npm run generate:workflow-json`** / deploy then bakes **`EXO_SPACE_NAME`** into the **`Prepare AI Input`** literal and **`WF04_SPACE_ID`** into the **`space_id`** digit in **List Documents** MCP **Manual** parameters (not n8n **`$vars.EXO_SPACE_NAME`** or **`$vars.WF04_SPACE_ID`**).

**Merge target:** the meta-skill writes discovered values into the **repository root `.env`** (see skill Part C): append missing keys under `# --- exo-fixture-bootstrap (<shortId>) ---`, and **ask the user** (overwrite vs keep) when a key already exists with a different value. Optional `local/generated-<shortId>.env` is a scratch copy only.
