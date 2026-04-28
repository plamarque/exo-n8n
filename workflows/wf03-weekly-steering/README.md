# WF03 — Weekly steering preparation (recurring collaboration ritual)

**TL;DR** — Automate the **weekly steering committee prep pack**: load a **note template**, embed a **task-based progress table**, add **LLM-suggested** agenda and watch items, and keep a **recurring calendar** entry pointing at the right **note for the week**. COPIL-style meeting habit, without the copy-paste.

**Terminology:** **COPIL** is French project shorthand for a **steering committee** (*comité de pilotage*). In English, *steering committee* (or *steering group*) is the clearest wording. This workflow’s export still uses `COPIL` in several **node names** to match the demo environment; the portfolio workflow title uses English *steering*.

---

## Problem context

Governance meetings repeat on a **fixed cadence**, but preparation is often **manual**: re-open tasks, rewrite the same sections, fix links, and align the calendar invite. Teams want **one handout in eXo** (note + tasks + calendar) with **fresh content** each week and **minimal busywork**.

## Automation objective

- Determine **which occurrence** to prepare and the **meeting date** for titles.
- **Read** the template note and **create or update** the child note for that week.
- **List project tasks** and render a **tabular HTML** snapshot for the note body.
- Run an **LLM** on a compact task payload to propose **agenda nudges** and **risk / watch** items (non-binding, grounded in data).
- **Create or update** the standing **agenda / calendar** object so participants open the **same invite** with the **correct note link**.

## High-level flow (conceptual)

1. **Trigger** — scheduled prep before the meeting slot (implementation detail in `workflow.json`).
2. **Resolve time / week** — set the date used in the note title and routing.
3. **Template & note** — fetch template content; **upsert** weekly child note under the configured parent.
4. **Task report** — pull tasks for the target project; build **HTML** table (delegated to a UTIL sub-workflow).
5. **LLM assist** — short structured suggestions for agenda + watch list from task facts.
6. **Compose body** — merge template sections, table, and AI blocks (UTIL sub-workflow).
7. **Publish** — update note in eXo; **link** the recurring calendar / agenda entry to the weekly note.

## n8n design choices (not a node-by-node list)


| Area               | Choice                                                                                  | Why                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Readability        | **UTIL sub-workflows** for **build report context** and **compose HTML**                | Keeps the parent graph a **sequence of decisions**; heavy string work is isolated.                                                                         |
| MCP parsing        | **Execute Workflow → [Unwrap MCP JSON](../shared/subworkflows/unwrap-mcp-json/)**       | Same envelope problem as other flows; shared UTIL avoids drift.                                                                                            |
| Native vs Code     | **Set + Execute Workflow** preferred; **one small Code** for upsert decision if present | Aligns with native-first layout described in [docs/ISSUES.md](../../docs/ISSUES.md) and this README. |
| Multiple contracts | Separate **MIPS** vs **QAUI** technical write-ups                                       | Exploration landed in two spec files; the functional story is one—see references below.                                                                    |


## MCP eXo interaction model

WF03 is the **broadest** demo: it touches **Notes**, **Tasks**, and **Agenda / calendar** style capabilities described in [SPEC.technical-exo-mips.md](SPEC.technical-exo-mips.md) (MIPS path) and [SPEC.technical-mcp.md](SPEC.technical-mcp.md) (QAUI exploration). Use those specs for **exact tool names and payload shapes**; they reflect live exploration notes and may differ per tenant.

## Operational considerations

- **Variables and ids** — space, template parent, project, note, and agenda references are **demo-specific**; align to your tenant or adjust n8n **$vars** as documented in [config.env.example](config.env.example) and the technical specs.
- **OAuth / OpenAI** — MCP and the LLM nodes must be **authorized** on the target n8n instance.
- **Node names** — expect legacy **COPIL** labels inside the graph; behavior is described in English in [SPEC.functional.md](SPEC.functional.md).

## References


| Artifact                                                                   | Role                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [workflow.json](workflow.json)                                             | Canonical n8n export (see [ADR 0002](../../docs/ADR/0002-repository-layout-workflows.md)). |
| [SPEC.functional.md](SPEC.functional.md)                                   | Goals, actors, note shape, business rules.                                                 |
| [SPEC.technical-exo-mips.md](SPEC.technical-exo-mips.md)                   | eXo MIPS MCP contract (notes, projects, agenda, etc.).                                     |
| [SPEC.technical-mcp.md](SPEC.technical-mcp.md)                             | eXo QAUI MCP exploration (phase 1).                                                        |
| [fixtures/steering-template-note.md](fixtures/steering-template-note.md)   | Editorial note template reference.                                                         |
| [fixtures/api-response.snapshot.json](fixtures/api-response.snapshot.json) | Raw API response snapshot (traceability).                                                  |
| [config.env.example](config.env.example)                                   | Example n8n variables.                                                                     |
| [subworkflow-dependencies.json](subworkflow-dependencies.json)             | Deploy order: Unwrap + WF03 UTILs.                                                         |
| [subworkflows/](subworkflows/)                                             | WF03-only UTIL exports (report + HTML).                                                    |


