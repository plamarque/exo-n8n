# WF01 — Email dispatch

**TL;DR** — List mail through eXo MCP, run **structured LLM triage** on each message, and **create a project task with assignee** only when the email is clearly actionable and confidence is high enough. The core idea: **not every email should become work**.

## n8n canvas

![WF01 — Email dispatch workflow in the n8n editor](wf01.png)

**Manual Start** → **MCP List Emails** → **Split Out Emails** → **IF Has Required Email Fields** → **AI Router** with **Routing Model** and **Routing Output Parser** → **IF Actionable** → **Render Task Description HTML** → **MCP Create Task** with `assignee`, `priority`, and HTML description in one call. Single-path tutorial graph on one canvas. For payloads and guardrails, see [`workflow.json`](workflow.json) and [SPEC.technical.md](SPEC.technical.md).

---

## Problem context

Project teams still receive **actionable** and **informational** email in the same inbox. Manual triage is slow; auto-creating a task for every message creates noise. Teams want **assigned work in eXo** only when intent is clear, with title, priority, and owner set in one step.

## Automation objective

- **List** messages with MCP **`list_emails`** and expand to one item per email.
- **Drop** rows missing required fields before any LLM call.
- **Analyze** each remaining email with a **structured** agent: actionable or not, confidence, assignee, priority, title, summary.
- **Create** a task via **`create_task_in_project`** only when `action_required` is true and `action_confidence` ≥ **0.7**, with **assignee** set in the same MCP call — no separate assign step.

## Prerequisites

WF01 needs a **task project**, **assignee usernames** that exist on the tenant, and **mailbox visibility** for the MCP OAuth identity. On a new tenant, create or locate the demo project and users, then align configuration with [config.env.example](config.env.example). Details: [SPEC.technical.md](SPEC.technical.md) §2.

**eXo**

| Prerequisite | Typical setup | Why |
|--------------|---------------|-----|
| **Task project** | Numeric **`project_id`** in **`MCP Create Task`** — demo literal **`3`** in [workflow.json](workflow.json) | `create_task_in_project` target board; change the literal for your tenant or re-export after editing in n8n. |
| **Assignee usernames** | `louis`, `claire`, `lucie` | Structured output enum and routing scopes — users must **exist** on the tenant; see [SPEC.technical.md](SPEC.technical.md) §5.2 and [SPEC.functional.md](SPEC.functional.md). |
| **Mailbox / mail feed** | Visible to the MCP credential used by n8n | `list_emails` returns nothing if the identity cannot see the demo mail. |

**n8n**

| Prerequisite | Why |
|--------------|-----|
| **MCP OAuth** + `EXO_MCP_ENDPOINT` | `list_emails` and `create_task_in_project`; rewrite endpoint with **`npm run generate:workflow-json`** or deploy. |
| **OpenAI** or equivalent | **AI Router**, **Routing Model**, and **Routing Output Parser**. |
| **Deploy id** | `N8N_WORKFLOW_ID_WF01` in root `.env` for REST deploy. |

**`WF01_PROJECT_ID` in root `.env`** is used for **fixture bootstrap** and portfolio tooling ([fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](fixtures/FIXTURE_BOOTSTRAP_PROMPT.md)); the canonical tutorial graph does **not** read it at runtime — edit **`project_id`** on **MCP Create Task** for another board.

Wrong **project_id** or unknown **assignee** usernames cause MCP errors or tasks on the wrong board.

## Runtime variables

| Variable | Meaning |
|----------|---------|
| `EXO_MCP_ENDPOINT` | MCP endpoint for WF01 MCP Client nodes; applied by **`npm run generate:workflow-json`** and/or deploy in-memory injection. |
| `WF01_PROJECT_ID` | Reference project id for bootstrap and docs; **not** wired into the canonical graph’s `project_id` literal. |
| `N8N_WORKFLOW_ID_WF01` | Remote workflow id for REST deploy; empty on first POST-create. |

## High-level flow

