# Politique de sécurité

## Portée

Cette politique couvre le code de cette distribution. Elle ne couvre pas les
instances exploitées par des tiers : la sécurité d'une instance relève de
l'organisation qui l'héberge.

## Deux choses différentes, deux destinataires

Une confusion coûterait du temps à qui signale, et c'est le moment où l'on en a
le moins :

| Ce que vous avez trouvé | À qui l'écrire |
|---|---|
| Un défaut **dans le code** de la distribution, qui touche toutes les instances | à l'équipe du projet, ci-dessous |
| Un défaut **sur une instance** que vous utilisez — mauvaise configuration, données exposées | à l'organisation qui l'exploite, dont l'adresse figure dans son `/.well-known/security.txt` |

Le fichier `public/security.txt` livré avec la distribution porte des adresses
de gabarit (`securite@exploitant.example.org`) : chaque exploitant y met les
siennes à l'installation. Elles ne mènent nulle part telles quelles, et c'est
voulu — une adresse par défaut qui fonctionne enverrait à l'éditeur des
signalements qui ne le concernent pas.

## Signaler une vulnérabilité dans le code

**Ne pas ouvrir de ticket public.**

> **Contact de signalement : [contact@sclepios-ia.com](mailto:contact@sclepios-ia.com).**
>
> Cette adresse est relevée par l'équipe du projet.
> `tools/openrelease/verifier-pret-a-publier.mjs` vérifie qu'un dépôt public
> fournit un canal de signalement réellement joignable : une politique de
> sécurité qui renvoie dans le vide est pire que pas de politique du tout,
> car elle laisse croire qu'un signalement a été reçu.

Engagements :

| Étape | Délai |
|---|---|
| Accusé de réception | 5 jours ouvrés |
| Première évaluation | 10 jours ouvrés |
| Correctif ou plan de correction | selon la gravité |

Le délai d'accusé de réception est aligné sur celui qu'annonce
`public/security.txt`. Les deux documents disaient 3 et 5 jours ; celui qui est
tenable est celui qui est affiché.

## Versions suivies

La distribution suit la version déclarée dans `package.json`. Seule la dernière
version publiée reçoit des correctifs de sécurité ; il n'y a pas de branche de
maintenance parallèle.

## Ce que nous demandons

- Laissez-nous un délai raisonnable avant toute divulgation publique.
- N'accédez pas à des données qui ne vous appartiennent pas, ne dégradez pas un
  service, ne testez que sur vos propres instances.
- Pas de test de déni de service, pas d'ingénierie sociale.

## Défauts sûrs

La distribution doit livrer des valeurs par défaut sûres : authentification
forte exigée là où elle protège un accès sensible, aucune origine ouverte à
tous, aucune fonction exposée publiquement avec un accès privilégié à la base,
aucun compte de démonstration exploitable sur une instance fraîchement
installée.

Ces invariants sont contrôlés à chaque commit par la barrière de publication
(`tools/openrelease/scan.mjs`) et par les neuf contrôles que lance
`tools/openrelease/gate.sh`. Ce qu'ils ne couvrent pas encore est nommé dans le
[chantier](CHANTIER.md) plutôt que passé sous silence.
