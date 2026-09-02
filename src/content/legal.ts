/**
 * Contenu légal publié par l'instance OpenPulse — servi sur /mentions-legales
 * et /politique-confidentialite.
 *
 * OpenPulse est une distribution auto-hébergeable : ce fichier ne décrit AUCUNE
 * organisation particulière. L'organisation qui exploite l'instance renseigne
 * les deux blocs ci-dessous, puis relit l'intégralité des deux documents avant
 * mise en service. Les valeurs livrées sont des gabarits volontairement
 * inexploitables (mentions en capitales, domaines réservés à la documentation
 * au sens de la RFC 2606) : elles doivent sauter aux yeux en relecture.
 *
 * Contrat technique à préserver si ce fichier est modifié :
 *  - trois exports, tous de type `string` : LEGAL_LAST_UPDATED,
 *    MENTIONS_LEGALES_MD, POLITIQUE_CONFIDENTIALITE_MD ;
 *  - consommés par src/pages/MentionsLegales.tsx (ligne 4) et
 *    src/pages/PolitiqueConfidentialite.tsx (ligne 4) ;
 *  - rendus par `react-markdown` + `remark-gfm` : les tableaux GFM sont
 *    disponibles, le HTML brut ne l'est pas ;
 *  - src/content/legal.test.ts vérifie la présence des rubriques, pas leur
 *    contenu : remplir les blocs ne casse aucun test.
 */

/** Bloc IDENTITÉ — à renseigner par l'organisation qui exploite l'instance. */
const ORGANISATION = {
  denomination: 'ORGANISATION À RENSEIGNER',
  formeJuridique: 'FORME JURIDIQUE À RENSEIGNER',
  capital: 'CAPITAL SOCIAL À RENSEIGNER',
  siege: 'ADRESSE DU SIÈGE À RENSEIGNER',
  immatriculation: 'NUMÉRO D’IMMATRICULATION À RENSEIGNER',
  tva: 'NUMÉRO DE TVA INTRACOMMUNAUTAIRE À RENSEIGNER',
  codeActivite: 'CODE D’ACTIVITÉ À RENSEIGNER',
  directeurPublication: 'DIRECTEUR OU DIRECTRICE DE LA PUBLICATION À RENSEIGNER',
  courrielContact: 'contact@exploitant.example.org',
  courrielDpo: 'dpo@exploitant.example.org',
}

/** Bloc HÉBERGEMENT — à renseigner par l'organisation qui exploite l'instance. */
const HEBERGEUR = {
  nom: 'HÉBERGEUR À RENSEIGNER',
  adresse: 'ADRESSE DE L’HÉBERGEUR À RENSEIGNER',
  localisation: 'PAYS OU RÉGION D’HÉBERGEMENT À RENSEIGNER',
}

/**
 * Autorité de contrôle compétente. Les valeurs livrées visent la France ; une
 * instance exploitée dans un autre État membre remplace ce bloc par son
 * autorité nationale.
 */
const AUTORITE = {
  nom: 'AUTORITÉ DE CONTRÔLE À RENSEIGNER',
  adresse: 'ADRESSE DE L’AUTORITÉ DE CONTRÔLE À RENSEIGNER',
  siteWeb: 'https://autorite-de-controle.example.org',
}

export const LEGAL_LAST_UPDATED = 'date de publication à renseigner'

export const MENTIONS_LEGALES_MD = `# Mentions légales

_Dernière mise à jour : ${LEGAL_LAST_UPDATED}_

> **Instance auto-hébergée.** Ce document décrit l'organisation qui exploite
> cette instance d'OpenPulse. Il ne décrit ni les auteurs du logiciel ni aucun
> autre exploitant. Tant que les mentions en capitales n'ont pas été remplacées,
> cette page n'est pas conforme et l'instance ne doit pas être ouverte au public.

## Éditeur

Le service est édité et exploité par :

- **Dénomination** : ${ORGANISATION.denomination}
- **Forme juridique** : ${ORGANISATION.formeJuridique}
- **Capital social** : ${ORGANISATION.capital}
- **Siège** : ${ORGANISATION.siege}
- **Immatriculation** : ${ORGANISATION.immatriculation}
- **TVA intracommunautaire** : ${ORGANISATION.tva}
- **Code d'activité** : ${ORGANISATION.codeActivite}
- **Courriel** : ${ORGANISATION.courrielContact}

## Directeur de la publication

${ORGANISATION.directeurPublication}

## Hébergeur

L'application et les données associées sont hébergées par :

- **${HEBERGEUR.nom}** — ${HEBERGEUR.adresse}
- **Localisation des données** : ${HEBERGEUR.localisation}

## Logiciel et propriété intellectuelle

Cette instance fait tourner **OpenPulse**, une distribution auto-hébergeable
distribuée sous la licence figurant dans le fichier \`LICENSE\` du dépôt. Le
code reste régi par cette licence ; les droits associés aux contenus, données,
marques, logos et identité visuelle propres à ${ORGANISATION.denomination}
restent la propriété de cette dernière. Les composants tiers conservent leurs
licences respectives.

## Données personnelles

Les traitements sont décrits dans la
**[Politique de confidentialité](/politique-confidentialite)**.
Exercice des droits : **${ORGANISATION.courrielDpo}**.

## Cookies

Cette instance n'utilise, dans sa configuration livrée, que des cookies
strictement nécessaires à son fonctionnement (session, préférences
d'affichage). Aucun cookie de mesure d'audience ou de publicité n'est déposé.
Toute intégration ajoutée par l'exploitant qui déposerait d'autres cookies
devrait faire l'objet d'un recueil de consentement et être documentée ici.

## Accessibilité

Les signalements d'obstacle à l'accessibilité peuvent être adressés à
**${ORGANISATION.courrielContact}**.

## Contact

${ORGANISATION.denomination} — ${ORGANISATION.siege} — ${ORGANISATION.courrielContact}
`

