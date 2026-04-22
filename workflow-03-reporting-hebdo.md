# Workflow 03 - Reporting hebdomadaire automatise

## 1) Objectif
Produire chaque semaine un rapport projet consolide (activite documentaire, taches, retards, recommandations) et le diffuser automatiquement.

## 2) Contexte metier et storytelling
Chaque lundi, la direction veut une vision fiable de l'etat du projet festival:
- combien de taches en retard
- quels dossiers de validation sont bloques
- quelle activite documentaire a eu lieu
- quelles actions lancer cette semaine

Actuellement, le reporting est artisanal (copier/coller de plusieurs ecrans). La demo simule le lundi 08:30:
- le workflow collecte les indicateurs
- consolide en un objet unique
- genere une synthese lisible
- diffuse a la direction et aux leads

## 3) Ce qu'on cherche a demontrer
1. Consolidation multi-sources sans intervention manuelle.
2. Production d'un rapport coherent chaque semaine.
3. Detection automatique des points de friction.
4. Version IA (narrative et recommandations) et version sans IA (KPI stricts).

## 4) Faisabilite MCP eXo QAUI
### Tools MCP eXo identifies (direct MCP)
- `get_my_spaces`
- `search_documents`
- `get_document_by_id`
- `list_projects`
- `get_project_by_id`
- `list_tasks`
- `list_assigned_tasks`
- `list_project_statuses`
- `list_emails`
- `get_email_by_id`
- `add_project_label_to_task`

### Conclusion pour ce workflow
- MCP couvre la majorite des KPI utiles (projets, taches, documents, emails).
- Le workflow de reporting peut etre execute en mode nominal MCP-first.
- REST reste une option fallback pour des KPI non exposes en MCP ou des besoins analytiques specifiques.

## 5) Endpoints / tools cibles
### 5.1 MCP eXo (primaire)
- `get_my_spaces`
- `list_projects`
- `get_project_by_id`
- `list_tasks`
- `list_assigned_tasks`
- `list_project_statuses`
- `search_documents`
- `get_document_by_id`
- `list_emails`
- `get_email_by_id`

### 5.2 REST eXo (fallback cible)
Base URL REST: `https://<exo-host>/portal/rest`
- `GET /projects/project/statistics/{id}`
- `GET /tasks/filter`
- `GET /tasks/project/{id}`
- `GET /v1/processes/countWorks/{projectId}?isCompleted=true|false`
- `GET /v1/documents?ownerId=...&afterDate=...&beforeDate=...`

## 6) Sequence detaillee
1. Trigger planifie: lundi 08:30.
2. Resolution espace via MCP `get_my_spaces`.
3. Collecte KPI projets via MCP (`list_projects`, `get_project_by_id`).
4. Collecte KPI taches via MCP (`list_tasks`, `list_assigned_tasks`, `list_project_statuses`).
5. Collecte KPI documents via MCP (`search_documents`, `get_document_by_id`).
6. Collecte KPI emails internes eXo via MCP (`list_emails`, `get_email_by_id`).
7. Consolidation dans un objet de reporting.
8. Option IA: synthese narrative et recommandations.
9. Diffusion (email/space) + archivage historique.
10. Si un KPI manque cote MCP: fallback REST uniquement pour la metrique manquante.

## 7) Avec IA vs sans IA
### Avec IA
- Resume executif lisible direction.
- Priorisation des alertes.
- Recommandations d'actions pour la semaine.

### Sans IA
- Tableau KPI + seuils + alertes reglees.
- Aucune generation de texte libre.

## 8) Story-driven dataset (base demo)
```json
{
  "storyContext": {
    "event": "Festival Art2Rue",
    "week": "2026-W21",
    "committee": "COPIL lundi 09:00"
  },
  "scope": {
    "space_id": 66,
    "projectId": 9001,
    "periodStart": "2026-05-18T00:00:00Z",
    "periodEnd": "2026-05-24T23:59:59Z"
  },
  "baselineKpis": {
    "tasksTotal": 42,
    "tasksCompleted": 21,
    "tasksOverdue": 7,
    "worksCompleted": 9,
    "worksPending": 6,
    "documentsUpdated": 18
  },
  "thresholds": {
    "overdueCritical": 5,
    "blockedValidationHours": 48,
    "minCompletionRate": 0.6
  }
}
```

