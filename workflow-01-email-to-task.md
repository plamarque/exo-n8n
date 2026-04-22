# Workflow 01 - Email entrant vers tache eXo auto-assignee

## 1) Objectif
Automatiser le tri des emails entrants et la creation de taches eXo avec priorisation, assignation, suivi SLA et escalade.

## 2) Contexte metier et storytelling
La ville de Chevigny prepare le festival Art2Rue. L'equipe projet centralise les echanges dans eXo, mais une partie des demandes arrive encore par email (prestataires, mairie, securite, riverains).

Le lundi matin, l'equipe support recoit un pic de messages:
- panne VPN du prestataire billetterie
- demande d'acces GED pour la direction commerciale
- incident de partage de plan securite
- question urgente de la mairie sur un document manquant

Aujourd'hui, ces messages sont traites manuellement. Les risques observes:
- oubli d'un email critique
- mauvaise priorisation
- retard de traitement sans relance
- manque de tracabilite sur "qui fait quoi"

Le but de la demo est de montrer qu'un flux n8n + eXo peut transformer ce chaos en execution fiable, en mode IA-first pour l'affectation des taches.

## 3) Ce qu'on cherche a demontrer
1. Chaque email entrant devient une tache exploitable.
2. La priorite et le delai sont calcules automatiquement.
3. L'assignation est faite par un agent IA selon le contenu de l'email et les responsabilites des membres.
4. Les retards declenchent relance puis escalade.
5. Les evidences sont visibles dans eXo (commentaires, statut, historique).

## 4) Faisabilite MCP eXo QAUI
### Tools MCP eXo identifies (direct MCP)
- `get_my_spaces`
- `search_documents`
- `get_document_by_id`
- `list_projects`
- `get_project_by_id`
- `list_project_statuses`
- `list_tasks`
- `list_assigned_tasks`
- `create_task_in_project`
- `assign_task`
- `update_task_status`
- `add_task_comment`
- `add_project_label_to_task`
- `list_emails`
- `get_email_by_id`

### Conclusion pour ce workflow
- MCP direct couvre la chaine complete de ce cas d'usage (emails + projets + taches + contexte documentaire).
- L'architecture cible devient **MCP-first**, REST restant un filet de securite endpoint par endpoint.
- Strategie recommandee:
  - n8n: orchestration, regles metier, IA optionnelle
  - eXo MCP: execution nominale des operations
  - eXo REST: fallback uniquement si indisponibilite MCP sur une capacite donnee

## 5) Endpoints / tools cibles
### 5.1 MCP eXo (primaire)
- `list_emails`
- `get_email_by_id`
- `list_projects`
- `get_project_by_id`
- `list_project_statuses`
- `create_task_in_project`
- `assign_task`
- `update_task_status`
- `add_task_comment`
- `get_my_spaces`
- `search_documents`
- `get_document_by_id`

### 5.2 REST eXo (fallback cible)
Base URL REST (a valider): `https://<exo-host>/portal/rest`
- `GET /projects/projects?q=...`
- `GET /projects/projects/status/{id}`
- `POST /tasks`
- `GET /tasks/filter`
- `POST /tasks/comments/{id}`
- `PUT /tasks/updateCompleted/{idTask}?isCompleted=true|false`

## 6) Sequence detaillee
1. Trigger MCP eXo email: `list_emails` (polling planifie n8n) puis `get_email_by_id`.
2. Normalisation: auteur, sujet, corps, date, pieces jointes.
3. Qualification et affectation par Agent IA (node `agent` n8n):
   - analyse du sujet, expediteur, corps, pieces jointes et contexte
   - sortie structuree: `intent`, `domain`, `priority`, `slaHours`, `assignee_username`, `rationale`
   - l'agent route vers le meilleur responsable selon consignes metier
4. Filtre actionnabilite strict: si l'email n'est pas clairement actionnable, on ignore (pas de creation de tache).
5. Resolution projet/statut via MCP (`list_projects` + `list_project_statuses`).
6. Creation tache eXo via MCP (`create_task_in_project`) puis assignation (`assign_task`).
7. Si `create_task_in_project` ne retourne pas de `task_id`, le workflow echoue explicitement (pas de faux succes).
6. Enrichissement optionnel via MCP eXo (doc de contexte lie au ticket).
7. Polling des taches en retard via MCP (`list_tasks`).
8. Relance automatique via MCP (`add_task_comment`).
9. Escalade si depassement de seuil.
10. Si un endpoint MCP echoue: bascule REST uniquement pour l'etape concernee.

