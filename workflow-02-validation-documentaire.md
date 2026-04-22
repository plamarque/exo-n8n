# Workflow 02 - Validation documentaire multi-niveaux

## 1) Objectif
Declencher automatiquement un circuit de validation documentaire (manager puis juridique), avec relances et escalades, tracable de bout en bout.

## 2) Contexte metier et storytelling
A J-30 du festival Art2Rue, des documents sensibles doivent etre valides rapidement:
- plan de circulation
- protocole securite benevoles
- contrat artiste

Dans la realite, les validations circulent par email et messagerie. Effets constates:
- versions contradictoires
- oublis de validation
- retard sur les dossiers mairie
- responsabilites floues

La demo raconte une journee critique:
- 09:00: un document est mis a jour dans l'espace projet.
- 09:01: le workflow detecte la modification.
- 09:02: creation de la demande de validation manager.
- 24h plus tard: relance auto si non traite.
- 48h plus tard: escalation vers direction.

## 3) Ce qu'on cherche a demontrer
1. Le document est detecte et qualifie automatiquement.
2. La demande de validation est ouverte sans action manuelle.
3. Les etapes manager puis juridique sont respectees.
4. Les relances/escalades sont automatiques.
5. La piste d'audit est complete (qui, quand, quoi).

## 4) Faisabilite MCP eXo QAUI
### Tools MCP eXo identifies (direct MCP)
- `get_my_spaces`
- `search_documents`
- `get_document_by_id`
- `list_projects`
- `get_project_by_id`
- `list_tasks`
- `get_task_by_id`
- `create_task_in_project`
- `assign_task`
- `update_task_status`
- `add_task_comment`
- `list_users_of_space_by_role`
- `add_project_label_to_task`

### Conclusion pour ce workflow
- MCP direct couvre la lecture documentaire et le cycle de validation operationnel via taches (creation, assignation, transitions, commentaires).
- Le circuit nominal est MCP-first.
- REST Processes reste un fallback pour les organisations qui exigent un moteur de work/approval reglementaire distinct.

## 5) Endpoints / tools cibles
### 5.1 MCP eXo (primaire)
- `get_my_spaces`
- `search_documents`
- `get_document_by_id`
- `list_projects`
- `list_users_of_space_by_role`
- `create_task_in_project`
- `assign_task`
- `update_task_status`
- `add_task_comment`
- `list_tasks`

### 5.2 REST eXo (fallback cible)
Base URL REST: `https://<exo-host>/portal/rest`
- `POST /v1/processes/works`
- `PUT /v1/processes/works`
- `PATCH /v1/processes/work/{workId}`
- `GET /v1/processes/works/statuses`
- `GET /v1/documents/{documentId}`
- `GET /v1/documents/versions?fileId=...`

## 6) Sequence detaillee
1. Trigger: document cree ou modifie (event/polling).
2. Resolution de l'espace via MCP `get_my_spaces`.
3. Recherche des documents cibles via `search_documents`.
4. Chargement detaille via `get_document_by_id`.
5. Option IA: resume, controle champs manquants, proposition classification.
6. Creation d'une tache de validation via MCP `create_task_in_project` (statut initial).
7. Assignation sequentielle manager -> juridique via MCP `assign_task` et `update_task_status`.
8. Relance a 24h via MCP `add_task_comment`.
9. Escalade a 48h (reassignation + commentaire + label).
10. Si une etape MCP n'est pas disponible: fallback REST ciblé sur l'etape.

## 7) Avec IA vs sans IA
### Avec IA
- Resume du document pour accelerateur de decision.
- Detection automatique des points de vigilance.
- Proposition de categories metier.

### Sans IA
- Checklists fixes par type de document.
- Description standard de demande.
- Circuit de validation strictement regle.

## 8) Story-driven dataset (base demo)
```json
{
  "storyContext": {
    "event": "Festival Art2Rue",
    "criticalMilestone": "Depot dossiers mairie",
    "deadline": "2026-05-20T16:00:00Z"
  },
  "space": {"name":"Festival Art2Rue", "space_id":66},
  "documents": [
    {
      "document_id":"1221462b39805e112f341674adf8d147",
      "name":"Rapport_Bilan_Festival_2025_Art2Rue.docx",
      "type":"retour_experience",
      "riskLevel":"NORMAL"
    },
    {
      "document_id":"121d01c039805e110e39119e0dbb3806",
      "name":"Permis_Installation_Stands_Art2Rue.docx",
      "type":"reglementaire",
      "riskLevel":"HIGH"
    }
  ],
  "approvalFlow": {
    "step1": "manager_ops",
    "step2": "juridique_1",
    "reminderAfterHours": 24,
    "escalateAfterHours": 48,
    "escalateTo": "directeur_ops"
  }
}
```

