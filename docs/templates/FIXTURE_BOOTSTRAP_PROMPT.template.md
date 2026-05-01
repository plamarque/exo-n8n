# Fixture bootstrap prompt template

Copy this structure into `workflows/<portfolio-id>/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md` for each workflow that supports agent-led eXo bootstrap.

**Convention**

| Item | Value |
|------|--------|
| File path | `workflows/wf0X-<slug>/fixtures/FIXTURE_BOOTSTRAP_PROMPT.md` |
| Filename | Exactly **`FIXTURE_BOOTSTRAP_PROMPT.md`** (repo-wide) |
| Language | English (committed artifacts policy) |

**Authoritative references** (always link these from each prompt):

- `SPEC.technical.md` — MCP tools and payloads
- `config.env.example` — n8n `$vars` / env keys

---

## Goal

<!-- One paragraph: what demo data this workflow needs on eXo / n8n. -->

## Operator placeholders

<!-- Names the human edits before or during a run (space label, project name, folder path, etc.). -->

| Placeholder | Example | Notes |
|-------------|---------|--------|
| ... | ... | ... |

## Prerequisites outside MCP

<!-- Users, calendar-only setup, n8n URLs, secrets — explicit. -->

## Ordered bootstrap steps

<!--
Numbered imperative steps. Each step should say:
1. Search (which MCP tool, match field).
2. Create if missing (which tool or MANUAL).
3. Capture id → variable name from config.env.example.
Use search-then-create for idempotency.
-->

1. ...
2. ...

## Fixture files (paths)

<!-- Relative paths from repo root for uploads or human comparison (e.g. sample .docx). -->

| Path | Purpose |
|------|---------|
| ... | ... |

## Variables to emit

<!--
Mirror keys from config.env.example / workflow $vars. Agent merges into repository root .env (see
exo-fixture-bootstrap skill); optional local/generated-<shortId>.env scratch file.
-->

| Variable | Source step |
|----------|-------------|
| ... | ... |

## Known gaps

<!--
MCP vs manual vs n8n-only; align with docs/EXO-MCP-WORKFLOW-TOOL-MAP.md audit row.
-->

| Gap | Fallback |
|-----|----------|
| ... | ... |