export const POLITIQUE_CONFIDENTIALITE_MD = `# Politique de confidentialité

_Dernière mise à jour : ${LEGAL_LAST_UPDATED}_

> **Instance auto-hébergée.** Ce document est un gabarit. Il décrit les
> traitements que le logiciel OpenPulse rend possibles ; l'exploitant doit le
> corriger pour refléter ce qu'il active réellement, ses durées de conservation
> et ses sous-traitants effectifs.

**Responsable du traitement** : ${ORGANISATION.denomination} — ${ORGANISATION.siege}.
**Contact** : ${ORGANISATION.courrielDpo}

## 1. Qui sommes-nous ?

${ORGANISATION.denomination} exploite une instance d'OpenPulse, un outil de
gestion de la relation client, de gestion des ressources humaines et de gestion
de projet, à destination de ses membres et de ses organisations partenaires.

## 2. Quelles données sont traitées ?

**Utilisateurs internes** : identité (nom, prénom, adresse professionnelle,
photo), rôle et permissions, données de gestion du personnel (contrats,
rémunération, absences, entretiens, frais), journaux de connexion (adresse IP,
agent utilisateur, journaux d'audit), données d'authentification (empreinte du
mot de passe, secret de double authentification chiffré).

**Contacts externes** : identité et coordonnées professionnelles, échanges
(messages, tâches, comptes rendus), données contractuelles (devis, contrats,
factures), données de formation (émargements, questionnaires, enquêtes).

**Données de navigation** : indicateurs de performance Web échantillonnés et,
si l'exploitant active cette fonction, marqueurs d'ouverture et de clic dans
les courriels sortants.

## 3. Finalités et bases légales

Le tableau ci-dessous est un gabarit : les durées doivent être arbitrées par
l'exploitant au regard de son droit national.

| Finalité | Base légale | Conservation |
|---|---|---|
| Gestion contractuelle | Exécution du contrat | À RENSEIGNER |
| Facturation et comptabilité | Obligation légale | À RENSEIGNER |
| Gestion du personnel | Contrat de travail et obligations légales | À RENSEIGNER |
| Prospection professionnelle | Intérêt légitime | À RENSEIGNER |
| Mesure d'engagement des courriels | Intérêt légitime | À RENSEIGNER |
| Authentification et sécurité | Intérêt légitime | À RENSEIGNER |
| Statistiques de performance | Intérêt légitime | À RENSEIGNER |

## 4. Destinataires et sous-traitants

Les données sont accessibles aux membres habilités de
${ORGANISATION.denomination}, selon le rôle applicatif, et aux sous-traitants
techniques que l'exploitant a effectivement mis en œuvre. Dans la distribution
livrée, aucun service tiers n'est appelé par défaut : chaque intégration
(hébergement, service d'intelligence artificielle, signature électronique,
passerelle de courriel) doit être ajoutée à cette liste dès son activation,
avec sa localisation.

**Hébergement** : ${HEBERGEUR.nom} — ${HEBERGEUR.localisation}.

Tout transfert hors de l'Espace économique européen doit être encadré par des
garanties appropriées et mentionné ici.

## 5. Marqueurs dans les courriels

Si l'exploitant active la mesure d'engagement, les courriels sortants peuvent
contenir un marqueur d'ouverture et des liens de suivi de clic. Aucun cookie
tiers n'est déposé. Toute personne destinataire peut demander la désactivation
du suivi à **${ORGANISATION.courrielDpo}**.

## 6. Sécurité

- Chiffrement des communications en transit et des données au repos.
- Double authentification par code temporaire pour les comptes
  d'administration.
- Cloisonnement des accès par règles de sécurité au niveau de la base de
  données et journalisation des accès aux données sensibles.
- Sauvegardes régulières, dont l'exploitant définit et vérifie la fréquence,
  la localisation et la procédure de restauration.

## 7. Vos droits

Conformément aux articles 15 à 22 du RGPD, vous pouvez **accéder** à vos
données, les **rectifier**, en demander l'**effacement**, vous **opposer** à un
traitement, en demander la **limitation** ou la **portabilité**.

Pour exercer ces droits : **${ORGANISATION.courrielDpo}**. Délai de réponse :
un mois, extensible à deux mois pour les demandes complexes.

## 8. Réclamation

En cas de réponse insatisfaisante, vous pouvez saisir l'autorité de contrôle
compétente : ${AUTORITE.nom} — ${AUTORITE.adresse} — ${AUTORITE.siteWeb}

## 9. Modifications

Toute modification substantielle de la présente politique est publiée à
l'adresse \`/politique-confidentialite\` et, le cas échéant, notifiée aux
personnes concernées.
`
