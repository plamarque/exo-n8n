# Workflow 03 — eXo **QAUI** MCP exploration (phase 1)

> This document records early MCP **QAUI** tool verification used while designing workflow 03. The **production** contract for the current demo is the MIPS host — see [SPEC.technical-exo-mips.md](SPEC.technical-exo-mips.md) and the canonical n8n export.  
> **Date:** 2026-04-23 (Europe/Paris)

## 1) Scope of this file

- Capture connector behavior (payloads, edge cases) before the final n8n JSON.  
- Document the universal MCP text envelope.  
- Provide a catalog of the tools that were called successfully during the spike.

The executable workflow in git supersedes narrative gaps here.

## 2) Test harness

A disposable QAUI space and sample objects were created through MCP to validate tools:

- Test space `MCP Test Workflow03` (example)  
- Sample `project_id`, `note_id` pairs for `get_note` / `create_child_note` smoke tests.  
(Exact ids in this section were for throwaway data; the portfolio uses the ids listed in the MIPS spec.)

## 3) Envelope format (applies to QAUI and QA stacks)

```json
[
  { "type": "text", "text": "{...serialized json...}" }
]
```

1. Read the `content[0].text` array.  
2. `JSON.parse` the inner string when it looks like JSON.  
3. If parsing fails, treat the string as a plain status (`"Done"`, `null`, error text).

## 4) Tools probed (QAUI) — by domain

**Spaces** — `get_my_spaces`, `list_space_templates`, `create_space`, `get_space_by_id`.  

**Notes** — `get_space_note_tree`, `create_space_note`, `create_child_note`, `move_note`, `delete_note`.  

**Projects & tasks** — `create_project_in_space`, `list_projects`, `get_project_by_id`, `create_task_in_project`, `list_tasks`, `list_project_activity_since`, `create_personal_task`, `add_task_comment`, `list_task_comments_by_id`, `get_project_id_by_task_id`.  

**Agenda** — `create_agenda_event`, `get_agenda_events`, `get_agenda_event_by_id`, `invite_users_to_agenda_event`, `invite_space_to_agenda_event`, `cancel_agenda_event`.  

**Documents** — `search_documents`, `get_document_by_id`, `get_document_content_by_id`.  

> Each sub-section in the original exploration log (April 2026) contained concrete JSON for inputs/outputs. The behaviors matched expectations: `create_*` return rich objects, `update` calls often return `"Done"`, and note trees contain nested `child_notes`.

## 5) Target MCP sequence (design-time)

1. `get_note` on the template, `list_tasks` for project context.  
2. Compose the weekly HTML, LLM in the middle, then `search_notes` + `update_note` / `create_child_note`.  
3. `update_agenda_event` + `invite_users_to_agenda_event`.  

(Implemented literally in the canonical `workflow.json` with the MIPS endpoint.)

## 6) Error handling and resilience (exploration)

- Re-auth failures surface as `Could not connect to your MCP server` in n8n.  
- Large HTML payloads: raise MCP / HTTP timeout to ≥60s in nodes.  
- Always guard `getWorkflowStaticData` access with the `$` helper (n8n 1.x) — fixed during WF03 bring-up.  

## 7) Checklist before wiring phase 2 (n8n JSON)

- [ ] Envelope parser function shared or inlined across Code nodes.  
- [ ] Title convention for the weekly note to enable search-before-create.  
- [ ] Agenda id is stable; avoid duplicate recurring events.  
- [ ] LLM schema is versioned in the agent output parser.  

## 8) Conclusion (QAUI)

The QAUI spike proved every primitive needed for WF03 exists in MCP. The current repository tracks the **MIPS-backed** instance because it carries the long-lived `space_id=1` data (`template 25`, parent `6`, agenda `13`, project `3`). Re-run this exploration when the connector version bumps or when new tools (e.g. richer recurrence) become available.