## 9) Payloads de reference
### 9.1 MCP - `search_documents` (input)
```json
{ "query": "", "space_id": 66, "limit": 200, "offset": 0 }
```

### 9.2 MCP - `list_tasks` (input)
```json
{
  "project_id": 66,
  "status_id": 261,
  "offset": 0,
  "limit": 200
}
```

### 9.3 MCP - `list_emails` (input)
```json
{
  "limit": 100,
  "offset": 0
}
```

### 9.4 Rapport final (sortie cible)
```json
{
  "period": "2026-W21",
  "projectId": 9001,
  "kpis": {
    "tasksTotal": 42,
    "tasksCompleted": 21,
    "tasksOverdue": 7,
    "worksCompleted": 9,
    "worksPending": 6,
    "documentsUpdated": 18
  },
  "alerts": [
    "7 taches en retard (seuil 5 depasse)",
    "3 validations bloquees depuis >48h"
  ],
  "recommendations": [
    "Reallouer 1 ressource sur validation reglementaire",
    "Traiter les taches HIGH avant mercredi 12:00"
  ]
}
```

## 10) Script de demo (8-10 min)
1. Lancer le workflow hebdo manuellement.
2. Montrer collecte full MCP (projets + taches + docs + emails).
3. Afficher l'objet consolide KPI.
4. Afficher la synthese (mode IA) puis comparaison sans IA.
5. Montrer diffusion automatique du rapport.

## 11) Criteres d'acceptation
- Rapport genere dans le delai cible (<5 min en demo).
- KPI coherents et verifiables.
- Alertes declenchees uniquement selon seuils.
- Historique du rapport archive pour comparaison hebdo.

## 12) MCP eXo direct - payloads reels observes
### 12.1 `search_documents` (output brut)
```json
[
  {
    "type": "text",
    "text": "[{\"name\":\"Intégration de l'IA dans EXO _ Cas d'usage et démonstration 🤖.mp4\",\"document_id\":\"af11e83239805e1132c0177bbfc4f64f\",\"updated_date\":\"2026-04-22T05:38:03.376+02:00\",...}]"
  }
]
```

### 12.2 Regle de parsing
- Reponse enveloppee en `[{type,text}]`.
- `text` contient une string JSON a parser avant aggregation.

## 13) Reevaluation faisabilite MCP QAUI (maj)
### 13.1 Couverture MCP plus large confirmee
Au-dela des documents, MCP QAUI expose des families entieres:
- Projects: `list_projects`, `get_project_by_id`
- Tasks: `list_tasks`, `list_assigned_tasks`, `list_project_statuses`, `list_project_labels`
- Users/Spaces: `list_users_of_space_by_role`, `get_my_spaces`
- Emails: `list_emails`, `get_email_by_id` (catalogue present)

### 13.2 Impact sur le reporting
- Les KPI taches peuvent etre recuperes directement via MCP tasks (sans passer integralement par REST), selon vos choix d'architecture.
- Les KPI emails sont maintenant recuperables en direct via MCP email natif eXo (`list_emails`, `get_email_by_id`) sur QAUI.

## 14) Architecture cible MCP-first / REST-fallback
### 14.1 Matrice de decisions techniques
1. KPI projets:
- Priorite: MCP eXo (`list_projects`, `get_project_by_id`)
- Fallback: REST Projects stats

2. KPI taches:
- Priorite: MCP eXo (`list_tasks`, `list_assigned_tasks`, `list_project_statuses`, `list_project_activity_since`)
- Fallback: REST Tasks filter/statistics

3. KPI activites sociales:
- Priorite: MCP eXo (`get_activities_since_days`, `get_news_list`)
- Fallback: REST Social/News

4. KPI documents:
- Priorite: MCP eXo (`search_documents`, `get_document_by_id`)
- Fallback: REST Documents

5. KPI emails internes eXo:
- Priorite: MCP eXo (`list_emails`, `get_email_by_id`)
- Fallback: IMAP/Gmail externe

### 14.2 Consequence pour le POC
Le reporting hebdo peut etre execute en majorite en MCP natif eXo, avec REST uniquement en filet de securite ou pour besoins analytiques specifiques non exposes.