## 9) Payloads de reference
### 9.1 MCP - `get_document_by_id` (input)
```json
{ "document_id": "1221462b39805e112f341674adf8d147" }
```

### 9.2 MCP - creation tache de validation (`create_task_in_project`)
```json
{
  "project_id": 66,
  "title": "Validation doc Permis_Installation_Stands_Art2Rue",
  "description": "Etape 1 manager_ops puis etape 2 juridique_1",
  "assignee_username": "manager_ops",
  "status_id": 261,
  "dueDate": "2026-05-20T16:00:00Z",
  "context": "DOC_VALIDATION"
}
```

### 9.3 MCP - transition manager vers juridique (`update_task_status` + `assign_task`)
```json
{
  "task_id": 371,
  "status_id": 262,
  "assignee_username": "juridique_1"
}
```

### 9.4 REST fallback - creation work (`POST /v1/processes/works`)
```json
{
  "title": "Validation doc Permis_Installation_Stands_Art2Rue",
  "description": "Validation sequentielle manager puis juridique",
  "projectId": 9001,
  "status": "PENDING_MANAGER",
  "dueDate": "2026-05-20T16:00:00Z",
  "attachments": [{ "id": "121d01c039805e110e39119e0dbb3806" }]
}
```

## 10) Script de demo (12 min)
1. Choisir 2 documents (1 normal, 1 sensible).
2. Simuler modification d'un document sensible.
3. Montrer creation automatique de la tache de validation (MCP).
4. Montrer passage manager -> juridique.
5. Simuler retard et montrer relance.
6. Simuler blocage et montrer escalation.

## 11) Criteres d'acceptation
- Toute modification doc critique ouvre un work de validation.
- Les transitions de statut sont conformes au circuit.
- Relance et escalation se declenchent aux seuils definis.
- Les donnees d'audit sont exploitables pour controle.

## 12) MCP eXo direct - payloads reels observes
### 12.1 `get_document_by_id` (output brut)
```json
[
  {
    "type": "text",
    "text": "{\"name\":\"Rapport_Bilan_Festival_2025_Art2Rue.docx\",\"document_id\":\"1221462b39805e112f341674adf8d147\",\"mime_type\":\"application/vnd.openxmlformats-officedocument.wordprocessingml.document\",...}"
  }
]
```

### 12.2 Champs observes en pratique
- `name`, `path`, `url`, `size`, `description`
- `document_id`, `parent_folder_id`
- `created_date`, `updated_date`
- `created_username{...}`, `last_updater_user{...}`
- `transcription` (selon type de fichier)

### 12.3 Regle de parsing
- Reponse enveloppee en `[{type,text}]`.
- `text` = JSON stringifie a parser.

## 13) Reevaluation faisabilite MCP QAUI (maj)
L'exploration directe confirme que MCP QAUI couvre bien plus que le perimetre documentaire.

### 13.1 Tools Projects/Tasks exposes (utiles au workflow)
- `list_projects`, `get_project_by_id`
- `list_tasks`, `get_task_by_id`
- `list_project_statuses`, `update_task_status`
- `add_task_comment`, `assign_task`, `create_task_in_project`

Implication:
- Une partie significative du pilotage de validation peut etre geree en MCP natif (creation tache de validation, changement de statut, commentaires, assignation), sans necessiter systematiquement l'API REST tasks.

### 13.2 Tools emails exposes
- `list_emails`, `get_email_by_id`
- Appels directs QAUI valides, exploitables pour relances ou preuves complementaires liees aux validations.

## 14) Architecture cible MCP-first / REST-fallback
### 14.1 Matrice de decisions techniques
1. Detection documents a valider:
- Priorite: MCP eXo (`search_documents`, `get_document_by_id`)
- Fallback: REST Documents

2. Creation et suivi des taches de validation:
- Priorite: MCP eXo (`create_task_in_project`, `update_task_status`, `add_task_comment`, `assign_task`, `list_tasks`)
- Fallback: REST Tasks/Processes selon besoins de gouvernance

3. Mapping acteurs et roles:
- Priorite: MCP eXo (`list_users_of_space_by_role`, `get_my_spaces`)
- Fallback: REST Social/Spaces

4. Classification / etiquetage:
- Priorite: MCP eXo (`list_project_labels`, `create_project_label`, `add_project_label_to_task`)
- Fallback: REST labels

### 14.2 Positionnement pratique
- Version "quick win": full MCP tasks + comments + statuses.
- Version "enterprise": MCP pour execution operationnelle, REST Processes pour circuits reglementaires complexes si necessaire.
