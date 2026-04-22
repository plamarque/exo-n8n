# Workflow 03 - Preparation automatisee du copil hebdomadaire

## 1) Objectif
Automatiser la preparation du comite de pilotage hebdomadaire en generant a l'avance:
- une note de reunion pre-initialisee a partir d'un template
- un rapport tabulaire d'avancement insere dans cette note
- une invitation agenda recurrente pointant vers la note de la semaine

Le workflow doit reduire la preparation manuelle du copil, fiabiliser le support de reunion et donner a chaque participant la meme base d'information avant la seance.

## 2) Contexte metier et storytelling
Chaque semaine, l'equipe projet tient un comite de pilotage sur un creneau fixe. Aujourd'hui, la preparation de cette reunion est artisanale:
- quelqu'un du projet cree la note de reunion a la main
- le titre est saisi manuellement
- l'ordre du jour est repris d'une semaine a l'autre par copier/coller
- l'etat d'avancement est reconstruit en relisant les taches une a une
- le lien vers le bon document n'est pas toujours partage au bon moment

Le besoin metier est d'industrialiser cette routine sans changer les habitudes de l'equipe:
1. Une note de copil est creee automatiquement chaque semaine a partir d'un modele.
2. Le titre de la note integre la date de la reunion.
3. Le corps de la note contient deja la structure attendue pour la prise de notes.
4. Un tableau d'avancement alimente depuis les taches projet est insere avant la reunion.
5. Une invitation agenda recurrente est creee ou maintenue sur le creneau defini.
6. La description de l'invitation contient le lien vers la note de la semaine, afin que chacun puisse la consulter en amont.

La valeur de la demo est de montrer que le workflow ne se contente pas de produire un reporting, mais prepare concretement la reunion de gouvernance dans l'outillage quotidien de l'equipe.

## 3) Ce qu'on cherche a demontrer
1. Preparation proactive d'un rituel hebdomadaire de pilotage.
2. Reutilisation d'un template de note comme standard d'equipe.
3. Consolidation automatique des informations projet dans un support exploitable.
4. Synchronisation entre notes, taches et agenda dans un seul workflow.
5. Diffusion simple du bon lien au bon moment, sans manipulation manuelle.

## 4) Acteurs
### 4.1 Equipe projet
- Prepare et anime le copil.
- Consulte la note avant la reunion.
- Complete la note pendant la reunion.

### 4.2 Animateur du copil
- Est proprietaire du rituel de reunion.
- Decide du template a utiliser.
- Verifie que l'ordre du jour et les rubriques sont conformes au format attendu.

### 4.3 Participants au copil
- Recoivent l'invitation agenda recurrente.
- Ouvrent la note via le lien present dans la description.
- Arrivent en seance avec le rapport d'avancement deja visible.

Liste recurrente des participants a inviter:
- `claire`
- `etienne`
- `louis`
- `nadia`
- `antoine`
- `emma`

## 5) Objet fonctionnel du workflow
Le workflow prepare automatiquement trois objets relies entre eux:

### 5.1 Une note hebdomadaire de copil
La note est creee dans l'application Notes a partir d'une note modele ou d'un template equivalent.

Reference metier figee pour ce workflow:
- espace cible: `Festival Art2Rue`
- note template source: `784`
- note parente de rangement des comptes rendus generes: `693`
- projet de reference pour le rapport d'avancement global: `66`

Elle doit contenir au minimum:
- un titre normalise incluant la date
- les sections standards de la reunion
- une zone "rapport d'avancement" pre-remplie
- une zone "decisions / arbitrages"
- une zone "actions / prochains pas"

### 5.2 Un rapport tabulaire d'avancement
Le rapport est construit a partir des taches retenues dans le perimetre du projet `66`.

Il doit permettre une lecture rapide, au minimum avec:
- identifiant ou titre de la tache
- responsable
- statut
- echeance
- niveau de priorite ou d'attention
- commentaire ou point de blocage si disponible

