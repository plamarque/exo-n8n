# Workflow 04 - Metadata enrichment (functional specification)

> n8n/MCP details: [`SPEC.technical.md`](SPEC.technical.md). Artifact: [`workflow.json`](workflow.json).

## 1) Goal

Automatically enrich eXo documents with AI (short description + suggested categories) and persist processing state to avoid reprocessing.

## 2) Business context

The workflow targets eXo document governance with scheduled, incremental runs:

- target a space by configured **`WF04_SPACE_ID`** (document scan) and **`EXO_SPACE_NAME`** (display / LLM context)
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

1. Canonical `workflow.json` carries **demo literals** for **`spaceName`** (no **`$vars.EXO_SPACE_NAME`**) and for **`search_documents` `space_id`** in **List Documents** MCP **Manual** `parameters.value` (no n8n **`$vars.WF04_SPACE_ID`**—plain integer **`1`** in git). Repository root **`.env`** drives **`EXO_SPACE_NAME`** and **`WF04_SPACE_ID`** into the graph via **`npm run generate:workflow-json`** and/or REST deploy injection. Operators must align **`WF04_SPACE_ID`** with the real eXo space or runs query the wrong library by design.
2. MCP **`endpointUrl`** is repeated on each MCP Client node as a **plain URL** (demo literal in git until **`npm run generate:workflow-json`** applies **`EXO_MCP_ENDPOINT`**).
3. Hard cap: 5 documents per run.
4. No rollback if description update succeeds but category assign fails (partially handled with explicit stops).

## 5) Acceptance criteria

- Operators supply valid **`WF04_SPACE_ID`** / **`EXO_SPACE_NAME`** via root **`.env`** + generate/deploy (there is **no** tutorial IF that blocks empty display strings or invalid ids in-graph).
- An unprocessed (or changed) document is enriched then tracked.
- A document already processed and unchanged is skipped.
- Category assignments reference resolved `category_id` values where **`Lookup Category By Label`** / **`Enrich Category Lookup`** / **`Filter Matched Categories`** find an exact **`category_label`** match in **`exo_category_cache`**; otherwise no category assignment is attempted for that label (description updates still apply).
