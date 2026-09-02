# Licences des dépendances

Audit de l'arbre de **production** — ce qui part réellement dans la
distribution. Les outils de développement ne sont pas jugés : ils n'imposent
rien à qui adopte le produit.

Rejouer l'audit :

```bash
node tools/openrelease/auditer-licences.mjs .
```

## Ce que l'audit mesure, au 2026-08-24

| Classe                                                  | Paquets |
| ------------------------------------------------------- | ------- |
| Permissives (MIT, ISC, Apache-2.0, BSD, 0BSD, BlueOak…) | 1 135   |
| Réciprocité faible (MPL-2.0)                            | 16      |
| Réciprocité forte                                       | **0**   |
| Non identifiées                                         | **0**   |

Total : 1 151 paquets.

Ces chiffres sont vérifiés par `tools/openrelease/verifier-notice-licences.mjs`,
qui rejoue l'audit et refuse de les laisser diverger de `NOTICE`. Ce document
avait déjà dérivé une fois : il a annoncé pendant trois jours une contamination
GPL levée entre-temps, et un lecteur qui l'aurait cru aurait refusé le dépôt sur
la foi de ses propres papiers.

## Trois arbitrages, et ce qui a été décidé

Ces trois points n'étaient pas des défauts techniques : c'étaient des
arbitrages, et ils appartenaient à qui publie. Ils ont été tranchés en retirant
la dépendance à chaque fois — la seule issue qui ne transmette aucune contrainte
à l'adoptant. Le raisonnement est conservé ici : ce qui a été écarté vaut d'être
lu avant de réintroduire l'une de ces bibliothèques.

### 1. `hyperformula@3.3.0` — GPL-3.0-only → **retiré**

Le moteur de formules du module tableur, dépendance **directe**, déclarait
`licenseKey: 'gpl-v3'` sans ambiguïté. La GPL-3.0 impose sa réciprocité à
l'œuvre qui l'incorpore : distribuer sous MIT un produit qui l'embarque n'était
pas tenable, et la mention « licence MIT » de l'écran de connexion devenait
fausse.

Quatre issues avaient été examinées : remplacer par un moteur permissif,
acquérir la licence commerciale, isoler le module derrière une dépendance
facultative, ou publier l'ensemble sous GPL-3.0. Les trois dernières
transmettaient la contrainte à l'adoptant.

**Décision : moteur réécrit dans le dépôt**, sous la licence du dépôt —
`src/components/documents/power/formulaEngine.ts`. Les remplaçants sous licence
permissive ont d'abord été examinés puis écartés : `fast-formula-parser` est en
MIT mais tire `jstat`, dont le paquet ne déclare aucune licence — le problème
aurait changé de nom, pas disparu. Le moteur maison couvre une soixantaine de
fonctions au lieu des ~400 de HyperFormula, et rend `#NOM?` sur une fonction
inconnue plutôt que d'échouer silencieusement.

### 2. `react-leaflet@4.2.1` et `@react-leaflet/core@2.1.0` — Hippocratic-2.1 → **retirés**

La licence Hippocratic ajoute des restrictions d'usage à visée éthique. Elle
n'est **pas approuvée par l'OSI** et ne répond pas à la définition de l'open
source, qui interdit toute discrimination sur les domaines d'application.

`leaflet` lui-même est en BSD-2 : c'était le liant React, et lui seul, qui
posait problème.

**Décision : bascule sur `maplibre-gl` (BSD-3)**, déjà présent dans l'arbre et
déjà utilisé par `src/components/pipeline/Map.tsx` —
`src/components/calendrier/LocationMapInner.tsx`. Le dépôt portait deux
bibliothèques de cartes pour deux écrans ; celle qui reste est aussi celle dont
la licence convient.

### 3. Deux paquets sans licence déclarée → **retirés de l'arbre de production**

- **`@qonto/embed-sdk@0.69.0`** — kit d'intégration bancaire, aucune licence
  dans ses métadonnées ni fichier de licence. Sans déclaration, le droit
  d'auteur s'applique par défaut : tous droits réservés. **Retiré de
  `package.json`.**
- **`@mapbox/jsonlint-lines-primitives@2.0.2`** — dépendance transitive de la
  chaîne cartographique, entrée avec `react-leaflet`. Elle ne figure plus dans
  l'arbre de production : il n'en reste qu'une contrainte de version dans le
  bloc `overrides` de `package.json`, que l'auditeur ne compte pas, et à juste
  titre — un `override` ne fait entrer aucun paquet, il borne ceux qui entrent.

## Réciprocité faible : à mentionner, pas à corriger

Quatorze paquets sont sous MPL-2.0 : `@capgo/capacitor-updater`, `ico-endec`, et
les douze variantes de plateforme de `lightningcss`. La MPL n'impose sa
réciprocité qu'aux fichiers qu'elle couvre, pas à l'œuvre qui les utilise :
les embarquer est sans conséquence pour l'adoptant, à condition de les citer.
C'est fait dans `NOTICE`.