## Video walkthrough



**Short video:** *TBD*

---

## Repository file map


| File                                                                         | Role                                                                                               |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `[workflow.json](workflow.json)`                                             | Canonical n8n export (see [ADR 0002](../../docs/ADR/0002-repository-layout-workflows.md)).         |
| `[fixtures/api-response.snapshot.json](fixtures/api-response.snapshot.json)` | Raw API response (workflow + `triggerInfo`) kept for traceability.                                 |
| `[SPEC.functional.md](SPEC.functional.md)`                                   | Goals, rules, and acceptance criteria.                                                             |
| `[SPEC.technical-exo-mips.md](SPEC.technical-exo-mips.md)`                   | eXo MIPS MCP contract (notes, projects, agenda, etc.).                                             |
| `[SPEC.technical-mcp.md](SPEC.technical-mcp.md)`                             | eXo QAUI MCP exploration (phase 1).                                                                |
| `[fixtures/steering-template-note.md](fixtures/steering-template-note.md)`   | Note template (editorial reference).                                                               |
| `[config.env.example](config.env.example)`                                   | Example n8n variables.                                                                             |
| `[subworkflows/](subworkflows/)`                                             | WF03-only UTIL exports (build report + compose HTML); not shared across other portfolio workflows. |


## Sub-workflows

**Unwrap** is cross-portfolio under `[workflows/shared/subworkflows/](../shared/subworkflows/unwrap-mcp-json/README.md)`; the two UTIL graphs live only under this workflow directory. For **REST deploy from git**, use `./tools/deploy.sh wf03` from the repository root: [subworkflow-dependencies.json](subworkflow-dependencies.json) lists unwrap plus the two UTILs in order; the deploy script **PUT**s each dependency, then injects remote `**workflowId`** values into the parent **in memory** (from `.env`, optional UTIL JSON top-level `id`, or the **Execute Workflow** values already in `workflow.json`). Override per-tenant ids with `N8N_WORKFLOW_ID_UNWRAP`, `N8N_WORKFLOW_ID_WF03_BUILD_REPORT`, and `N8N_WORKFLOW_ID_WF03_COMPOSE` in root `.env` if they differ from the reference graph.


| UTIL                            | Repo path                                                                                      | Reference remote id (demo export in parent `workflow.json`) |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Unwrap MCP JSON                 | [../shared/subworkflows/unwrap-mcp-json/](../shared/subworkflows/unwrap-mcp-json/)             | `E4OAThogWRG93MUG`                                          |
| WF03 build report context       | [subworkflows/wf03-build-report-context/](subworkflows/wf03-build-report-context/)             | `KBsZj9ClCJX2wNFH`                                          |
| WF03 compose steering note HTML | [subworkflows/wf03-compose-steering-note-html/](subworkflows/wf03-compose-steering-note-html/) | `dDeDXkNJkWxxqxPb`                                          |


## Identifiers (from spec)

- n8n workflow: `1suyxKutB174p7b4` (name on the instance: `WF03 - Weekly steering preparation`).

## Code vs native

WF03’s main graph favors **Set**, **Execute Workflow** (shared unwrap + two WF03 UTILs), and a single small **Decide Note Upsert** Code node; HTML/report composition lives in UTIL sub-workflows. See [docs/ISSUES.md](../../docs/ISSUES.md) for optional further native-only tweaks.

## Import and deploy

**REST (recommended):** From the repo root, `./tools/deploy.sh wf03` (see [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md#portfolio-deploy-dependencies-manifest)). First-time UTILs on a new n8n tenant: `./tools/deploy.sh wf03 --create-missing-deps`, then add printed lines to `.env`. Use `./tools/deploy.sh wf03 --dry-run` to print PUT targets (GETs still run for credential merge). Use `./tools/deploy.sh wf03 --no-deps` only if you intentionally skip the manifest.

**Manual UI:** Import [UTIL - Unwrap MCP JSON](../shared/subworkflows/unwrap-mcp-json/workflow.json), [UTIL - WF03 build report context](subworkflows/wf03-build-report-context/workflow.json), and [UTIL - WF03 compose steering note HTML](subworkflows/wf03-compose-steering-note-html/workflow.json); align **Execute Workflow** ids in `workflow.json` if your instance assigned different ids. Then import `workflow.json` (or MCP `validate_workflow` / `update_workflow`). Set `EXO_MCP_ENDPOINT` and the `WF03_`* variables from the graph / technical specs; verify MCP OAuth and OpenAI on the target instance.