1. **Trigger** — **Manual Start** only.
2. **MCP List Emails** — `list_emails` with `{}`.
3. **Split Out Emails** — one item per entry from `content[0].text`.
4. **IF Has Required Email Fields** — requires `email_id`, `subject`, `content.body`, and `sender.address`.
5. **AI Router** — structured output: `action_required`, `action_confidence`, `assignee_username`, `priority`, `task_title`, `summary`.
6. **IF Actionable** — `action_required` true **and** `action_confidence` ≥ 0.7.
7. **Render Task Description HTML** — HTML body from sender, subject, and AI summary.
8. **MCP Create Task** — **Manual** MCP mapping: `project_id`, `title`, `description`, `assignee`, `priority`; end of path.

## n8n design choices

| Area | Choice | Why |
|------|--------|-----|
| Readability | **Single linear graph** | Tutorial slice (ADR 0004): each node answers one question on the canvas. |
| Pre-processing | **Split Out** + **IF** only | No Code for normalization; required fields enforced before the LLM. |
| Triage | **Structured LLM output** + confidence gate | Keeps side effects behind `IF Actionable`; priority enum matches MCP (`NONE` … `HIGH`). |
| Task body | **HTML** node | Fixed layout for description; no custom Code in this graph. |
| Task create | **One MCP call** with `assignee` | No `assign_task` follow-up; fewer nodes for onboarding. |
| MCP create mapping | **Manual** resource mapper + `removed` optional fields | Avoids empty optional parameters that break some MCP servers; see [SPEC.technical.md](SPEC.technical.md) §3.3. |
| MCP intake | **`content[0].text`** split directly | **Split Out Emails** reads the MCP Client item shape as returned by `list_emails`; see [SPEC.technical.md](SPEC.technical.md) §3.2. |
| Configuration | **Literal `project_id`** in `workflow.json` | Demo default `3`; change in the export or n8n UI for other tenants. |
| Idempotency | **None** in current graph | Re-runs can create duplicate tasks for the same email — see [SPEC.functional.md](SPEC.functional.md) §4. |

## MCP eXo interaction model

Tools used:

- **`list_emails`** — returns messages the MCP identity can read; split into per-email items.
- **`create_task_in_project`** — creates the task with `project_id`, `title`, `description`, `assignee`, and `priority`.

See [SPEC.technical.md](SPEC.technical.md) §3 for envelope shape, parameter table, and structured output schema.

## Operational considerations

- **Demo `project_id`** — confirm board **`3`** (or your value) in **MCP Create Task** before a tenant demo.
- **OAuth / OpenAI** — authorize MCP and LLM credentials on the target n8n instance.
- **Re-runs** — no persisted deduplication by `email_id`; avoid repeated manual runs on the same inbox without cleanup.
- **Narrow intake** — emails missing any required field are dropped silently on the false branch of **IF Has Required Email Fields**.

## Code vs native

The graph uses **Split Out**, **IF**, **HTML**, and an **AI Agent** with structured output only — **no Code** nodes.

## Import and deploy

**REST:** From the repo root, `./tools/deploy.sh wf01` — see [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md). On a fresh tenant, leave `N8N_WORKFLOW_ID_WF01` empty: the first deploy POST-creates the workflow and writes the id back — [Deploy bootstrap](../../docs/DEVELOPMENT.md#deploy-bootstrap-env-driven). Use `--dry-run` to preview the PUT target once the id is set.

**Manual UI:** Import `workflow.json`. Run **`npm run generate:workflow-json`** so `EXO_MCP_ENDPOINT` matches your tenant; verify MCP OAuth and OpenAI on the instance.

## References

| Artifact | Role |
|----------|------|
| [workflow.json](workflow.json) | Canonical export — name on instance: `WF01 - Email dispatch`. |
| [SPEC.functional.md](SPEC.functional.md) | Goals, actors, acceptance criteria, out of scope. |
| [SPEC.technical.md](SPEC.technical.md) | MCP contract, sequence, mappings, operations. |
| [config.env.example](config.env.example) | Example `.env` keys. |
| [fixtures/FIXTURE_BOOTSTRAP_PROMPT.md](fixtures/FIXTURE_BOOTSTRAP_PROMPT.md) | Tenant bootstrap prompt for demo data. |
