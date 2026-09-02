/**
 * OpenPulse — registre des interrupteurs de fonctionnalites.
 *
 * Un interrupteur par integration externe. Chaque interrupteur expose son etat
 * ET la raison de cet etat, pour que l'interface explique a l'utilisateur
 * pourquoi un module est absent au lieu de se casser.
 *
 * Trois etats seulement :
 *   - `active`                      : tout le necessaire est configure ;
 *   - `desactivee_par_configuration`: l'exploitant l'a coupee volontairement ;
 *   - `configuration_incomplete`    : elle est voulue mais il manque quelque
 *                                     chose, et on sait quoi.
 *
 * Deux portees de variables, a ne jamais confondre :
 *   - `client` : variable `VITE_*`, lisible dans le navigateur, publique ;
 *   - `serveur`: secret, invisible depuis le navigateur. L'etat reel est donc
 *     rapporte par le serveur (voir `definirCapacitesServeur`). Sans ce
 *     rapport, l'interrupteur est « configuration incomplete » avec une raison
 *     qui le dit franchement — jamais « active » par optimisme.
 *
 * Aucune valeur n'est calculee au chargement du module a partir de
 * l'environnement : tout passe par des fonctions, pour rester testable et pour
 * qu'un import ne puisse jamais faire echouer le demarrage de l'application.
 */

export type EtatFonctionnalite =
  | 'active'
  | 'desactivee_par_configuration'
  | 'configuration_incomplete'

export type PorteeVariable = 'client' | 'serveur'

export type CategorieFonctionnalite =
  | 'intelligence'
  | 'communication'
  | 'documents'
  | 'finance'
  | 'infrastructure'
  | 'observabilite'

export type IdFonctionnalite =
  | 'ia'
  | 'ia_embeddings'
  | 'transcription'
  | 'recherche_documentaire'
  | 'recherche_web'
  | 'banque'
  | 'signature'
  | 'messagerie_envoi'
  | 'messagerie_reception'
  | 'reseaux_facebook'
  | 'reseaux_instagram'
  | 'reseaux_linkedin'
  | 'reseaux_tiktok'
  | 'visioconference'
  | 'stockage_objets'
  | 'edition_documents'
  | 'observabilite'
  | 'analytique_web'
  | 'notifications_push'
  | 'authentification_unique'
  | 'outils_internes'

export interface VariableAttendue {
  readonly nom: string
  readonly portee: PorteeVariable
  readonly description: string
}

/**
 * `toutes` : chaque variable est requise. `au_moins_une` : une seule suffit
 * (cas d'un choix entre implementations concurrentes).
 */
export type ModeExigence = 'toutes' | 'au_moins_une'

export interface DefinitionFonctionnalite {
  readonly id: IdFonctionnalite
  readonly libelle: string
  readonly description: string
  readonly categorie: CategorieFonctionnalite
  readonly variables: readonly VariableAttendue[]
  readonly modeExigence: ModeExigence
  /**
   * Nom de la capacite telle que le serveur la rapporte. `null` quand la
   * fonctionnalite est entierement resoluble cote client.
   */
  readonly capaciteServeur: string | null
  /** Section du guide d'installation a ouvrir pour la configurer. */
  readonly ancreDocumentation: string
}

export interface EtatInterrupteur {
  readonly definition: DefinitionFonctionnalite
  readonly etat: EtatFonctionnalite
  readonly raison: string
  readonly variablesManquantes: readonly VariableAttendue[]
  /** Faux quand l'etat des secrets serveur n'a pas encore ete rapporte. */
  readonly etatServeurConnu: boolean
}

