# Workflow 04 - Metadata enrichment (functional specification)

> n8n/MCP details: [`SPEC.technical.md`](SPEC.technical.md). Artifact: [`workflow.json`](workflow.json).

## 1) Goal

Automatically enrich eXo documents with AI (short description + suggested categories) and persist processing state to avoid reprocessing.

## 2) Business context

The workflow targets eXo document governance with scheduled, incremental runs:

- pick a space by name (`$vars.EXO_SPACE_NAME`)
- scan space documents
- run AI to enrich metadata
- write the description and assign categories
- track state in a n8n data table

## 3) Demo value

1. Hybrid n8n orchestration (schedule + manual).
2. End-to-end eXo MCP.
3. Structured LLM output (JSON schema).
4. Deduplication / incremental run via a data table.
5. Clear error handling on MCP responses.

## 4) Current product limits

1. Canonical `workflow.json` carries a **demo fallback literal** after `$vars.EXO_SPACE_NAME`; execution uses **n8n Variables when set**, otherwise that literal (REST deploy may rewrite the literal from repository root `.env`). Operators must align the resolved name with a real space on the tenant or runs target the wrong library by design.
2. MCP endpoint may be duplicated in several nodes (see technical spec).
3. Hard cap: 5 documents per run.
4. No rollback if description update succeeds but category assign fails (partially handled with explicit stops).

## 5) Acceptance criteria

- Fail fast when `spaceName` is empty.
- An unprocessed (or changed) document is enriched then tracked.
- A document already processed and unchanged is skipped.
- Category assignments reference resolved `category_id` values.
