# Contribuer

## État actuel

Le dépôt n'est **pas encore ouvert aux contributions externes**. Le chantier
d'ouverture ([CHANTIER.md](CHANTIER.md)) doit d'abord aboutir : tant que le
schéma de base n'est pas reproductible et que l'installation n'est pas prouvée
sur une machine vierge, un contributeur externe ne peut même pas faire tourner
le projet.

Cette page décrit les règles qui s'appliqueront, et celles qui s'appliquent dès
maintenant à quiconque travaille sur ce dépôt.

## Règles du dépôt

### Le dépôt est en aval, pas en amont

Le code applicatif est produit par extraction depuis un dépôt privé. Une
modification apportée directement ici sera **écrasée à la prochaine
resynchronisation**, sauf si elle porte sur :

- `tools/openrelease/**` — le pipeline lui-même ;
- les fichiers de gouvernance à la racine (`README`, `CHANTIER`, `LICENSE`,
  `NOTICE`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`).

Tout le reste se corrige **en amont**, puis se resynchronise. Ce n'est pas une
préférence de style : c'est ce qui garantit qu'une correction ne se perde pas et
que les deux versions ne divergent pas.

Cette contrainte disparaîtra quand ce dépôt deviendra le dépôt de référence du
projet. C'est l'objet du dernier lot du chantier.

### La barrière de publication ne se contourne pas

Avant tout commit :

```bash
tools/openrelease/gate.sh
```

Si elle est rouge, on corrige la cause. On ne désactive pas la règle, on
n'ajoute pas d'exception large, on ne pousse pas avec `--no-verify`.

Une exception à la barrière est acceptable seulement si elle est **étroite**
(un chemin précis, un extrait précis) et **justifiée** dans
`tools/openrelease/scan-allowlist.json`.

### Pas de secret dans le dépôt, jamais

Aucune clé, aucun jeton, aucun mot de passe, aucune chaîne de connexion, même
expirée, même de test, même en commentaire. Les valeurs d'exemple vont dans les
fichiers `.env.example`, sous forme de gabarits sans valeur réelle.

### Pas de donnée réelle dans les fixtures

Les jeux de test utilisent des données fictives et des domaines réservés
(`example.org`, `example.com`, `.test`, `.invalid`). Un nom d'organisation
réelle, une adresse de messagerie réelle ou un numéro de téléphone réel dans un
test est un incident, pas un détail.

### Rien ne se supprime

Un contenu remplacé est archivé ou versionné à côté. Le pipeline ne supprime
jamais rien en amont, et l'exclusion du périmètre public ne retire rien de
l'amont.

## Langue

Le code, les commentaires et la documentation sont en français, comme le projet
d'origine. Le choix d'une langue de travail pour la version publique, et
l'internationalisation de l'interface, font partie du chantier et ne sont pas
tranchés.

## Attestation d'origine des contributions

Ce dépôt retient le *Developer Certificate of Origin* (fichier `DCO`), pas un
accord de cession de droits. La différence compte : le DCO n'exige aucune
signature de contrat ni cession, il demande seulement d'attester que vous avez
le droit de proposer ce que vous proposez. C'est le mécanisme le plus léger qui
protège réellement les adoptants en aval — eux ont besoin de savoir que le code
qu'ils reprennent leur est cédé sans réserve.

Concrètement, chaque commit porte une ligne de fin :

```
Signed-off-by: Prénom Nom <adresse@example.org>
```

que `git` ajoute seul avec `-s` :

```bash
git commit -s -m "votre message"
```

Le nom et l'adresse doivent être ceux sous lesquels vous répondez, pas un
pseudonyme jetable : l'attestation ne vaut que si elle est traçable. En signant,
vous certifiez les points (a) à (d) du fichier `DCO` — pour l'essentiel, que le
code est de vous, ou qu'il vient d'une source dont la licence vous permet de le
reverser ici.

Aucune contribution n'est refusée pour une signature oubliée : il suffit de
rejouer le commit avec `git commit --amend -s`.

## Signalement de vulnérabilité

Voir [SECURITY.md](SECURITY.md). Ne pas ouvrir de ticket public pour une
vulnérabilité.
