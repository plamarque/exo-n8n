# WF01 — Email dispatch (tutorial version)

**TL;DR** — This tutorial workflow shows a simple end-to-end path: call eXo MCP to read emails, apply a small AI decision, then create and assign a task in eXo.

## Goal

This version is intentionally simplified for demos and onboarding:

- fewer nodes,
- less defensive parsing,
- easier node-by-node explanation for non-experts.

It keeps the core business idea: **not every email should become a task**.

## Workflow overview

1. `Manual Start`
2. `MCP List Emails`
3. `Split Out Emails`
4. `IF Has Required Email Fields`
5. `AI Router` (+ model + output parser)
6. `Normalize AI Output`
7. `IF Actionable`
8. `Build Create Task Input`
9. `MCP Create Task`
10. `IF Has Task ID`
11. `MCP Assign Task` or `Stop - Missing task_id`

## What was simplified

- Kept only no-code n8n primitives for pre-processing: `Split Out Emails` + `IF Has Required Email Fields`.
- Removed extra HTML preparation nodes and built a compact description directly in `Build Create Task Input`.
- Reduced AI output contract to the minimum needed for the demo flow.
- Removed the scheduled trigger from the tutorial path (manual trigger only).

## Configuration essentials

- MCP endpoint and credentials must be valid for the target tenant.
- `WF01_PROJECT_ID` is optional; if missing, workflow uses fallback project id `3`.
- OpenAI credential is required for routing nodes.

See:

- [SPEC.technical.md](SPEC.technical.md)
- [config.env.example](config.env.example)
- [../../docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md)

## Tutorial caveats

This version favors readability over robustness:

- Input shape handling is intentionally narrow.
- There is no persisted idempotency yet (re-runs can create duplicates).
- For production hardening, restore richer parsing and guards.

## References

- [workflow.json](workflow.json)
- [SPEC.functional.md](SPEC.functional.md)
- [SPEC.technical.md](SPEC.technical.md)
- [subworkflow-dependencies.json](subworkflow-dependencies.json)
- [../unwrap-mcp-json/](../unwrap-mcp-json/)
