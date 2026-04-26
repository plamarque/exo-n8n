# Workflow 04 - Spécification technique

> Contexte produit : [`SPEC.functional.md`](SPEC.functional.md). Export secondaire (diff serveur) : [`fixtures/workflow.export.snapshot.json`](fixtures/workflow.export.snapshot.json).

## 1) Faisabilite MCP eXo QAUI

### Tools MCP utilises dans le workflow reel

- `get_my_spaces`
- `search_documents`
- `get_document_by_id`
- `get_category_tree`
- `update_document_description`
- `add_content_to_category`

### Conclusion

Le workflow est deja **MCP-first natif** et ne depend pas de fallback REST dans sa version actuelle.

## 2) Parametrage et prerequis

### 2.1 Variables / entrees

- `EXO_SPACE_NAME` (via `$vars.EXO_SPACE_NAME`) obligatoire

### 2.2 Connectivite

- Endpoint MCP: `https://exo-qaui.meeds.io/mcp-server/mcp` (valeur observee dans la spec d’origine ; aligner sur l’environnement cible)
- Auth n8n: `mcpOAuth2Api`

### 2.3 IA

- Modele: `gpt-4o-mini`
- Temperature: `0.3`
- Output parser structure: `{ description, suggestedCategories[] }`

## 3) Sequence detaillee (reverse engineered)

1. Trigger:
- `Manual Start` ou `Daily Schedule` (heure 02:00).

2. Input & validation:
- `Workflow Input` injecte `spaceName={{$vars.EXO_SPACE_NAME}}`.
- `Validate Input` leve une erreur si `spaceName` est vide.

3. Tracking store:
- `Ensure Tracking Table` cree `exo_processed_documents` si absent.

4. Resolution espace:
- `Get Spaces` (MCP `get_my_spaces`).
- `Resolve Space` mappe `spaceName -> spaceId` (erreur si introuvable).

5. Extraction documents:
- `List Documents` (MCP `search_documents`, limit 500).
- `Normalize Documents` extrait `{id, updatedDate, description}`.

6. Filtrage incremental:
- `Get Processed For Doc` lit tracking pour les IDs en lot.
- `Filter Documents to Process` conserve docs nouveaux/modifies.
- `Limit to 5 Documents` plafonne le batch.

7. Traitement par document:
- `Process Each Document` (Split in Batches).
- `Read Document Content` (MCP `get_document_by_id`).
- `List Categories` (MCP `get_category_tree`).
- `Prepare AI Input` construit payload prompt + categorie disponibles.

8. Enrichissement IA:
- `Analyze Document` (agent) + `GPT-4o Mini Model` + `Structured Output`.
- Sortie attendue: description <= 30 mots + 2-3 categories.

9. Ecriture metadonnees:
- `Extract Results` normalise sortie.
- `Add Description` (MCP `update_document_description`).
- `Check Description Result` stoppe si exception detectee.

10. Classification categories:
- `Prepare Category Assignments` mappe noms -> `category_id`.
- `Assign Categories` (MCP `add_content_to_category`).
- `Check Assign Result` stoppe si exception detectee.

11. Persistence de suivi:
- `Update Tracking` upsert dans `exo_processed_documents`.
- Colonnes: `documentId,lastProcessedDate,description,categories,spaceName,documentName,documentUrl,editorUrl`.

12. Sortie:
- `Processing Summary` retourne message + `processedCount` + timestamp.

## 4) Structure de donnees cle

### 4.1 Table de tracking

- Nom: `exo_processed_documents`
- Role: idempotence et reprise incremental

### 4.2 Output IA cible

```json
{
  "description": "Description concise (<=30 mots)",
  "suggestedCategories": ["Category1", "Category2"]
}
```

## 5) Points forts techniques observes

- Incremental processing solide (comparaison `updatedDate` vs `lastProcessedDate`).
- Checkpoints explicites d'erreur apres ecriture description et categories.
- Pipeline strictement structure autour de MCP + DataTable n8n.

## 6) Script de demo (reverse engineered)

1. Definir `EXO_SPACE_NAME`.
2. Lancer `Manual Start`.
3. Montrer docs identifies et ceux filtres comme deja traites.
4. Montrer resultat IA structure.
5. Verifier description + categories sur document eXo.
6. Verifier la ligne upsert dans `exo_processed_documents`.

## 7) Artefacts exportes

- Canonique (repo) : `workflows/wf04-document-enrichment-ai/workflow.json` (ex-import n8n).
- Snapshot full export (diff) : `fixtures/workflow.export.snapshot.json`.

## 8) Evolutions recommandees

1. Externaliser endpoint MCP dans variable n8n.
2. Ajouter fallback gracieux si `EXO_SPACE_NAME` absent (default configurable).
3. Ajouter retry/queue sur erreurs MCP transitoires.
4. Ajouter instrumentation de qualite IA (confidence score, audit prompt/output).

## 9) Statut

Reverse engineering effectue a partir du workflow n8n ID `aze2wAktXHYrTBTr`, nomme `eXo Document Enrichment with AI`, recupere via MCP le 22 avril 2026.