Le tableau est destine a etre lu avant la reunion et complete oralement pendant le copil.

### 5.3 Une invitation agenda recurrente
Une invitation de reunion est positionnee chaque semaine sur le meme creneau.

Elle doit comporter:
- le titre de la reunion
- la date et l'heure du creneau
- la recurrence hebdomadaire
- la liste des participants habituels:
  `claire`, `etienne`, `louis`, `nadia`, `antoine`, `emma`
- dans la description, le lien vers la note de la semaine preparee

## 6) Declenchement et cadence
Le scenario cible est hebdomadaire.

Exemple de logique metier attendue:
1. Le workflow s'execute avant le copil, sur un jour et une heure definis a l'avance.
2. Il prepare la note correspondant a la prochaine occurrence de reunion.
3. Il met a disposition le lien vers cette note avant l'envoi ou la mise a jour de l'invitation agenda.

Le point important cote fonctionnel est que la preparation se fasse suffisamment tot pour que les participants puissent lire le support avant la reunion.

## 7) Sequence fonctionnelle detaillee
1. Le workflow identifie le prochain copil a preparer.
2. Il determine la date a afficher dans le titre de la note.
3. Il recupere le template de note de reference.
4. Il cree une nouvelle note hebdomadaire a partir de ce template.
5. Il cree cette note comme note fille de la note `693`, qui sert de conteneur des comptes rendus.
6. Il renomme la note selon la convention de nommage definie.
7. Il collecte les taches pertinentes pour le copil de la semaine.
8. Il construit un rapport tabulaire d'avancement a partir de ces taches.
9. Il insere ce tableau dans la section prevue de la note.
10. Il complete au besoin les rubriques standard deja presentes dans le template:
- ordre du jour
- avancement
- points de blocage
- decisions
- actions
11. Il cree l'invitation agenda recurrente si elle n'existe pas encore, ou la met a jour si elle existe deja.
12. Il injecte dans la description de l'invitation le lien vers la note de la semaine.
13. Les participants disposent alors d'une invitation a jour et d'un support de reunion deja prepare.

## 8) Regles de gestion
### 8.1 Regles sur la note
1. Une seule note de copil doit exister par occurrence de reunion.
2. Le titre doit etre explicite et date, par exemple: `COPIL Projet X - 2026-04-27`.
3. La note hebdomadaire doit toujours etre creee a partir du meme template de reference.
4. La structure du template ne doit pas etre perdue lors de l'initialisation.
5. Le rapport d'avancement doit etre insere dans une section clairement identifiee.
6. Les notes generees doivent etre creees comme filles de la note `693`.
7. Le template de reference de ce workflow est la note `784`.

### 8.2 Regles sur le rapport tabulaire
1. Le rapport ne doit presenter que les taches dans le perimetre retenu pour le copil.
Le perimetre de reference retenu pour ce workflow est le projet `66`.
2. Les taches doivent etre lisibles sous forme de tableau exploitable en reunion.
3. Le contenu du tableau doit refleter un etat "a date de preparation".
4. Le rapport doit privilegier les elements utiles au pilotage:
- retards
- blocages
- priorites
- actions en cours
5. Le rapport est un support de lecture; il ne remplace pas la discussion en reunion.

### 8.3 Regles sur l'invitation agenda
1. La recurrence est hebdomadaire sur un creneau fixe.
2. La reunion conserve la meme identite d'une semaine a l'autre.
3. La description de l'invitation doit toujours pointer vers la note correspondant a la bonne semaine.
4. Si la note de la semaine est regeneree ou mise a jour, le lien dans l'invitation doit rester coherent.

## 9) Format fonctionnel attendu de la note
Exemple de structure cible:

```markdown
# COPIL Projet X - 2026-04-27

## Ordre du jour
- Avancement global
- Points de blocage
- Decisions attendues
- Prochaines echeances

## Rapport d'avancement
[tableau insere automatiquement]

## Points a discuter

## Decisions

## Actions et responsables
```