## 7) Mode d'affectation cible (IA)
### Agent IA d'affectation
- Classification semantique des emails.
- Resume automatique du ticket.
- Affectation decidee par l'agent selon le contenu complet du message (`from`, `subject`, `body`) et les responsabilites ci-dessous:
  - `louis`: responsable des moyens techniques et numeriques du festival.
  - `claire`: cheffe de projet festival.
  - `lucie`: responsable des relations avec les institutions.
- Sortie attendue de l'agent: `assignee_username` + justification courte (`rationale`) pour tracabilite.

### Fallback (seulement si IA indisponible)
- Matrice simplifiee de secours pour garantir la continuite de service.

## 8) Story-driven dataset (base demo)
```json
{
  "storyContext": {
    "event": "Festival Art2Rue",
    "date": "2026-06-15",
    "criticalityWindow": "J-30",
    "projectName": "Festival Art2Rue - Operations"
  },
  "actors": [
    {"username":"louis","role":"Responsable moyens techniques et numeriques","skills":["vpn","reseau","outillage","numerique"],"capacity":3},
    {"username":"claire","role":"Cheffe de projet festival","skills":["coordination","arbitrage","suivi global"],"capacity":3},
    {"username":"lucie","role":"Responsable relations institutions","skills":["mairie","administration","documents institutionnels"],"capacity":2},
    {"username":"teamlead_it","role":"Manager IT"}
  ],
  "emails": [
    {
      "messageId":"M-1001",
      "from":"billetterie@prestataire.fr",
      "subject":"URGENT - VPN KO depuis 8h",
      "body":"Nos agents ne peuvent plus acceder a la billetterie.",
      "receivedAt":"2026-05-14T07:50:00Z"
    },
    {
      "messageId":"M-1002",
      "from":"dc@novatis.fr",
      "subject":"Demande acces GED partenaires",
      "body":"Merci de creer 3 acces externes pour consultation.",
      "receivedAt":"2026-05-14T08:10:00Z"
    },
    {
      "messageId":"M-1003",
      "from":"mairie@chevigny.fr",
      "subject":"Plan de circulation introuvable",
      "body":"Besoin du document valide avant 14h.",
      "receivedAt":"2026-05-14T08:15:00Z"
    }
  ],
  "routingPolicy": {
    "type": "ai_agent",
    "instructions": [
      "Analyse le sujet, l'expediteur et le corps de l'email.",
      "Assigne louis pour les sujets techniques et numeriques.",
      "Assigne lucie pour les demandes liees aux institutions (mairie, administration).",
      "Assigne claire pour la coordination projet, arbitrages ou cas transverses."
    ],
    "outputSchema": {
      "assignee_username": "louis|claire|lucie",
      "priority": "LOW|NORMAL|HIGH|URGENT",
      "slaHours": "number",
      "rationale": "string"
    }
  },
  "watchers": ["teamlead_it"]
}
```

## 9) Payloads de reference
### 9.1 MCP - creation tache (`create_task_in_project`)
```json
{
  "project_id": 66,
  "title": "Incident VPN - acces impossible",
  "description": "<div><p><strong>Email source:</strong> billetterie@prestataire.fr</p><h4>Contexte</h4><p>VPN KO depuis 8h.</p></div>",
  "assignee": "louis",
  "priority": "HIGH"
}
```

### 9.2 MCP - relance automatique (`add_task_comment`)
```json
{
  "task_id": 371,
  "comment": "Relance automatique: SLA depasse, merci de mettre a jour le statut."
}
```

### 9.3 REST fallback - creation tache (`POST /tasks`)
```json
{
  "title": "Incident VPN - acces impossible",
  "description": "Mail client: VPN KO depuis 8h",
  "assignee": "louis",
  "watcher": ["teamlead_it"],
  "priority": "HIGH",
  "dueDate": "2026-05-14T11:50:00Z"
}
```

## 10) Script de demo (10 min)
1. Injecter 3 emails de test (M-1001..M-1003).
2. Montrer creation automatique de 3 taches dans eXo.
3. Montrer priorites et assignees calculees.
4. Simuler un retard sur la tache VPN.
5. Montrer relance auto en commentaire.
6. Montrer escalade manager si delai depasse.

