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
- `docs/DEVELOPMENT.md`: local setup, tooling, validation, and operational notes.

Per-workflow documentation lives under `workflows/wf0X-*/` (`SPEC.*.md`, `README.md`). It should not contradict the normative governance docs.

## Repository language

All **committed** artifacts follow **English-only** authoring rules, including workflow exports, specs, tooling comments, and commit messages. A **narrow exception** applies only to minimal literals that must match legacy external data; see [AGENTS.md](../AGENTS.md) (section *Language (committed artifacts)*).

## Change Rules

1. Functional behavior changes require an update to `docs/SPEC.md`.
2. Domain rule, actor, or vocabulary changes require an update to `docs/DOMAIN.md`.
3. Architectural changes require an update to `docs/ARCH.md`; durable decisions require an ADR.
4. Runtime, import, validation, or script changes require an update to `docs/DEVELOPMENT.md`.
5. Delivery status changes belong in `docs/PLAN.md`.
6. Defects, open risks, and inconsistencies belong in `docs/ISSUES.md`.

## Evidence Rules

- Descriptive documentation must be grounded in observed files, exports, scripts, or existing project notes.
- `[ASSUMPTION]` marks a reasonable inference from available material.
- `[UNCERTAIN]` marks a point that needs confirmation before it is treated as authoritative.
- If a critical fact cannot be inferred, stop and ask before changing code or runtime behavior.

## Current Source Map

- Portfolio overview and links: [SPEC.md](SPEC.md).
- WF01: [workflows/wf01-email-to-task/](../workflows/wf01-email-to-task/).
- WF02: [workflows/wf02-document-validation/](../workflows/wf02-document-validation/).
- WF03: [workflows/wf03-weekly-copil/](../workflows/wf03-weekly-copil/) (includes `SPEC.technical-exo-mips.md`, `SPEC.technical-mcp.md`, `fixtures/copil-template-note.md`).
- WF04: [workflows/wf04-document-enrichment-ai/](../workflows/wf04-document-enrichment-ai/).
- Shared: [workflows/shared/subworkflows/unwrap-mcp-json/](../workflows/shared/subworkflows/unwrap-mcp-json/).
- Audit: [audit-code-vs-native.md](audit-code-vs-native.md); generated Code-node inventory: [inventory-code-nodes.json](inventory-code-nodes.json).
- Tooling: [tools/](../tools/) (see [DEVELOPMENT.md](DEVELOPMENT.md)).
- Layout and canonical JSON: [ADR/0002-repository-layout-workflows.md](ADR/0002-repository-layout-workflows.md).