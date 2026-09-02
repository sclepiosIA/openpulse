# openrelease — pipeline de la distribution ouverte

Ce dossier contient tout ce qui transforme le dépôt privé en amont en une
distribution auto-hébergeable publiable. Le flux est **strictement
unidirectionnel** : rien n'est jamais écrit en amont.

```
dépôt privé  ──git archive──▶  snapshot inerte  ──extract──▶  arbre public  ──scan──▶  publication
   (amont)                       (lecture seule)                (ce dépôt)              (si vert)
```

## Pourquoi un pipeline et pas une copie

Une copie manuelle est irréversible et invérifiable : au premier changement de
périmètre, il faut tout refaire, et personne ne peut prouver que rien de privé
n'est passé. Ici :

- le **périmètre est un paramètre** (`--profil`), pas une décision définitive ;
- l'extraction est **reproductible** : même amont + même manifeste = même arbre ;
- chaque exclusion porte une **catégorie et un motif** vérifiables ;
- la **barrière** refuse la publication si un secret, une donnée personnelle
  réelle, une marque proscrite ou une référence d'infrastructure privée survit.

## Les fichiers de l’outillage

| Fichier | Rôle |
|---|---|
| `manifest.json` | Ce qui sort, ce qui reste, ce qui est réécrit. La seule source de vérité du périmètre. |
| `extract.mjs` | Applique le manifeste à un snapshot et produit l'arbre public. |
| `scan.mjs` | Barrière de publication. Sort en code 1 dès qu'une règle bloquante ou élevée déclenche. |
| `verifier-csp-construite.mjs` | Refuse une construction dont la politique de sécurité porte encore un marqueur non substitué. |
| `auditer-licences.mjs` | Classe les licences de l'arbre de production : permissives, réciprocité faible, réciprocité forte, non identifiées. |
| `verifier-espaces-stockage.mjs` | Vérifie que tout espace de stockage utilisé par le code est créé par le schéma. |
| `verifier-ci-portable.mjs` | Refuse un job d'intégration continue sur exécuteur privé qui ne se conditionne pas. |
| `verifier-modele-env.mjs` | Vérifie que .env.example et le registre décrivent la même instance. |
| `verifier-registre-env.mjs` | Verifie que chaque variable du registre est reellement lue la ou il le pretend. |
| `verifier-versions-images.mjs` | Compare les versions d'images citées par la documentation à celles que la composition déclare. |
| `verifier-coherence.mjs` | Détecte les réécritures partielles : un libellé de domaine présent à la fois sous un TLD de gabarit et sous un TLD réel dans le même fichier. |
| `verifier-manifeste-prive.mjs` | Vérifie que les règles à contenu sensible sont restées hors du dépôt publié. |
| `fichiers-texte.mjs` | Règle unique, partagée par `extract.mjs` et `scan.mjs` : quels fichiers sont du texte. |
| `scan-allowlist.json` | Exceptions à la barrière, étroites et justifiées. |
| `manifest-prive.json` | **Jamais versionné.** Définitions des règles dont le contenu est lui-même sensible. |

Aucune dépendance : Node 20+ seulement.

## Le fichier qui n'est pas dans le dépôt

`manifest.json` est publié **avec** la distribution. Or une règle qui dit
« remplace cette adresse IP par une autre » doit écrire cette adresse pour la
désigner. Publier le manifeste revenait donc à publier la carte de
l'infrastructure qu'il sert à masquer, ainsi que des domaines et des numéros de
téléphone d'établissements tiers. Mesuré avant correction : 7 adresses IP
publiques, 2 courriels et 7 domaines réels, tous dans les règles de réécriture.

Ces définitions vivent dans `tools/openrelease/manifest-prive.json`, couvert par
`.gitignore`. Le manifeste public n'en garde que des **jalons** : un
identifiant, une empreinte, une description neutre.

Trois conséquences pratiques, dans l'ordre d'importance :

1. **Sauvegardez ce fichier hors du dépôt.** Il n'est dans aucun clone. S'il est
   perdu, les règles qu'il porte le sont aussi, et il faut les réécrire à partir
   de l'arbre amont — un travail d'inventaire, pas une restauration.