## 11) Criteres d'acceptation
- 100% des emails clairement actionnables convertis en taches.
- Les emails non actionnables sont ignores (aucune tache creee).
- Priorite et assignee toujours renseignes sur les taches creees.
- Relance visible en commentaire pour les retards.
- Escalade declenchee sur au moins 1 cas de test.
- En cas de reponse invalide de `create_task_in_project` (sans `task_id`), l'execution est en echec explicite.

## 12) MCP eXo direct - payloads reels observes
Ces payloads ont ete captures via appels directs `mcp__exo_qaui_mcp_server__`.

### 12.1 `get_my_spaces` (input)
```json
{ "limit": 20, "offset": 0, "query": "" }
```

### 12.2 `get_my_spaces` (output brut)
```json
[
  {
    "type": "text",
    "text": "[{\"name\":\"Festival Art2Rue\",\"space_id\":66,...}]"
  }
]
```

### 12.3 `search_documents` (input)
```json
{ "query": "festival", "limit": 5, "offset": 0 }
```

### 12.4 Regle de parsing
- Le serveur renvoie une enveloppe `[{type,text}]`.
- `text` contient du JSON serialize en string.
- Parsing en 2 etapes obligatoire.

## 13) Reevaluation faisabilite MCP QAUI (maj)
Constat suite a exploration directe (hors workflow n8n):

### 13.1 Capacites MCP confirmees pour Projects/Tasks
Tools verifies en execution:
- `list_projects`
- `get_project_by_id`
- `list_tasks`
- `list_assigned_tasks`
- `list_project_statuses`
- `list_project_labels`
- `list_users_of_space_by_role`
- et aussi tools de mutation exposes: `create_task_in_project`, `assign_task`, `update_task_status`, `add_task_comment`, etc.

Exemple output `list_projects` (brut):
```json
[{"type":"text","text":"{\"projects\":[{\"name\":\"Festival Art2Rue\",\"project_id\":66,...}],\"count\":43}"}]
```

Exemple output `list_tasks` sur `project_id=66`:
```json
[{"type":"text","text":"{\"tasks\":[{\"task_id\":371,\"title\":\"Review security...\",\"status\":{\"status_id\":261},...}],\"count\":99}"}]
```

### 13.2 Capacites MCP emails: validees en appel direct QAUI
Tools verifies:
- `list_emails`
- `get_email_by_id`

Etat observe sur QAUI (2026-04-22):
- `list_emails` retourne une liste exploitable (`email_id`, `subject`, `content`, `sender`, `receivedDate`).
- `get_email_by_id` retourne le detail complet pour conversion en tache.

## 14) Architecture cible MCP-first / REST-fallback
### 14.1 Matrice de decisions techniques
1. Source emails entrantes:
- Priorite: MCP eXo `list_emails` + `get_email_by_id`
- Fallback: IMAP/Gmail externe si indisponibilite MCP

2. Creation et pilotage taches:
- Priorite: MCP eXo (`create_task_in_project`, `assign_task`, `update_task_status`, `add_task_comment`, `list_tasks`)
- Fallback: REST Tasks (`POST /tasks`, `PUT/GET associes`)

3. Resolution projet/statuts:
- Priorite: MCP eXo (`list_projects`, `list_project_statuses`, `get_project_by_id`)
- Fallback: REST Projects

4. Contexte documentaire:
- Priorite: MCP eXo (`search_documents`, `get_document_by_id`)
- Fallback: REST Documents

### 14.2 Evidence de validation email MCP (2026-04-22)
- `list_emails` OK: retourne des emails avec `email_id`, `subject`, `content`, `sender`, `receivedDate`.
- `get_email_by_id` OK: retourne le detail complet (to, body, meta, etc.).

Exemple output `list_emails` (brut):
```json
[{"type":"text","text":"[{\"email_id\":3,\"subject\":\"Security alert\",...}]"}]
```

Exemple output `get_email_by_id` (brut):
```json
[{"type":"text","text":"{\"email_id\":1,\"subject\":\"hello\",\"content\":{\"body\":\"bienvenue -- Patrice Lamarque\"},...}"}]
```
