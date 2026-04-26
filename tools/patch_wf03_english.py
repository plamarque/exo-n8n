#!/usr/bin/env python3
"""
Embeds `tools/_compose_raw.js` into the WF03 canonical workflow and refreshes
workflow metadata. Optional French → English string upgrades run only if legacy
substrings are still present (e.g. after restoring an old `workflow.json`).
"""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WP = REPO / "workflows" / "wf03-weekly-copil" / "workflow.json"
COMPOSE_SRC = REPO / "tools" / "_compose_raw.js"


def maybe_upgrade_french_to_english(c: str) -> str:
    """If legacy French still exists, map status helpers were already upgraded in repo."""
    if "mapStatusFr" not in c:
        return c
    c = c.replace("  const label = mapStatusFr(value);", "  const label = mapStatusEn(value);")
    c = c.replace(
        "function mapStatusFr(value) {\n  const v = String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\\s+/g, ' ').trim();\n  if (v === 'to do' || v === 'todo') return 'A faire';\n  if (v === 'in progress' || v === 'inprogress') return 'En cours';\n  if (v === 'done') return 'Terminee';\n  if (v === 'blocked') return 'Bloquee';\n  if (v === 'waiting on' || v === 'waitingon') return 'En attente';\n  return value || 'Non qualifie';\n}",
        "function mapStatusEn(value) {\n  const v = String(value || '').toLowerCase().replace(/_/g, ' ').replace(/\\s+/g, ' ').trim();\n  if (v === 'to do' || v === 'todo') return 'To do';\n  if (v === 'in progress' || v === 'inprogress') return 'In progress';\n  if (v === 'done') return 'Done';\n  if (v === 'blocked') return 'Blocked';\n  if (v === 'waiting on' || v === 'waitingon') return 'Waiting';\n  return value || 'Unspecified';\n}",
    )
    c = c.replace(
        "function mapPriorityFr(value) {\n  const v = String(value || '').toUpperCase();\n  if (v === 'HIGH') return 'Haute';\n  if (v === 'NORMAL' || v === 'MEDIUM') return 'Moyenne';\n  if (v === 'LOW') return 'Basse';\n  return value || 'Non qualifiee';\n}",
        "function mapPriorityEn(value) {\n  const v = String(value || '').toUpperCase();\n  if (v === 'HIGH') return 'High';\n  if (v === 'NORMAL' || v === 'MEDIUM') return 'Normal';\n  if (v === 'LOW') return 'Low';\n  return value || 'Unspecified';\n}",
    )
    c = c.replace("+ esc(mapPriorityFr(priority))", "+ esc(mapPriorityEn(priority))")
    return c


def main() -> None:
    data = json.loads(WP.read_text(encoding="utf-8"))
    data["name"] = "WF03 - Weekly COPIL preparation"
    data["description"] = (
        "Prepares the weekly GraphFlow/eXo steering committee pack (COPIL): loads the template and tasks, "
        "generates AI signals, creates or updates the note, then syncs the calendar."
    )
    compose_js = COMPOSE_SRC.read_text(encoding="utf-8").rstrip() + "\n"

    for node in data["nodes"]:
        name = node.get("name")
        params = node.get("parameters") or {}
        if name == "Build Report Context" and "jsCode" in params:
            c = params["jsCode"]
            if "mapStatusFr" in c:
                c = maybe_upgrade_french_to_english(c)
            # Full table/paragraph replacement if French table header still present
            if "Tache</th><th>Sujet</th>" in c:
                c = c.replace(
                    "  ? '<table><thead><tr><th>Tache</th><th>Sujet</th><th>Responsable</th><th>Statut</th><th>Echeance</th><th>Priorite</th><th>Commentaire / blocage</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>'\n  : '<p>Aucune tache trouvee dans le perimetre du projet au moment de la preparation.</p>';",
                    "  ? '<table><thead><tr><th>Task</th><th>Subject</th><th>Owner</th><th>Status</th><th>Due</th><th>Priority</th><th>Comment / blocker</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>'\n  : '<p>No tasks found in the project scope at preparation time.</p>';",
                )
            if "Non qualifie" in c and "statusCounts" in c:
                c = c.replace(
                    "  const status = String(task.status?.status || task.status?.name || task.status || 'Non qualifie');\n  statusCounts[status] = (statusCounts[status] || 0) + 1;\n",
                    "  const status = String(task.status?.status || task.status?.name || task.status || 'Unspecified');\n  statusCounts[status] = (statusCounts[status] || 0) + 1;\n",
                )
            if "mapStatusFr(task.status" in c:
                c = c.replace(
                    "        status: mapStatusFr(task.status?.status || task.status?.name || task.status),\n        priority: mapPriorityFr(task.priority),",
                    "        status: mapStatusEn(task.status?.status || task.status?.name || task.status),\n        priority: mapPriorityEn(task.priority),",
                )
            params["jsCode"] = c
        if name == "Prepare COPIL Config" and "jsCode" in params:
            c = params["jsCode"]
            if "Equipe projet" in c:
                c = c.replace("String($vars.WF03_MEETING_OWNER || 'Equipe projet')", "String($vars.WF03_MEETING_OWNER || 'Project team')")
            if "COPIL Festival Art2Rue" in c:
                c = c.replace("const title = 'COPIL Festival Art2Rue - ' + ymd(meeting);", "const title = 'Festival Art2Rue — COPIL — ' + ymd(meeting);")
            params["jsCode"] = c
        if name == "Analyze COPIL Signals":
            params["text"] = (
                "=Analyze these tasks to prepare a weekly steering committee (COPIL) meeting. Return only the requested structured fields in English. "
                "To cite a task, use /task:task_id. For an owner, use @username. Data: {{ $json.ai_prompt_payload }}"
            )
            opt = params.get("options") or {}
            opt["systemMessage"] = (
                "You help a project team prepare a weekly steering committee meeting. Produce short, factual, non-prescriptive "
                "suggestions grounded in task data. Use clear English. Use /task:task_id and @username when relevant. "
                "Do not decide on behalf of the meeting."
            )
            params["options"] = opt
        if name == "COPIL Structured Output" and "jsonSchemaExample" in params:
            params["jsonSchemaExample"] = (
                '{"suggested_agenda":["Short, actionable point"],'
                '"vigilances":["Watch item grounded in task data"],'
                '"summary":"Short opener for the meeting"}'
            )
        if name == "Compose COPIL Note" and "jsCode" in params:
            params["jsCode"] = compose_js
        for agenda_name in ("Prepare Agenda Update After Update", "Prepare Agenda Update After Create"):
            if name == agenda_name and "jsCode" in params:
                c = params["jsCode"]
                if "COPIL hebdo" in c or "Support de reunion" in c:
                    c = c.replace(
                        "summary: 'COPIL hebdo - ' + noteContext.meeting_date, description: '<p>Support de reunion: <a href=\"' + noteUrl + '\" target=\"_blank\" rel=\"noopener noreferrer\">' + noteContext.note_title + '</a></p><p>Prepare automatiquement depuis les taches du projet ' + noteContext.project_id + '.</p>'",
                        "summary: 'Weekly COPIL - ' + noteContext.meeting_date, description: '<p>Meeting support: <a href=\"' + noteUrl + '\" target=\"_blank\" rel=\"noopener noreferrer\">' + noteContext.note_title + '</a></p><p>Prepared automatically from project ' + noteContext.project_id + ' tasks.</p>'",
                    )
                params["jsCode"] = c

    WP.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Updated", WP)


if __name__ == "__main__":
    main()