2. **L'extraction refuse de tourner sans lui.** Si des jalons sont déclarés et
   que le fichier manque, `extract.mjs` s'arrête au lieu de produire un arbre où
   ces valeurs seraient restées en clair. C'est délibéré : un arbre incomplet
   qui se croit complet est le pire résultat possible.
3. **Un contributeur externe n'en a pas besoin.** Il ne peut pas ré-extraire
   depuis l'amont — c'est déjà le cas, l'amont étant privé — mais tout le reste
   de l'outillage fonctionne chez lui, barrière comprise.

## Utilisation

### 1. Prendre un snapshot inerte de l'amont

L'extracteur **refuse** un répertoire contenant un `.git` : lire un dépôt vivant
expose à une modification accidentelle de l'amont.

```bash
SNAP=/tmp/upstream-snapshot
mkdir -p "$SNAP"
git -C <chemin-du-depot-amont> archive HEAD | tar -x -C "$SNAP"
```

### 2. Extraire

À blanc d'abord — cela valide le manifeste sans rien écrire :

```bash
node tools/openrelease/extract.mjs \
  --upstream "$SNAP" --out /tmp/sortie \
  --profil open-core --dry-run \
  --rapport /tmp/rapport-extraction.json
```

Puis pour de vrai :

```bash
node tools/openrelease/extract.mjs \
  --upstream "$SNAP" --out . \
  --profil open-core --purge-sortie \
  --rapport .openrelease-report/extraction.json
```

`--purge-sortie` ne touche jamais `.git` ni `tools/` : le pipeline ne peut pas
s'effacer lui-même.

### 3. Passer la barrière

```bash
node tools/openrelease/scan.mjs --cible . --severite medium --tout
echo $?   # 0 = publiable, 1 = constat bloquant ou élevé, 2 = erreur d'outil
```

Ou l'enchaînement complet :

```bash
tools/openrelease/gate.sh "$SNAP"
```

## Profils

| Profil | Contenu |
|---|---|
| `open-core` | Socle générique réutilisable par n'importe quelle organisation. |
| `full` | Tout le produit sauf le strictement privé. Sert à mesurer l'écart. |

Changer de périmètre = changer `exclut_categories` dans le manifeste, pas
refaire le travail.

## Règles de tenue du manifeste

1. **Une exclusion se prouve.** Chemin vérifié, catégorie connue, motif factuel.
2. **Ne jamais décrire ici le contenu sensible d'un fichier exclu.** Le chemin et
   la catégorie suffisent. Un motif trop bavard est lui-même une fuite.
3. **Une exclusion se confronte aux imports entrants** avant d'être appliquée :
   exclure un fichier importé par du code conservé casse le build.
4. **Un motif sans correspondance est un bug**, pas un détail : l'extracteur les
   liste en fin de rapport, ils doivent être corrigés ou retirés.
5. **Une fixture qui déclenche la barrière se réécrit**, elle ne se tolère pas.
   Utiliser les domaines réservés (`example.org`, `.test`, `.invalid`) plutôt
   qu'un domaine réel.

## Resynchroniser depuis l'amont

L'amont continue d'évoluer. Pour reporter ses évolutions :

1. nouveau snapshot du HEAD amont ;
2. mettre à jour `upstream.head_extrait` dans le manifeste ;
3. `extract --dry-run` et lire les **motifs sans correspondance** : ils signalent
   les fichiers renommés ou supprimés en amont ;
4. extraction réelle, puis barrière ;
5. commit avec le SHA amont dans le message, pour que la provenance soit
   toujours traçable.

## Où vivent les règles proposées

La cartographie produit des règles de réécriture candidates. Elles atterrissent
dans `.openrelease-report/reecritures-proposees.json`, qui n'est **pas
versionné**, et sont reprises une par une dans le manifeste après vérification
du compte de fichiers touchés.

Ce n'est pas de la prudence excessive : le champ `chercher` d'une règle contient
littéralement la valeur à retirer. Le fichier a donc porté, entre autres, une
adresse IP personnelle et celle d'un accès distant. Publier la liste de ce qu'on
retire revient à publier ce qu'on retire.
