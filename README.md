# n8n + eXo MCP: low-code automation for collaboration teams

This repository is a **didactic portfolio**: four n8n workflows that show how **orchestration in n8n** and **eXo operations exposed through MCP** combine to automate real collaboration scenarios—without replacing the platform, but **accelerating** how people work inside it.

**What you get here**

- **Business-facing demos** (email intake, document validation, steering prep, metadata hygiene).
- **Canonical exports** (`workflow.json` per workflow) you can import or deploy.
- **Deep specs** under `docs/` and each workflow directory under `workflows/` for implementers.
- **Scripts and Skills** to build and develop your workflows along with an n8n server and an coding agent such as Cursor

If you only read one thing per workflow, start with its **chapter** in the table below, then open `SPEC.functional.md` in that workflow’s directory when you need acceptance criteria and product rules.

---

## Prerequisites

You need **two runtimes** before the demos are useful end to end:

- An **eXo** tenant (cloud or self-managed) where the **MCP server** is **enabled and exposed** for your integration, with the right **MCP base URL** and **OAuth2 (or equivalent) client** details. Enablement is a **platform / admin** task; follow your eXo (Meeds) admin guide for the version you run. A common URL shape ends in `/mcp-server/mcp`—always match the **actual** host and path in n8n.
- A reachable **n8n** instance to import or deploy the `workflow.json` files, run triggers, and **store credentials** (MCP + AI) in the n8n UI.

**n8n Cloud vs self-hosted:** this portfolio was **tested on n8n Cloud** (managed tenant). It **should** work on **self-hosted n8n** on a **compatible n8n version** with the same node types (MCP Client, LLM nodes, etc.); UI labels and menu locations for credentials may differ slightly from Cloud.

**Credentials in n8n (high level):**

1. **MCP (eXo)** — Create a credential that your **MCP Client** nodes can use (the technical specs in this repo often refer to the n8n credential type `mcpOAuth2Api`—treat the name as the one n8n shows for your build). Point it at your **eXo MCP endpoint** and complete the **OAuth2** fields (client id/secret, token URLs, scopes) as your eXo environment requires. Reuse the same credential on all eXo-facing nodes for a given tenant unless you intentionally split users.
2. **OpenAI (or compatible)** — Create an **OpenAI** (or provider-appropriate) credential and attach it to the **AI / LLM** nodes. The portfolio uses structured and chat-style model calls; without a working credential or hosted-model quota, those nodes will fail at execution time.
3. **n8n Cloud trial** — n8n Cloud often offers a **free trial** that may include a small **bundled AI credit** pool (wording and limits change with the product). That is a practical way to **walk through the demos** before wiring your own billable OpenAI key—check your tenant’s billing / credits panel.

Operational detail (deploy script, local validation, optional Cursor MCP) is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

---

## Why this portfolio

Teams on eXo already centralize **tasks, documents, spaces, and calendar**. The gap is often **glue**: repeating the same steps across email, folders, and meetings. n8n fills that gap with **visible, editable graphs**; the **eXo MCP server** exposes **consistent, tool-shaped actions** (list documents, create tasks, update status, etc.) that n8n can call like any other integration.

Together they enable:


| Capability                          | How it shows up here                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| **External signals**                | Turn inbound email into structured eXo work (WF01).                                   |
| **Richer than native DMS flows**    | Model **parallel approvals** and traceability beyond a simple folder workflow (WF02). |
| **Recurring collaboration rituals** | Prepare a **steering committee** pack (note + tasks + calendar) on a schedule (WF03). |
| **Background quality**              | **Incremental, idempotent** enrichment of document metadata (WF04).                   |


---

## How to read this repository

**Workflow tutorials (README chapters)** — open these on GitHub for the didactic walkthrough per workflow:


| Tutorial                                                                       | Canonical graph                                                   | Product spec                                                                | Technical spec                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [WF01 — Email dispatch](workflows/wf01-email-dispatch/README.md)               | [workflow.json](workflows/wf01-email-dispatch/workflow.json)      | [SPEC.functional.md](workflows/wf01-email-dispatch/SPEC.functional.md)      | [SPEC.technical.md](workflows/wf01-email-dispatch/SPEC.technical.md)      |
| [WF02 — Document validation](workflows/wf02-document-validation/README.md)     | [workflow.json](workflows/wf02-document-validation/workflow.json) | [SPEC.functional.md](workflows/wf02-document-validation/SPEC.functional.md) | [SPEC.technical.md](workflows/wf02-document-validation/SPEC.technical.md) |
| [WF03 — Weekly steering preparation](workflows/wf03-weekly-steering/README.md) | [workflow.json](workflows/wf03-weekly-steering/workflow.json)     | [SPEC.functional.md](workflows/wf03-weekly-steering/SPEC.functional.md)     | [SPEC.technical.md](workflows/wf03-weekly-steering/SPEC.technical.md)     |
| [WF04 — Metadata enrichment](workflows/wf04-metadata-enrichment/README.md)     | [workflow.json](workflows/wf04-metadata-enrichment/workflow.json) | [SPEC.functional.md](workflows/wf04-metadata-enrichment/SPEC.functional.md) | [SPEC.technical.md](workflows/wf04-metadata-enrichment/SPEC.technical.md) |


