# Functional Specification

## System Purpose

This repository documents and stores n8n workflows that automate eXo platform scenarios for the Art2Rue / festival demonstration context.

The observable portfolio covers four workflow families:

1. Email intake and dispatch to eXo tasks.
2. Document validation with two parallel approvals.
3. Weekly steering committee preparation.
4. AI-assisted eXo document metadata enrichment.

## Per-Workflow Artifacts and Specs (source map)


| Workflow | Directory                                                                                           | Key docs                                                                                                                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WF01     | [workflows/wf01-email-dispatch/](../workflows/wf01-email-dispatch/)                                   | [SPEC.functional.md](../workflows/wf01-email-dispatch/SPEC.functional.md), [SPEC.technical.md](../workflows/wf01-email-dispatch/SPEC.technical.md), [workflow.json](../workflows/wf01-email-dispatch/workflow.json)                                                                       |
| WF02     | [workflows/wf02-document-validation/](../workflows/wf02-document-validation/)                       | [SPEC.functional.md](../workflows/wf02-document-validation/SPEC.functional.md), [SPEC.technical.md](../workflows/wf02-document-validation/SPEC.technical.md), [workflow.json](../workflows/wf02-document-validation/workflow.json)                                                     |
| WF03     | [workflows/wf03-weekly-steering/](../workflows/wf03-weekly-steering/)                                     | [SPEC.functional.md](../workflows/wf03-weekly-steering/SPEC.functional.md), [SPEC.technical-exo-mips.md](../workflows/wf03-weekly-steering/SPEC.technical-exo-mips.md), [README.md](../workflows/wf03-weekly-steering/README.md), [workflow.json](../workflows/wf03-weekly-steering/workflow.json) |
| WF04     | [workflows/wf04-metadata-enrichment/](../workflows/wf04-metadata-enrichment/)                 | [SPEC.functional.md](../workflows/wf04-metadata-enrichment/SPEC.functional.md), [SPEC.technical.md](../workflows/wf04-metadata-enrichment/SPEC.technical.md), [workflow.json](../workflows/wf04-metadata-enrichment/workflow.json)                                            |
| Shared   | [workflows/shared/subworkflows/unwrap-mcp-json/](../workflows/shared/subworkflows/unwrap-mcp-json/) | MCP unwrap sub-workflow used by WF01                                                                                                                                                                                                                                                   |


## Main Capabilities

### WF01 - Email dispatch

The workflow reads incoming emails through eXo MCP, normalizes MCP responses, classifies emails with AI, and creates eXo tasks only for clearly actionable emails.

Observable rules:

- Emails without an `emailId` are filtered out.
- Task creation requires `actionRequired=true`, `responseExpected=true`, and `actionConfidence >= 0.7`.
- Tasks are created through `create_task_in_project`.
- Tasks are explicitly assigned through `assign_task`.
- The current final workflow has no REST fallback and no SLA sweep.
- Persistent email idempotence is not implemented yet.

### WF02 - Document Validation

The workflow targets documents deposited in the programming folder for the Festival Art de Rue scenario. It creates an eXo validation task per document and supports two equivalent approval roles:

- Direction Artistique: demo user `nadia`.
- Direction Technique: demo user `etienne`.

Observable rules:

- A document in the target folder can trigger task creation.
- A task remains in progress until both approvals are received.
- The task can move to `Done` only when both `APPROVED` decisions are received (artistic and technical roles in the canonical export).
- Rejections keep or return the item to an in-progress state and produce trace comments.
- The implemented export includes webhook-based approval handling.

### WF03 - Weekly steering preparation

The workflow prepares a weekly steering committee support package for the Festival Art2Rue project. **COPIL** is the French-style label still used in several n8n **node names**; see [DOMAIN.md](DOMAIN.md) for the mapping to the English steering committee term.

Observable intended behavior from specs and server export:

- Create or update a weekly note from the steering committee template ([fixtures/steering-template-note.md](../workflows/wf03-weekly-steering/fixtures/steering-template-note.md)).
- Insert a task-based progress report.
- Generate AI suggestions for agenda and vigilance points.
- Create or update a recurring agenda invitation that links to the note.
- Use the reference project, note, and agenda IDs observed in the MIPS exploration material.

Operational notes and file map: [workflows/wf03-weekly-steering/README.md](../workflows/wf03-weekly-steering/README.md). Optional follow-up for further native-only refactors is tracked in [ISSUES.md](ISSUES.md).

### WF04 - Metadata enrichment

The workflow enriches eXo documents with AI-generated metadata and tracks processed documents to avoid unnecessary reprocessing.

Observable rules:

- It requires `$vars.EXO_SPACE_NAME`.
- It resolves an eXo space, scans documents, reads document content, and lists available categories.
- It uses AI structured output for a short description and suggested categories.
- It updates document descriptions and category assignments through eXo MCP.
- It tracks processed documents in the n8n Data Table `exo_processed_documents`.
- It limits processing to five documents per run in the current implementation.

## Boundaries

In scope:

- n8n workflow definitions, canonical `workflow.json` per workflow, optional `fixtures/`, and operational documentation.
- eXo MCP-based automation for tasks, documents, notes, spaces, categories, and agenda-related scenarios.
- AI-assisted classification, enrichment, reporting, and agenda suggestion where specified.

Out of scope unless explicitly added:

- General-purpose eXo product development.
- A standalone application outside n8n.
- Secret management beyond example configuration placeholders.
- Production hardening that is only listed as future work in the workflow specs.

## Acceptance Rules Across Workflows

- MCP response normalization must handle serialized JSON envelopes where workflows depend on it.
- Workflow behavior must be traceable in either exported n8n JSON, SDK/source artifacts, or workflow-specific documentation.
- AI outputs must remain structured where downstream nodes depend on fixed fields.
- Known limitations must be tracked in `docs/ISSUES.md` rather than hidden in implementation details.

