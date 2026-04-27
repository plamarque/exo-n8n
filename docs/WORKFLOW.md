# Documentation Workflow

## Purpose

This document defines how project documentation is maintained. It is normative for repository work.

## Document Roles

- `AGENTS.md`: repository-level instructions for AI agents and contributors.
- `docs/SPEC.md`: functional contract for the n8n/eXo workflow portfolio.
- `docs/DOMAIN.md`: domain vocabulary, actors, entities, and observable business rules.
- `docs/ARCH.md`: architecture, boundaries, dependencies, and execution model.
- `docs/ADR/`: durable architecture decisions.
- `docs/PLAN.md`: delivery tracking only.
- `docs/ISSUES.md`: known bugs, limitations, inconsistencies, and deferred work.
- `docs/DEVELOPMENT.md`: local setup, tooling, validation, and operational notes (including **Cursor and MCP (recommended)** for optional IDE MCP config).
- `.cursor/skills/n8n-workflow-deploy-gate/SKILL.md`: project **Cursor skill** (agent runbook: local validate, optional `--emit-sdk`, REST JSON deploy via [push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs), or n8n MCP `validate_workflow` / `update_workflow`); normative policy remains in this file’s *Deployment validation policy*.
- [`.cursor/mcp.json.example`](../.cursor/mcp.json.example): committed **placeholder-only** template for the two MCP servers (n8n + eXo); the real [`.cursor/mcp.json`](../.cursor/mcp.json) (secrets) is git-ignored and not in the repository.

Per-workflow documentation lives under `workflows/wf0X-*/` (`SPEC.*.md`, `README.md`). It should not contradict the normative governance docs.

## Repository language

All **committed** artifacts follow **English-only** authoring rules, including workflow exports, specs, tooling comments, and commit messages. A **narrow exception** applies only to minimal literals that must match legacy external data; see [AGENTS.md](../AGENTS.md) (section *Language (committed artifacts)*).

## Deployment validation policy

Normative for contributors and AI agents whenever portfolio workflows are changed and **published** to an n8n instance (UI import, REST API, or n8n MCP `update_workflow` / `create_workflow_from_code`).

1. **Mandatory — local:** Before any publish, run **`validateWorkflow`** from `@n8n/workflow-sdk` on the canonical **`workflow.json`** using repository tooling (see [DEVELOPMENT.md](DEVELOPMENT.md) — `npm run validate:workflows`, scoped validation, or `./tools/validate-workflow.sh`). **Do not** publish a workflow that fails local validation unless the exception is explicitly recorded in `docs/ISSUES.md` with rationale.

2. **Recommended — MCP `validate_workflow`:** When publishing **through MCP** using **SDK `code`** (for example output from `--emit-sdk`), also run MCP **`validate_workflow`** on the **exact same `code`** you pass to `update_workflow` / `create_workflow_from_code`. This is a second line of defense when SDK or node-type versions may differ between the workspace and the MCP host, or when the `code` was not produced by the standard local path.

3. **JSON-only publish:** Importing **`workflow.json`** via the n8n UI or REST API does **not** go through MCP `validate_workflow`; gate (1) remains mandatory. MCP codegen is optional for that path. For automated JSON-only publish from this repository, use [tools/push-workflow-to-n8n-api.mjs](../tools/push-workflow-to-n8n-api.mjs) (`npm run deploy:workflow`), which runs local validation before `PUT` unless explicitly skipped.

4. **Runtime:** Passing local or MCP structural validation does **not** replace execution checks on the target instance (credentials, quotas, eXo responses).

## Change Rules

1. Functional behavior changes require an update to `docs/SPEC.md`.
2. Domain rule, actor, or vocabulary changes require an update to `docs/DOMAIN.md`.
3. Architectural changes require an update to `docs/ARCH.md`; durable decisions require an ADR.
4. Runtime, import, validation, or script changes require an update to `docs/DEVELOPMENT.md`.
5. Delivery status changes belong in `docs/PLAN.md`.
6. Defects, open risks, and inconsistencies belong in `docs/ISSUES.md`.
7. Changes to **deployment validation policy** (this document’s *Deployment validation policy* section) require an update here; changes to **commands or scripts** that implement validation require a matching update to `docs/DEVELOPMENT.md`. Changes to the **agent runbook** (the project skill under `.cursor/skills/n8n-workflow-deploy-gate/`) or to the **MCP example** (`.cursor/mcp.json.example`) and related Cursor setup in `docs/DEVELOPMENT.md` should stay aligned with the policy in this file.

## Evidence Rules

- Descriptive documentation must be grounded in observed files, exports, scripts, or existing project notes.
- `[ASSUMPTION]` marks a reasonable inference from available material.
- `[UNCERTAIN]` marks a point that needs confirmation before it is treated as authoritative.
- If a critical fact cannot be inferred, stop and ask before changing code or runtime behavior.

## Current Source Map

- Portfolio overview and links: [SPEC.md](SPEC.md).
- WF01: [workflows/wf01-email-dispatch/](../workflows/wf01-email-dispatch/).
- WF02: [workflows/wf02-document-validation/](../workflows/wf02-document-validation/).
- WF03: [workflows/wf03-weekly-steering/](../workflows/wf03-weekly-steering/) (includes `SPEC.technical-exo-mips.md`, `SPEC.technical-mcp.md`, `fixtures/steering-template-note.md`).
- WF04: [workflows/wf04-metadata-enrichment/](../workflows/wf04-metadata-enrichment/).
- Shared: [workflows/shared/subworkflows/unwrap-mcp-json/](../workflows/shared/subworkflows/unwrap-mcp-json/).
- Audit: [audit-code-vs-native.md](audit-code-vs-native.md); generated Code-node inventory: [inventory-code-nodes.json](inventory-code-nodes.json).
- Tooling: [tools/](../tools/) (see [DEVELOPMENT.md](DEVELOPMENT.md)).
- Layout and canonical JSON: [ADR/0002-repository-layout-workflows.md](ADR/0002-repository-layout-workflows.md).