**Cross-cutting docs:** [docs/SPEC.md](docs/SPEC.md) (portfolio summary), [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (setup, deploy, validation), [AGENTS.md](AGENTS.md) (contribution rules for this repo).

**Shared sub-workflow:** several flows call **Unwrap MCP JSON** to normalize MCP responses—see [workflows/unwrap-mcp-json/README.md](workflows/unwrap-mcp-json/README.md).

---

## Sample Workflows

### WF01 — External signal: from email to eXo tasks

**Tutorial:** [workflows/wf01-email-dispatch/README.md](workflows/wf01-email-dispatch/README.md)

**Idea:** Not every message should create work. The workflow **listens** to the mail system via MCP, **classifies** each item with structured LLM output, and **creates and assigns** a task only when confidence and intent match your bar.

**Typical trigger:** schedule or manual run (email intake).

**Outcome:** Actionable mail becomes a **project task** with title, HTML description, priority, and assignee; noise is filtered out.

---

### WF02 — Richer document validation: two parallel approvals

**Tutorial:** [workflows/wf02-document-validation/README.md](workflows/wf02-document-validation/README.md)

**Idea:** Some programs need **two independent approvers** (e.g. artistic vs technical) with **equal weight** and a clear join point. That is often **more** than a single-step DMS rule. n8n models **split / join**, **webhook returns** for decisions, and **comments** for an audit trail in the task.

**Typical trigger:** new or updated documents in a **watched folder** (intake on a schedule or manual start).

**Outcome:** One task per document, **parallel** review paths, **Done** only when both sides approve.

---

### WF03 — Recurring collaboration: the weekly steering pack

**Tutorial:** [workflows/wf03-weekly-steering/README.md](workflows/wf03-weekly-steering/README.md)

**Idea:** Fixed rituals (steering committee) benefit from **one automated “meeting pack”**: template note, **task-derived** progress table, **LLM-suggested** watch items, and a **standing calendar** entry pointing to the right note for the week.

**Typical trigger:** schedule (prep before the meeting slot).

**Outcome:** Less copy-paste, one place in eXo for read-ahead, **notes + tasks + calendar** kept consistent.

---

### WF04 — Background maintenance: AI metadata enrichment

**Tutorial:** [workflows/wf04-metadata-enrichment/README.md](workflows/wf04-metadata-enrichment/README.md)

**Idea:** **Quality and findability** improve when descriptions and categories are kept current, but doing that by hand does not scale. The flow **resolves the space**, **increments** through documents, uses **structured LLM output**, writes back through MCP, and **records** what was processed to support idempotent reruns.

**Typical trigger:** daily schedule or manual start (with a per-run cap for safety).

**Outcome:** Documents get **short descriptions** and **suggested categories**, with **state** in an n8n Data Table so unchanged files are skipped.

---

## Design principles (what we optimized for)

These patterns appear across the portfolio; they are **intentional** for maintainability and demos.

1. **MCP-first** — Business operations go through eXo MCP tools; there is no parallel REST “escape hatch” in these exports.
2. **Unwrap once, reuse** — MCP responses are often **envelopes** (e.g. text parts with JSON). A **shared sub-workflow** normalizes that so the main graph works on **plain JSON** (see Unwrap MCP JSON).
3. **Prefer native n8n for control flow** — **Set**, **IF**, **Split Out**, **Merge**, **Execute Workflow**, and **Data Table** carry most of the logic; **Code** nodes are **small** and focused (e.g. HTML snippets, edge cases for merge inputs).
4. **Guardrails before side effects** — LLM output is **parsed and filtered** (WF01); **empty search** results end the run **without error** (WF02 intake); **strict variables** fail fast when misconfigured (WF04).
5. **Idempotency where it matters** — **Data Table** tracks processed **document** keys and **changed** timestamps (WF02, WF04) so reruns are safe and incremental.
6. **Sub-workflows for clarity** — WF03 **factorizes** report building and HTML composition into **UTIL** graphs so the parent workflow reads as a **sequence of decisions**, not a tangle of nodes.

---

## Deployment and validation

- **Environment:** copy `[.env.example](.env.example)` to `.env` and follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (deploy, credentials, MCP).
- **Deploy a workflow from the repo root:** `./tools/deploy.sh wf01` (and `wf02`, `wf03`, `wf04`); use `--dry-run` to inspect targets. Sub-workflow order is driven by each folder’s `subworkflow-dependencies.json` where present.
- **Validation policy:** before publishing, validate the canonical `workflow.json` as described in [docs/WORKFLOW.md](docs/WORKFLOW.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#rest-deploy-to-n8n).

---

## Sample Data

This project is part of a **demonstration** around the Art2Rue / festival scenario. Domain vocabulary and actor names in the specs are **illustrative**; adjust `project_id`, folder ids, and variables for your tenant as documented in each workflow’s technical spec.