export interface SourceConfiguration {
  readonly env: Readonly<Record<string, string | undefined>>
  /**
   * Capacites rapportees par le serveur : `{ banque: true, signature: false }`.
   * `null` signifie « pas encore connu ».
   */
  readonly capacitesServeur: Readonly<Record<string, boolean>> | null
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const DEFINITIONS: Record<IdFonctionnalite, DefinitionFonctionnalite> = {
  ia: {
    id: 'ia',
    libelle: 'Assistance par modeles de langage',
    description:
      "Redaction assistee, resumes, classement automatique, extraction d'informations.",
    categorie: 'intelligence',
    modeExigence: 'toutes',
    capaciteServeur: 'ia',
    ancreDocumentation: 'integrations/modeles-de-langage',
    variables: [
      {
        nom: 'VITE_IA_FOURNISSEUR',
        portee: 'client',
        description:
          'openai-compatible, azure-openai, anthropic, ollama, ou aucun pour couper la fonctionnalite.',
      },
      {
        nom: 'VITE_IA_URL_BASE',
        portee: 'client',
        description:
          "Racine de l'API, ou chemin de relais de meme origine (/api/ia) pour que la cle reste cote serveur.",
      },
      {
        nom: 'VITE_IA_MODELE_CONVERSATION',
        portee: 'client',
        description:
          'Modele de conversation. Sur un service Azure OpenAI, il s agit du nom du deploiement cree chez vous.',
      },
      {
        nom: 'IA_CLE_API',
        portee: 'serveur',
        description:
          "Cle d'API du fournisseur. Jamais prefixee par VITE_ : elle serait publiee dans le paquet JavaScript.",
      },
    ],
  },
  ia_embeddings: {
    id: 'ia_embeddings',
    libelle: 'Vectorisation de texte',
    description: 'Calcul des vecteurs necessaires a la recherche semantique.',
    categorie: 'intelligence',
    modeExigence: 'toutes',
    capaciteServeur: 'ia_embeddings',
    ancreDocumentation: 'integrations/modeles-de-langage#embeddings',
    variables: [
      {
        nom: 'VITE_IA_MODELE_EMBEDDINGS',
        portee: 'client',
        description:
          'Modele ou deploiement de vectorisation. Aucune valeur par defaut : la dimension des vecteurs depend de votre choix.',
      },
    ],
  },
  transcription: {
    id: 'transcription',
    libelle: 'Transcription vocale',
    description: 'Conversion des enregistrements de reunion et des dictees en texte.',
    categorie: 'intelligence',
    modeExigence: 'toutes',
    capaciteServeur: 'transcription',
    ancreDocumentation: 'integrations/transcription',
    variables: [
      {
        nom: 'VITE_IA_MODELE_TRANSCRIPTION',
        portee: 'client',
        description: 'Modele ou deploiement de transcription.',
      },
      {
        nom: 'TRANSCRIPTION_CLE_API',
        portee: 'serveur',
        description:
          "Cle du service de transcription, si distinct du fournisseur de conversation. A defaut, IA_CLE_API est reutilisee.",
      },
    ],
  },
  recherche_documentaire: {
    id: 'recherche_documentaire',
    libelle: 'Recherche documentaire semantique',
    description:
      'Interrogation en langage naturel de la base documentaire, reponses appuyees sur vos documents.',
    categorie: 'documents',
    modeExigence: 'toutes',
    capaciteServeur: 'recherche_documentaire',
    ancreDocumentation: 'integrations/recherche-documentaire',
    variables: [
      {
        nom: 'VITE_IA_MODELE_EMBEDDINGS',
        portee: 'client',
        description: 'La recherche semantique repose sur la vectorisation.',
      },
      {
        nom: 'RECHERCHE_DOCUMENTAIRE_INDEX',
        portee: 'serveur',
        description:
          "Nom de l'index vectoriel dans votre base. Vide, l'indexation ne demarre pas et la recherche reste lexicale.",
      },
    ],
  },
  recherche_web: {
    id: 'recherche_web',
    libelle: 'Recherche sur le web',
    description: "Enrichissement des reponses par une recherche externe en temps reel.",
    categorie: 'intelligence',
    modeExigence: 'toutes',
    capaciteServeur: 'recherche_web',
    ancreDocumentation: 'integrations/recherche-web',
    variables: [
      {
        nom: 'RECHERCHE_WEB_FOURNISSEUR',
        portee: 'serveur',
        description: "Identifiant du moteur de recherche retenu par votre organisation.",
      },
      {
        nom: 'RECHERCHE_WEB_CLE_API',
        portee: 'serveur',
        description: "Cle d'API du moteur de recherche.",
      },
    ],
  },
  banque: {
    id: 'banque',
    libelle: 'Synchronisation bancaire',
    description:
      'Import des operations, rapprochement des factures, suivi de tresorerie automatise.',
    categorie: 'finance',
    modeExigence: 'toutes',
    capaciteServeur: 'banque',
    ancreDocumentation: 'integrations/banque',
    variables: [
      {
        nom: 'BANQUE_CLE_API',
        portee: 'serveur',
        description: "Cle d'API fournie par votre etablissement bancaire.",
      },
      {
        nom: 'BANQUE_IDENTIFIANT_ORGANISATION',
        portee: 'serveur',
        description: 'Identifiant de votre organisation chez le fournisseur bancaire.',
      },
      {
        nom: 'BANQUE_SECRET_WEBHOOK',
        portee: 'serveur',
        description:
          "Secret de verification des notifications entrantes. Sans lui, les notifications sont refusees.",
      },
    ],
  },
  signature: {
    id: 'signature',
    libelle: 'Signature electronique',
    description: 'Envoi de documents a signer, relances et suivi des signatures.',
    categorie: 'documents',
    modeExigence: 'toutes',
    capaciteServeur: 'signature',
    ancreDocumentation: 'integrations/signature',
    variables: [
      {
        nom: 'SIGNATURE_URL_BASE',
        portee: 'serveur',
        description:
          "Racine du service de signature. Renseigner l'adresse de votre instance auto-hebergee, ou celle du service en ligne si vous en utilisez un.",
      },
      {
        nom: 'SIGNATURE_CLE_API',
        portee: 'serveur',
        description: "Jeton d'authentification du service de signature.",
      },
      {
        nom: 'SIGNATURE_SECRET_WEBHOOK',
        portee: 'serveur',
        description:
          'Secret de verification des retours de signature. Sans lui, les statuts ne remontent pas.',
      },
    ],
  },
  messagerie_envoi: {
    id: 'messagerie_envoi',
    libelle: 'Envoi de courriels',
    description:
      'Notifications, relances, convocations et accuses envoyes depuis la plateforme.',
    categorie: 'communication',
    modeExigence: 'toutes',
    capaciteServeur: 'messagerie_envoi',
    ancreDocumentation: 'integrations/courriel#envoi',
    variables: [
      {
        nom: 'COURRIEL_TRANSPORT',
        portee: 'serveur',
        description:
          'smtp pour votre propre relais, api pour un service transactionnel, aucun pour desactiver tout envoi.',
      },
      {
        nom: 'COURRIEL_EXPEDITEUR_DEFAUT',
        portee: 'serveur',
        description:
          'Adresse d expedition par defaut, par exemple notifications@example.org. Elle doit appartenir a un domaine que vous controlez.',
      },
      {
        nom: 'COURRIEL_SECRET_TRANSPORT',
        portee: 'serveur',
        description:
          "Mot de passe SMTP ou cle d'API du service transactionnel, selon le transport choisi.",
      },
    ],
  },
  messagerie_reception: {
    id: 'messagerie_reception',
    libelle: 'Reception et boite partagee',
    description:
      'Rapatriement des messages, fils de discussion, classement et reponses depuis la plateforme.',
    categorie: 'communication',
    modeExigence: 'toutes',
    capaciteServeur: 'messagerie_reception',
    ancreDocumentation: 'integrations/courriel#reception',
    variables: [
      {
        nom: 'COURRIEL_RECEPTION_PROTOCOLE',
        portee: 'serveur',
        description:
          'imap pour une boite existante, jmap pour un serveur de courrier moderne, aucun pour desactiver.',
      },
      {
        nom: 'COURRIEL_RECEPTION_HOTE',
        portee: 'serveur',
        description: 'Adresse du serveur de courrier entrant, par exemple courriel.example.org.',
      },
      {
        nom: 'COURRIEL_CLE_CHIFFREMENT',
        portee: 'serveur',
        description:
          "Cle de chiffrement des identifiants de boites stockes en base (32 octets en hexadecimal). Sans elle, aucun compte ne peut etre enregistre.",
      },
    ],
  },
  reseaux_facebook: {
    id: 'reseaux_facebook',
    libelle: 'Publication et moderation — premier reseau social',
    description: 'Publication programmee, lecture des commentaires et reponses.',
    categorie: 'communication',
    modeExigence: 'toutes',
    capaciteServeur: 'reseaux_facebook',
    ancreDocumentation: 'integrations/reseaux-sociaux',
    variables: [
      {
        nom: 'RESEAUX_META_IDENTIFIANT_APPLICATION',
        portee: 'serveur',
        description: "Identifiant de l'application declaree par votre organisation.",
      },
      {
        nom: 'RESEAUX_META_SECRET_APPLICATION',
        portee: 'serveur',
        description: "Secret de l'application. Il autorise l'echange de jetons.",
      },
      {
        nom: 'RESEAUX_SECRET_ETAT_OAUTH',
        portee: 'serveur',
        description:
          "Secret de signature du parametre d'etat OAuth, commun aux quatre plateformes.",
      },
    ],
  },
  reseaux_instagram: {
    id: 'reseaux_instagram',
    libelle: 'Publication et moderation — deuxieme reseau social',
    description:
      'Partage la meme application que le premier reseau, mais exige une autorisation distincte.',
    categorie: 'communication',
    modeExigence: 'toutes',
    capaciteServeur: 'reseaux_instagram',
    ancreDocumentation: 'integrations/reseaux-sociaux',
    variables: [
      {
        nom: 'RESEAUX_META_IDENTIFIANT_APPLICATION',
        portee: 'serveur',
        description: "Identifiant de l'application declaree par votre organisation.",
      },
      {
        nom: 'RESEAUX_META_SECRET_APPLICATION',
        portee: 'serveur',
        description: "Secret de l'application.",
      },
    ],
  },
  reseaux_linkedin: {
    id: 'reseaux_linkedin',
    libelle: 'Publication — reseau professionnel',
    description: 'Publication programmee sur la page de votre organisation.',
    categorie: 'communication',
    modeExigence: 'toutes',
    capaciteServeur: 'reseaux_linkedin',
    ancreDocumentation: 'integrations/reseaux-sociaux',
    variables: [
      {
        nom: 'RESEAUX_PRO_IDENTIFIANT_CLIENT',
        portee: 'serveur',
        description: 'Identifiant client de votre application.',
      },
      {
        nom: 'RESEAUX_PRO_SECRET_CLIENT',
        portee: 'serveur',
        description: 'Secret client de votre application.',
      },
    ],
  },
  reseaux_tiktok: {
    id: 'reseaux_tiktok',
    libelle: 'Publication — reseau video court',
    description: 'Publication de contenus courts et suivi des interactions.',
    categorie: 'communication',
    modeExigence: 'toutes',
    capaciteServeur: 'reseaux_tiktok',
    ancreDocumentation: 'integrations/reseaux-sociaux',
    variables: [
      {
        nom: 'RESEAUX_VIDEO_CLE_CLIENT',
        portee: 'serveur',
        description: 'Cle client de votre application.',
      },
      {
        nom: 'RESEAUX_VIDEO_SECRET_CLIENT',
        portee: 'serveur',
        description: 'Secret client de votre application.',
      },
    ],
  },
  visioconference: {
    id: 'visioconference',
    libelle: 'Visioconference',
    description: 'Creation de salles de reunion et liens joints aux invitations.',
    categorie: 'communication',
    modeExigence: 'toutes',
    capaciteServeur: null,
    ancreDocumentation: 'integrations/visioconference',
    variables: [
      {
        nom: 'VITE_VISIO_URL_BASE',
        portee: 'client',
        description:
          "Racine de votre serveur de visioconference, par exemple https://visio.example.org. Vide, les liens ne sont plus proposes et le champ reste saisissable a la main.",
      },
    ],
  },
  stockage_objets: {
    id: 'stockage_objets',
    libelle: 'Stockage des fichiers',
    description: 'Depot, versions et partage des documents et pieces jointes.',
    categorie: 'documents',
    modeExigence: 'toutes',
    capaciteServeur: 'stockage_objets',
    ancreDocumentation: 'integrations/stockage',
    variables: [
      {
        nom: 'VITE_STOCKAGE_API_URL',
        portee: 'client',
        description:
          "Racine du service de fichiers. Vide, la plateforme retombe sur le stockage integre a la base de donnees.",
      },
      {
        nom: 'STOCKAGE_FOURNISSEUR',
        portee: 'serveur',
        description: 'integre, s3, ou webdav selon votre infrastructure.',
      },
      {
        nom: 'STOCKAGE_SECRET',
        portee: 'serveur',
        description: "Secret d'acces au stockage, hors du stockage integre.",
      },
    ],
  },
  edition_documents: {
    id: 'edition_documents',
    libelle: 'Edition collaborative de documents',
    description: 'Ouverture et modification des documents bureautiques dans le navigateur.',
    categorie: 'documents',
    modeExigence: 'toutes',
    capaciteServeur: 'edition_documents',
    ancreDocumentation: 'integrations/edition-documents',
    variables: [
      {
        nom: 'EDITION_DOCUMENTS_URL_SERVEUR',
        portee: 'serveur',
        description: "Racine de votre serveur d'edition documentaire.",
      },
      {
        nom: 'EDITION_DOCUMENTS_SECRET_JWT',
        portee: 'serveur',
        description: "Secret de signature des jetons d'ouverture de document.",
      },
    ],
  },
  observabilite: {
    id: 'observabilite',
    libelle: 'Suivi des erreurs et traces',
    description: "Remontee des erreurs applicatives et des traces d'execution.",
    categorie: 'observabilite',
    modeExigence: 'au_moins_une',
    capaciteServeur: null,
    ancreDocumentation: 'exploitation/observabilite',
    variables: [
      {
        nom: 'VITE_SUIVI_ERREURS_URL',
        portee: 'client',
        description:
          "Point de collecte des erreurs. Vide, les erreurs restent dans la console du navigateur et dans la base locale.",
      },
      {
        nom: 'VITE_OTEL_ENDPOINT',
        portee: 'client',
        description: "Collecteur de traces compatible OpenTelemetry.",
      },
    ],
  },
  analytique_web: {
    id: 'analytique_web',
    libelle: 'Mesure d audience',
    description: "Statistiques d'usage des pages, sans traceur tiers impose.",
    categorie: 'observabilite',
    modeExigence: 'au_moins_une',
    capaciteServeur: null,
    ancreDocumentation: 'exploitation/mesure-audience',
    variables: [
      {
        nom: 'VITE_ANALYTIQUE_DOMAINE',
        portee: 'client',
        description: 'Domaine declare dans votre instance de mesure d audience.',
      },
      {
        nom: 'VITE_ANALYTIQUE_URL',
        portee: 'client',
        description: 'Racine de votre serveur de mesure d audience.',
      },
    ],
  },
  notifications_push: {
    id: 'notifications_push',
    libelle: 'Notifications poussees',
    description:
      'Alertes sur poste et mobile, meme lorsque la plateforme n est pas ouverte.',
    categorie: 'infrastructure',
    modeExigence: 'toutes',
    capaciteServeur: 'notifications_push',
    ancreDocumentation: 'integrations/notifications-poussees',
    variables: [
      {
        nom: 'VITE_PUSH_CLE_PUBLIQUE',
        portee: 'client',
        description:
          "Cle publique de votre paire de cles de notification. A generer par votre organisation : aucune cle ne doit etre partagee entre instances.",
      },
      {
        nom: 'PUSH_CLE_PRIVEE',
        portee: 'serveur',
        description: 'Cle privee correspondante, utilisee pour signer les envois.',
      },
      {
        nom: 'PUSH_SUJET',
        portee: 'serveur',
        description: 'Adresse de contact au format mailto:, exigee par les navigateurs.',
      },
    ],
  },
  authentification_unique: {
    id: 'authentification_unique',
    libelle: 'Authentification unique',
    description: "Connexion par votre fournisseur d'identite, en plus du mot de passe.",
    categorie: 'infrastructure',
    modeExigence: 'toutes',
    capaciteServeur: null,
    ancreDocumentation: 'integrations/authentification-unique',
    variables: [
      {
        nom: 'VITE_SSO_URL_EMETTEUR',
        portee: 'client',
        description: "Emetteur OpenID Connect de votre fournisseur d'identite.",
      },
      {
        nom: 'VITE_SSO_IDENTIFIANT_CLIENT',
        portee: 'client',
        description: "Identifiant client declare pour la plateforme.",
      },
    ],
  },
  outils_internes: {
    id: 'outils_internes',
    libelle: 'Outils internes integres',
    description:
      "Ouverture d'outils internes depuis la plateforme, en cadre integre ou en onglet.",
    categorie: 'infrastructure',
    modeExigence: 'toutes',
    capaciteServeur: null,
    ancreDocumentation: 'integrations/outils-internes',
    variables: [
      {
        nom: 'VITE_OUTILS_INTERNES_ORIGINES',
        portee: 'client',
        description:
          'Liste separee par des virgules des origines autorisees. Toute origine absente de cette liste est refusee.',
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Acces au registre
// ---------------------------------------------------------------------------

export function definitionFonctionnalite(id: IdFonctionnalite): DefinitionFonctionnalite {
  return DEFINITIONS[id]
}

export function listerFonctionnalites(): readonly DefinitionFonctionnalite[] {
  return Object.values(DEFINITIONS)
}

export function listerFonctionnalitesDeCategorie(
  categorie: CategorieFonctionnalite
): readonly DefinitionFonctionnalite[] {
  return listerFonctionnalites().filter((definition) => definition.categorie === categorie)
}

// ---------------------------------------------------------------------------
// Source de configuration
// ---------------------------------------------------------------------------

function lireEnvironnement(): Readonly<Record<string, string | undefined>> {
  try {
    return (import.meta.env ?? {}) as unknown as Readonly<Record<string, string | undefined>>
  } catch {
    return {}
  }
}

let capacitesServeur: Readonly<Record<string, boolean>> | null = null

/**
 * Enregistre l'etat des integrations dont les secrets vivent cote serveur.
 * A appeler une fois au demarrage, avec la reponse d'un point d'etat public qui
 * ne renvoie que des booleens — jamais la valeur des secrets.
 */
export function definirCapacitesServeur(capacites: Readonly<Record<string, boolean>>): void {
  capacitesServeur = { ...capacites }
}

export function oublierCapacitesServeur(): void {
  capacitesServeur = null
}

export function sourceConfigurationCourante(): SourceConfiguration {
  return { env: lireEnvironnement(), capacitesServeur }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

const VALEURS_FAUSSES: readonly string[] = ['off', 'false', '0', 'non', 'aucun', 'desactive']

function estRenseignee(
  env: Readonly<Record<string, string | undefined>>,
  nom: string
): boolean {
  const brut = env[nom]
  return typeof brut === 'string' && brut.trim() !== ''
}

function nomInterrupteur(id: IdFonctionnalite): string {
  return `VITE_MODULE_${id.toUpperCase()}`
}

function listeModulesDesactives(
  env: Readonly<Record<string, string | undefined>>
): readonly string[] {
  const brut = env['VITE_MODULES_DESACTIVES']
  if (typeof brut !== 'string') return []
  return brut
    .split(',')
    .map((element) => element.trim().toLowerCase())
    .filter((element) => element !== '')
}

function coupeeExplicitement(
  definition: DefinitionFonctionnalite,
  env: Readonly<Record<string, string | undefined>>
): string | null {
  const interrupteur = nomInterrupteur(definition.id)
  const brut = env[interrupteur]
  if (typeof brut === 'string' && VALEURS_FAUSSES.includes(brut.trim().toLowerCase())) {
    return `Le module est coupe par la configuration : ${interrupteur} vaut « ${brut.trim()} ».`
  }
  if (listeModulesDesactives(env).includes(definition.id)) {
    return `Le module est coupe par la configuration : « ${definition.id} » figure dans VITE_MODULES_DESACTIVES.`
  }
  return null
}

/**
 * Evalue un interrupteur. Fonction pure : aucune exception, aucun appel reseau,
 * aucun effet de bord — elle peut donc etre appelee pendant un rendu.
 */
export function evaluerFonctionnalite(
  id: IdFonctionnalite,
  source: SourceConfiguration = sourceConfigurationCourante()
): EtatInterrupteur {
  const definition = DEFINITIONS[id]
  const { env } = source

  const coupure = coupeeExplicitement(definition, env)
  if (coupure !== null) {
    return {
      definition,
      etat: 'desactivee_par_configuration',
      raison: coupure,
      variablesManquantes: [],
      etatServeurConnu: true,
    }
  }

  const variablesClient = definition.variables.filter(
    (variable) => variable.portee === 'client'
  )
  const variablesServeur = definition.variables.filter(
    (variable) => variable.portee === 'serveur'
  )

  const clientManquantes = variablesClient.filter(
    (variable) => !estRenseignee(env, variable.nom)
  )

  // Mode « au moins une » : la fonctionnalite est active des qu'une variable
  // cliente est renseignee, sans exiger le reste.
  if (definition.modeExigence === 'au_moins_une') {
    const auMoinsUne = variablesClient.some((variable) => estRenseignee(env, variable.nom))
    if (auMoinsUne) {
      return {
        definition,
        etat: 'active',
        raison: 'Au moins une implementation est configuree.',
        variablesManquantes: [],
        etatServeurConnu: true,
      }
    }
    return {
      definition,
      etat: 'configuration_incomplete',
      raison:
        'Aucune implementation configuree : definir au moins une des variables ci-dessous.',
      variablesManquantes: variablesClient,
      etatServeurConnu: true,
    }
  }

  if (variablesServeur.length > 0 && definition.capaciteServeur !== null) {
    if (source.capacitesServeur === null) {
      return {
        definition,
        etat: 'configuration_incomplete',
        raison:
          "L'etat des secrets serveur de ce module n'a pas encore ete rapporte par le serveur. La verification est en cours ; aucune donnee n'est perdue.",
        variablesManquantes: [...clientManquantes, ...variablesServeur],
        etatServeurConnu: false,
      }
    }
    const capaciteServeurPresente = source.capacitesServeur[definition.capaciteServeur] === true
    if (!capaciteServeurPresente) {
      return {
        definition,
        etat: 'configuration_incomplete',
        raison:
          'Le serveur signale que les secrets de ce module ne sont pas configures. Les renseigner dans la configuration du serveur, puis redemarrer le service.',
        variablesManquantes: [...clientManquantes, ...variablesServeur],
        etatServeurConnu: true,
      }
    }
  }

  if (clientManquantes.length > 0) {
    return {
      definition,
      etat: 'configuration_incomplete',
      raison: `Variables d'environnement manquantes : ${clientManquantes
        .map((variable) => variable.nom)
        .join(', ')}.`,
      variablesManquantes: clientManquantes,
      etatServeurConnu: source.capacitesServeur !== null,
    }
  }

  return {
    definition,
    etat: 'active',
    raison: 'Configuration complete.',
    variablesManquantes: [],
    etatServeurConnu: source.capacitesServeur !== null || variablesServeur.length === 0,
  }
}

export function evaluerToutesFonctionnalites(
  source: SourceConfiguration = sourceConfigurationCourante()
): readonly EtatInterrupteur[] {
  return listerFonctionnalites().map((definition) =>
    evaluerFonctionnalite(definition.id, source)
  )
}

export function estFonctionnaliteActive(
  id: IdFonctionnalite,
  source: SourceConfiguration = sourceConfigurationCourante()
): boolean {
  return evaluerFonctionnalite(id, source).etat === 'active'
}

export interface ResumeFonctionnalites {
  readonly total: number
  readonly actives: number
  readonly desactivees: number
  readonly incompletes: number
  readonly enAttenteDuServeur: number
}

export function resumerFonctionnalites(
  source: SourceConfiguration = sourceConfigurationCourante()
): ResumeFonctionnalites {
  const etats = evaluerToutesFonctionnalites(source)
  return {
    total: etats.length,
    actives: etats.filter((etat) => etat.etat === 'active').length,
    desactivees: etats.filter((etat) => etat.etat === 'desactivee_par_configuration').length,
    incompletes: etats.filter((etat) => etat.etat === 'configuration_incomplete').length,
    enAttenteDuServeur: etats.filter((etat) => !etat.etatServeurConnu).length,
  }
}

/** Libelle court destine a un badge d'interface. */
export function libelleEtat(etat: EtatFonctionnalite): string {
  if (etat === 'active') return 'Active'
  if (etat === 'desactivee_par_configuration') return 'Desactivee'
  return 'A configurer'
}
