# Workflow 03 - Weekly steering preparation

**Terminology:** **COPIL** is French project shorthand for a **steering committee** (*comité de pilotage*). In English, *steering committee* (or *steering group*) is the clearest wording; *SteerCo* is informal jargon in some companies, not a universal acronym. This workflow’s export still uses `COPIL` in several **node names** to match the demo environment; the portfolio workflow title uses English *steering*.

## Files

| File | Role |
|------|------|
| [`workflow.json`](workflow.json) | Canonical n8n export (see [ADR 0002](../../docs/ADR/0002-repository-layout-workflows.md)). |
| [`fixtures/api-response.snapshot.json`](fixtures/api-response.snapshot.json) | Raw API response (workflow + `triggerInfo`) kept for traceability. |
| [`SPEC.functional.md`](SPEC.functional.md) | Goals, rules, and acceptance criteria. |
| [`SPEC.technical-exo-mips.md`](SPEC.technical-exo-mips.md) | eXo MIPS MCP contract (notes, projects, agenda, etc.). |
| [`SPEC.technical-mcp.md`](SPEC.technical-mcp.md) | eXo QAUI MCP exploration (phase 1). |
| [`fixtures/steering-template-note.md`](fixtures/steering-template-note.md) | Note template (editorial reference). |
| [`config.env.example`](config.env.example) | Example n8n variables. |

## Identifiers (from spec)

- n8n workflow: `1suyxKutB174p7b4` (name on the instance: `WF03 - Weekly steering preparation`).

## Code vs native audit

Reducing custom **Code** nodes is still **in progress** (unlike WF01 and WF04). See [`docs/ISSUES.md`](../../docs/ISSUES.md) and [audit `docs/audit-code-vs-native.md`](../../docs/audit-code-vs-native.md).

## Import

1. Import `workflow.json` in n8n (or `validate_workflow` / `update_workflow` via the n8n MCP).
2. Set `EXO_MCP_ENDPOINT` and the `WF03_*` variables from the graph / technical specs.
3. Check MCP OAuth and OpenAI on the target instance.