Le contenu exact du template pourra etre ajuste, mais le principe fonctionnel est qu'il existe un modele stable et reutilisable.

## 10) Donnees fonctionnelles de reference
### 10.1 Entrees attendues
- un template de note de copil: note `784`
- une note parente de rangement des comptes rendus: note `693`
- un perimetre de taches a analyser: projet `66`
- un creneau hebdomadaire de reunion
- une liste de participants recurrente:
  `claire`, `etienne`, `louis`, `nadia`, `antoine`, `emma`
- une convention de nommage de la note

### 10.2 Sorties attendues
- une note de copil creee pour la semaine cible
- un tableau d'avancement insere dans cette note
- une invitation agenda creee ou mise a jour avec le lien vers la note

## 11) Cas d'usage metier couvert
### 11.1 Cas nominal
Le workflow prepare la reunion de la semaine sans intervention manuelle:
- la note est creee
- le tableau est insere
- l'invitation pointe vers le bon support

### 11.2 Cas de mise a jour hebdomadaire
Le meme rituel se repete chaque semaine sur la meme base:
- meme template
- meme creneau
- nouvelle date
- nouveau tableau d'avancement

### 11.3 Cas de consultation avant reunion
Les participants recoivent ou retrouvent l'invitation du copil, ouvrent la description, cliquent sur le lien vers la note de la semaine et lisent le support avant la seance.

## 12) Exceptions et points d'attention fonctionnels
1. Si le template de note est introuvable, la preparation du copil ne doit pas produire une note incomplete sans signalement.
2. Si aucune tache n'est trouvee, la note doit rester exploitable avec une section d'avancement vide ou explicitement indiquee comme telle.
3. Si l'invitation agenda existe deja, il faut eviter de creer des doublons.
4. Si une note existe deja pour la meme date, il faut privilegier la mise a jour ou la reutilisation plutot qu'une recreation aveugle.
5. La note doit rester editable par l'equipe pendant et apres la reunion.
6. Si la note parente `693` est inaccessible, le workflow ne doit pas creer la note de copil a un autre emplacement sans validation explicite.
7. Si le template `784` change de structure, l'insertion du rapport doit continuer a viser la section prevue pour l'avancement.
8. Si le projet `66` n'est pas accessible au moment de la preparation, le workflow ne doit pas produire un faux rapport d'avancement silencieux.

## 13) Benefices metier attendus
1. Gain de temps de preparation du copil.
2. Standardisation du compte rendu hebdomadaire.
3. Meilleure lecture de l'avancement reel avant la reunion.
4. Reduction des oublis de partage du bon document.
5. Meilleure discipline collective sur les rituels de pilotage.

## 14) Criteres d'acceptation fonctionnels
1. A chaque occurrence hebdomadaire, une note de copil est disponible avant la reunion.
2. La note est creee sur la base du template `784` defini par l'equipe.
3. La note creee est rangee comme fille de la note `693`.
4. Le titre de la note contient la date de la reunion.
5. Le rapport d'avancement est insere sous forme tabulaire dans la note a partir des taches du projet `66`.
6. L'invitation agenda hebdomadaire existe et conserve le bon creneau.
7. La description de l'invitation contient le lien vers la note de la semaine.
8. Le support obtenu est lisible en amont puis exploitable pendant la reunion pour la prise de notes.
9. L'invitation contient bien les participants `claire`, `etienne`, `louis`, `nadia`, `antoine` et `emma`.

## 15) Perimetre de cette story
Cette story couvre uniquement la specification fonctionnelle du workflow:
- creation de la note
- initialisation depuis un template
- insertion du rapport d'avancement
- liaison avec l'invitation agenda

La specification technique (sources exactes, mecanismes d'orchestration, connecteurs, mapping de champs, gestion des erreurs techniques) sera detaillee dans un second temps.
