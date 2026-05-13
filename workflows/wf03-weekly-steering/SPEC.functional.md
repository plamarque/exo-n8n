# Workflow 03 — Weekly steering preparation

> Technical implementation: [SPEC.technical.md](SPEC.technical.md). Note model: [fixtures/steering-template-note.md](fixtures/steering-template-note.md). Portfolio: [`../../docs/SPEC.md`](../../docs/SPEC.md).

## 1) Goal

Prepare the weekly project steering committee (COPIL) meeting in advance with:

- A meeting note bootstrapped from a template
- An AI-generated progress narrative (notable items, stalled work) grounded in the project task list
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

Minimum in the body: title with the meeting date, standard sections, an AI progress narrative, AI-suggested agenda, AI watch list, section for decisions/actions to fill live.

### 5.2 AI progress report

Built from all tasks in project `3` via a single LLM call. The model returns an HTML narrative (opener paragraph + 2-3 subsections such as "Notable items", "Stalled or blocked", "Recent moves") that highlights what matters this week: priorities, stagnation, blockers, recent movement. Read before the meeting, updated verbally during the steering committee (COPIL in the demo habit). The report is grounded in task data, not invented, and cites `/task:ID` and `@username` for traceability.

### 5.3 LLM layer (non binding)

Same LLM call also suggests an agenda and a short list of watch items: blocked urgent work, stagnation, pile-ups in a column, atypical load. Output must stay short, factual, and non-decisional. Thresholds (tunable in workflow): stagnation 3d, stuck/waiting 5d, 5+ tasks in one column. Watch items must not duplicate the progress narrative.

### 5.4 Language adaptation

The eXo template note may be written in any natural language (French, English, …). The LLM call receives the template body, detects its language, and produces every generated string in that same language: the agenda items, the progress narrative (including its subsection headings), the watch items, the summary, and the three localized labels rendered in the agenda event description. No static translation table lives in the workflow.

### 5.4 Calendar holder

A weekly occurrence with title, 10:00, weekly recurrence, standing attendees, and in the event body a link to the prepared note of that week.

## 6) Triggering and cadence

Default: Thursday 10:00. The run should land **before** the slot so the pack is read-ahead. Example: the scheduled trigger fires early Thursday (or a chosen prep hour), the note and invite point to the **next** same-week slot per implementation math.

## 7) High-level step list

1. Find which steering committee occurrence to prepare and set the date used in the title.
2. Read the template note from eXo.
3. List project tasks.
4. Run a single LLM call (structured output) on the template body, the task list, and the meeting context. It detects the template language and returns, all in that language: a suggested agenda, an HTML progress narrative, short watch items, a summary, and three short labels used for the agenda event description.
5. Build the AI agenda, AI watch items, and useful-links sections (each rendered by a small HTML node).
6. Compose the final note HTML by patching the template tokens with the dynamic sections (single short Code node): the AI HTML progress narrative goes into the progress report block, the AI lists into the agenda and watch-item blocks.
7. Search for the existing weekly note by title, then update it (if found) or create a new child note.
8. Build the agenda event description that links to the saved note (plus the AI agenda), then update the recurring agenda and refresh the invitee list.
9. Stakeholders open the same invite and note every week with fresh content.

## 8) Business rules

**Note** — one note per occurrence, dated title, always from the same root template, children of `6`, AI blocks clearly labeled as suggestions, progress section clearly marked.

**Progress report** — only project `3` in scope, snapshot "as of prep time", produced by the LLM directly as HTML, grounded in task data (cites `/task:ID` and `@username`).

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
[AI narrative inserted by workflow: opener paragraph + 2-3 subsections like
 "Notable items", "Stalled or blocked", with bullets citing /task:ID and @username]

## Suggested watch items
[LLM list]

## Discussion
...
```

(Exact headings in production follow `fixtures/steering-template-note.md` and the Code composer.)

## 10) Acceptance (functional)

1. Each run produces one note and one updated agenda description with the right link.  
2. The progress narrative reflects the actual state of tasks on project `3` at run time (cites real `task_id`s and assignees).  
3. Suggested agenda and watch list are non-binding and labeled.  
4. Invitees match the defined list.  
5. A Thursday slot at 10:00 is the reference rhythm.

## 11) Weekly update / regeneration

If a note for the same title already exists, the workflow can update in place; otherwise it creates. AI blocks refresh; manual edits between runs may be overwritten in automated sections (document as limitation).

## 12) Open points

- Tighter merge between LLM and template headings.  
- Hardening idempotency of note search by exact title.  
- Optional: push chat notifications (out of current scope).  

(Exact numeric IDs and n8n node map: see [SPEC.technical.md](SPEC.technical.md) and repo `workflow.json`.)
