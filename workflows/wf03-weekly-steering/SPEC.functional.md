# Workflow 03 — Weekly steering preparation

> Technical exploration: [SPEC.technical-exo-mips.md](SPEC.technical-exo-mips.md) (MIPS) and [SPEC.technical-mcp.md](SPEC.technical-mcp.md) (QAUI). Note model: [fixtures/steering-template-note.md](fixtures/steering-template-note.md). Portfolio: [`../../docs/SPEC.md`](../../docs/SPEC.md).

## 1) Goal

Prepare the weekly project steering committee (COPIL) meeting in advance with:

- A meeting note bootstrapped from a template
- A tabular progress report embedded in the note
- A suggested agenda from an LLM reading the task list
- A standing calendar event pointing to the note for the week

The routine should cut manual prep time, standardize the handout, and give all participants a shared read-ahead.

## 2) Business context

The team runs a fixed weekly slot. Today prep is ad hoc: the note is typed manually, copy/paste carries the outline, and status is re-read from tasks by hand. The need is to industrialize the routine while keeping the same meeting habits: same template, same invitees, with automation filling structure, report, and AI nudges.

**Demo value** — the workflow is not a dump of metrics; it is the meeting pack inside the day-to-day eXo tools (notes, tasks, calendar).

## 3) What the demo should show

1. Proactive preparation of a standing governance ritual.  
2. A shared note template.  
3. One consolidated view of project work.  
4. Notes, tasks, and calendar driven by one n8n workflow.  
5. LLM highlights risks useful for the steering.  
6. Pushing the right link at the right time without hand-copy.

## 4) Actors

- **Project team** — prepares, facilitates, and edits the live note.  
- **Steering committee facilitator** — owns the format and checks agenda sections (COPIL-style ritual in the demo).  
- **Participants** — get the standing invite, open the note from the event description, see the pre-filled report.  

Standing participants: `claire`, `etienne`, `louis`, `nadia`, `antoine`, `emma`.

## 5) Functional object

The workflow links three things:

### 5.1 Weekly note

Created in eXo **Notes** from a template. Fixed references for this build:

- Space: `Festival Art2Rue`
- Template note: `25`
- Parent of generated notes: `6`
- Project for the task table: `3`
- Recurring meeting: every Thursday 10:00

Minimum in the body: title with the meeting date, standard sections, a progress block, AI-suggested agenda, watch list, section for decisions/actions to fill live.

### 5.2 Tabular progress

Built from all tasks in project `3`. Columns: reference/title, owner, status, due, priority, blocker/comment when present. Read before the meeting, updated verbally during the steering committee (COPIL in the demo habit).

### 5.3 LLM layer (non binding)

Suggests watching items: blocked urgent work, stagnation, pile-ups in a column, atypical load. Output must stay short, factual, and non-decisional. Thresholds (tunable in workflow): stagnation 3d, stuck/waiting 5d, 5+ tasks in one column.

### 5.4 Calendar holder

A weekly occurrence with title, 10:00, weekly recurrence, standing attendees, and in the event body a link to the prepared note of that week.

## 6) Triggering and cadence

Default: Thursday 10:00. The run should land **before** the slot so the pack is read-ahead. Example: the scheduled trigger fires early Thursday (or a chosen prep hour), the note and invite point to the **next** same-week slot per implementation math.

## 7) High-level step list

1. Find which steering committee occurrence to prepare.  
2. Set the date used in the title.  
3. Read template note.  
4. Create or update the child note for that week.  
5. List tasks, build the HTML table.  
6. Run the LLM on a compact task payload.  
7. Render HTML into the template, insert the table, inject AI text.  
8. Search/update or create the note, then point the parent agenda’s description at the new note.  
9. Stakeholders open the same invite and note every week with fresh content.

## 8) Business rules

**Note** — one note per occurrence, dated title, always from the same root template, children of `6`, AI blocks clearly labeled as suggestions, progress section clearly marked.

**Table** — only project `3` in scope, snapshot “as of prep time”.

**LLM** — grounded in task data, no fake facts, participants decide in meeting.

**Calendar** — weekly, same identity week to week, description must match the right note; if the note is regenerated, keep link coherent.

## 9) Note shape (example)

```markdown
# Steering committee — Project X - 2026-04-27

## Agenda
- Global progress
- AI-suggested topics
- Blockers
- Expected decisions
- Next due dates

## Progress report
[table inserted by workflow]

## Suggested watch items
[LLM list]

## Discussion
...
```

(Exact headings in production follow `fixtures/steering-template-note.md` and the Code composer.)

## 10) Acceptance (functional)

1. Each run produces one note and one updated agenda description with the right link.  
2. The report reflects tasks on project `3` at run time.  
3. Suggested agenda and watch list are non-binding and labeled.  
4. Invitees match the defined list.  
5. A Thursday slot at 10:00 is the reference rhythm.

## 11) Weekly update / regeneration

If a note for the same title already exists, the workflow can update in place; otherwise it creates. AI blocks refresh; manual edits between runs may be overwritten in automated sections (document as limitation).

## 12) Open points

- Tighter merge between LLM and template headings.  
- Hardening idempotency of note search by exact title.  
- Optional: push chat notifications (out of current scope).  

(Exact numeric IDs and n8n node map: see `SPEC.technical-exo-mips.md` and repo `workflow.json`.)
