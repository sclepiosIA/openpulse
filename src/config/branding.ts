/**
 * OpenPulse — identité de marque et d'identité légale, entièrement paramétrable.
 *
 * PRINCIPE
 * Aucune valeur d'identité n'est écrite en dur dans le code applicatif. Toute
 * valeur affichée (nom, baseline, logo, palette, mentions légales, contacts)
 * provient d'une variable d'environnement `VITE_MARQUE_*` lue au moment du
 * build Vite. Les valeurs par défaut sont NEUTRES : elles ne désignent aucune
 * organisation réelle et n'utilisent que des domaines réservés à la
 * documentation (RFC 2606 / RFC 6761 : example.org, example.com, .test,
 * .invalid).
 *
 * DEUX NIVEAUX DE VALIDATION (voir `verifierMarque`)
 *  - `manquant` : la variable est vide alors que la valeur est requise à
 *    l'affichage (mentions légales, politique de confidentialité, security.txt).
 *    Rien n'est deviné : la valeur absente s'affiche sous la forme
 *    « [À RENSEIGNER : VITE_MARQUE_… ] » plutôt que sous une valeur plausible.
 *  - `exemple`  : la variable n'a pas été renseignée et le gabarit de
 *    démonstration est encore en place (contact @exploitant.example.org,
 *    URL https://exploitant.example.org, logo /placeholder.svg). L'instance
 *    fonctionne mais ne doit pas être mise en service en l'état.
 *
 * CHAMP NON APPLICABLE
 * Une organisation sans capital social (association, établissement public,
 * entreprise individuelle) renseigne explicitement « sans objet » : le module
 * ne fait pas la différence entre « non applicable » et « oublié », seul
 * l'exploitant le sait.
 *
 * CONSOMMATEURS
 *  - src/content/legal.ts        → /mentions-legales, /politique-confidentialite
 *  - public/.well-known/security.txt (gabarit statique à aligner à la main)
 *  - `variablesCssMarque()`      → jetons CSS `--primary`, `--marque-pastel-*`
 *
 * NON CÂBLÉ À CE JOUR (voir notes de distribution)
 *  - `MARQUE.messagerie.domainesInternes` : la liste de référence de
 *    l'application reste `INTERNAL_DOMAINS` dans src/lib/internalEmailConfig.ts.
 *    Le branchement demande un substitut de ce fichier, dont les valeurs par
 *    défaut sont couplées à trois suites de tests.
 */

declare global {
  interface ImportMetaEnv {
    readonly VITE_MARQUE_NOM_PRODUIT?: string
    readonly VITE_MARQUE_NOM_COURT?: string
    readonly VITE_MARQUE_BASELINE?: string
    readonly VITE_MARQUE_URL?: string
    readonly VITE_MARQUE_LOGO?: string
    readonly VITE_MARQUE_FAVICON?: string
    readonly VITE_MARQUE_COULEUR_PRIMAIRE?: string
    readonly VITE_MARQUE_COULEUR_PRIMAIRE_CLAIRE?: string
    readonly VITE_MARQUE_COULEUR_PRIMAIRE_FONCEE?: string
    readonly VITE_MARQUE_COULEUR_ACCENT?: string
    readonly VITE_MARQUE_COULEUR_SUCCES?: string
    readonly VITE_MARQUE_COULEUR_AVERTISSEMENT?: string
    readonly VITE_MARQUE_COULEUR_DANGER?: string
    readonly VITE_MARQUE_COULEUR_FOND?: string
    readonly VITE_MARQUE_COULEUR_TEXTE?: string
    readonly VITE_MARQUE_COULEUR_PASTEL_VIOLET?: string
    readonly VITE_MARQUE_COULEUR_PASTEL_BLEU?: string
    readonly VITE_MARQUE_COULEUR_PASTEL_CYAN?: string
    readonly VITE_MARQUE_COULEUR_PASTEL_ORANGE?: string
    readonly VITE_MARQUE_DOMAINES_MESSAGERIE_INTERNE?: string
    readonly VITE_MARQUE_RAISON_SOCIALE?: string
    readonly VITE_MARQUE_FORME_JURIDIQUE?: string
    readonly VITE_MARQUE_CAPITAL_SOCIAL?: string
    readonly VITE_MARQUE_IMMATRICULATION?: string
    readonly VITE_MARQUE_IDENTIFIANT_ENTREPRISE?: string
    readonly VITE_MARQUE_NUMERO_TVA?: string
    readonly VITE_MARQUE_SIEGE_SOCIAL?: string
    readonly VITE_MARQUE_DIRECTEUR_PUBLICATION?: string
    readonly VITE_MARQUE_HEBERGEUR?: string
    readonly VITE_MARQUE_HEBERGEUR_ADRESSE?: string
    readonly VITE_MARQUE_HEBERGEUR_LOCALISATION?: string
    readonly VITE_MARQUE_SOUS_TRAITANTS?: string
    readonly VITE_MARQUE_AUTORITE_CONTROLE?: string
    readonly VITE_MARQUE_AUTORITE_CONTROLE_URL?: string
    readonly VITE_MARQUE_AUTORITE_CONTROLE_ADRESSE?: string
    readonly VITE_MARQUE_LEGAL_MISE_A_JOUR?: string
    readonly VITE_MARQUE_CONTACT_GENERAL?: string
    readonly VITE_MARQUE_CONTACT_SUPPORT?: string
    readonly VITE_MARQUE_CONTACT_SECURITE?: string
    readonly VITE_MARQUE_CONTACT_PROTECTION_DONNEES?: string
  }
}

/** Gravité d'un champ d'identité non conforme. */
export type NiveauChampMarque = 'manquant' | 'exemple'

/**
 * Jetons de couleur de la charte. Chaque valeur est un triplet HSL sans
 * fonction (« H S% L% »), conformément à la convention du dépôt qui les
 * consomme via `hsl(var(--jeton))`.
 */
export interface PaletteMarque {
  readonly primaire: string
  readonly primaireClaire: string
  readonly primaireFoncee: string
  readonly accent: string
  readonly succes: string
  readonly avertissement: string
  readonly danger: string
  readonly fond: string
  readonly texte: string
  readonly pastelViolet: string
  readonly pastelBleu: string
  readonly pastelCyan: string
  readonly pastelOrange: string
}

/** Messagerie de l'organisation qui exploite l'instance. */
export interface MessagerieMarque {
  /** Domaines considérés comme internes (minuscules, sans arobase). */
  readonly domainesInternes: readonly string[]
}

/** Clés d'identité légale dont la valeur est un texte simple. */
export type CleLegaleTexte =
  | 'raisonSociale'
  | 'formeJuridique'
  | 'capitalSocial'
  | 'immatriculation'
  | 'identifiantEntreprise'
  | 'numeroTva'
  | 'siegeSocial'
  | 'directeurPublication'
  | 'hebergeur'
  | 'hebergeurAdresse'
  | 'hebergeurLocalisation'
  | 'autoriteControle'
  | 'autoriteControleUrl'
  | 'autoriteControleAdresse'
  | 'miseAJour'

export interface IdentiteLegaleMarque {
  readonly raisonSociale: string
  readonly formeJuridique: string
  readonly capitalSocial: string
  readonly immatriculation: string
  readonly identifiantEntreprise: string
  readonly numeroTva: string
  readonly siegeSocial: string
  readonly directeurPublication: string
  readonly hebergeur: string
  readonly hebergeurAdresse: string
  readonly hebergeurLocalisation: string
  readonly autoriteControle: string
  readonly autoriteControleUrl: string
  readonly autoriteControleAdresse: string
  readonly miseAJour: string
  /** Sous-traitants déclarés dans la politique de confidentialité. */
  readonly sousTraitants: readonly string[]
}

export interface ContactsMarque {
  readonly general: string
  readonly support: string
  readonly securite: string
  readonly protectionDonnees: string
}

export interface Marque {
  readonly nomProduit: string
  readonly nomCourt: string
  readonly baseline: string
  readonly url: string
  readonly logo: string
  readonly favicon: string
  readonly palette: PaletteMarque
  readonly messagerie: MessagerieMarque
  readonly legal: IdentiteLegaleMarque
  readonly contacts: ContactsMarque
}

/** Champ d'identité signalé par la validation. */
export interface ChampMarque {
  /** Chemin dans `MARQUE`, ex. « legal.raisonSociale ». */
  readonly chemin: string
  /** Variable d'environnement à renseigner. */
  readonly variable: string
  readonly niveau: NiveauChampMarque
  /** Où la valeur est visible par un tiers. */
  readonly usage: string
}

export interface RapportMarque {
  /** Vrai si aucun champ n'est ni manquant ni resté au gabarit. */
  readonly complete: boolean
  readonly manquants: readonly ChampMarque[]
  readonly exemples: readonly ChampMarque[]
}

interface RegleChamp {
  readonly chemin: string
  readonly variable: string
  readonly usage: string
  readonly valeur: string
  /** Gabarit de démonstration ; chaîne vide si le champ n'en a pas. */
  readonly gabarit: string
}

/* ------------------------------------------------------------------------- *
 * Gabarits neutres (domaines réservés uniquement)
 * ------------------------------------------------------------------------- */

const DOMAINE_GABARIT = 'exploitant.example.org'
const URL_GABARIT = `https://${DOMAINE_GABARIT}`
const LOGO_GABARIT = '/placeholder.svg'
const FAVICON_DEFAUT = '/favicon.png'
const CONTACT_GENERAL_GABARIT = `contact@${DOMAINE_GABARIT}`
const CONTACT_SUPPORT_GABARIT = `support@${DOMAINE_GABARIT}`
const CONTACT_SECURITE_GABARIT = `securite@${DOMAINE_GABARIT}`
const CONTACT_DPO_GABARIT = `dpo@${DOMAINE_GABARIT}`

/** Valeur vide : le champ est requis à l'affichage et sera signalé. */
const REQUIS = ''

function texte(valeur: string | undefined, defaut: string): string {
  const nettoye = (valeur ?? '').trim()
  return nettoye.length > 0 ? nettoye : defaut
}

function liste(valeur: string | undefined, defaut: readonly string[]): readonly string[] {
  const entrees: string[] = (valeur ?? '')
    .split(',')
    .map((entree: string): string => entree.trim())
    .filter((entree: string): boolean => entree.length > 0)
  return entrees.length > 0 ? entrees : defaut
}

function domaines(valeur: string | undefined, defaut: readonly string[]): readonly string[] {
  return liste(valeur, defaut).map((domaine: string): string => domaine.toLowerCase())
}

/**
 * Palette neutre par défaut. Les luminosités reprennent celles attendues par
 * les jetons du dépôt (`--primary-light` est un blanc cassé, `--success` est
 * un pastel clair) afin qu'une substitution de valeurs ne casse pas la
 * lisibilité des composants.
 */
/**
 * Palette par defaut de la distribution.
 *
 * Ces valeurs sont ECRITES EN LIGNE sur la racine du document par
 * `appliquerPaletteMarque` : elles l'emportent donc sur la feuille de style.
 * Tant qu'elles portaient l'ancien bleu-gris, la charte definie dans
 * `src/index.css` etait ecrasee au chargement — le fichier de styles avait
 * beau etre juste, la page affichait autre chose.
 *
 * Elles reprennent desormais les jetons de la charte, et restent surchargeables
 * par l'administrateur.
 */
export const PALETTE_NEUTRE: PaletteMarque = {
  primaire: '20 18% 11%',
  primaireClaire: '26 20% 93%',
  primaireFoncee: '20 29% 6%',
  accent: '22 78% 45%',
  succes: '22 71% 85%',
  avertissement: '22 78% 45%',
  danger: '0 52% 47%',
  fond: '26 39% 97%',
  texte: '20 18% 11%',
  pastelViolet: '250 18% 82%',
  pastelBleu: '220 25% 78%',
  pastelCyan: '200 22% 90%',
  pastelOrange: '35 35% 82%',
}

export const MARQUE: Marque = {
  nomProduit: texte(import.meta.env.VITE_MARQUE_NOM_PRODUIT, 'OpenPulse'),
  nomCourt: texte(import.meta.env.VITE_MARQUE_NOM_COURT, 'OpenPulse'),
  baseline: texte(
    import.meta.env.VITE_MARQUE_BASELINE,
    'Plateforme de gestion auto-hébergée'
  ),
  url: texte(import.meta.env.VITE_MARQUE_URL, URL_GABARIT),
  logo: texte(import.meta.env.VITE_MARQUE_LOGO, LOGO_GABARIT),
  favicon: texte(import.meta.env.VITE_MARQUE_FAVICON, FAVICON_DEFAUT),
  palette: {
    primaire: texte(import.meta.env.VITE_MARQUE_COULEUR_PRIMAIRE, PALETTE_NEUTRE.primaire),
    primaireClaire: texte(
      import.meta.env.VITE_MARQUE_COULEUR_PRIMAIRE_CLAIRE,
      PALETTE_NEUTRE.primaireClaire
    ),
    primaireFoncee: texte(
      import.meta.env.VITE_MARQUE_COULEUR_PRIMAIRE_FONCEE,
      PALETTE_NEUTRE.primaireFoncee
    ),
    accent: texte(import.meta.env.VITE_MARQUE_COULEUR_ACCENT, PALETTE_NEUTRE.accent),
    succes: texte(import.meta.env.VITE_MARQUE_COULEUR_SUCCES, PALETTE_NEUTRE.succes),
    avertissement: texte(
      import.meta.env.VITE_MARQUE_COULEUR_AVERTISSEMENT,
      PALETTE_NEUTRE.avertissement
    ),
    danger: texte(import.meta.env.VITE_MARQUE_COULEUR_DANGER, PALETTE_NEUTRE.danger),
    fond: texte(import.meta.env.VITE_MARQUE_COULEUR_FOND, PALETTE_NEUTRE.fond),
    texte: texte(import.meta.env.VITE_MARQUE_COULEUR_TEXTE, PALETTE_NEUTRE.texte),
    pastelViolet: texte(
      import.meta.env.VITE_MARQUE_COULEUR_PASTEL_VIOLET,
      PALETTE_NEUTRE.pastelViolet
    ),
    pastelBleu: texte(
      import.meta.env.VITE_MARQUE_COULEUR_PASTEL_BLEU,
      PALETTE_NEUTRE.pastelBleu
    ),
    pastelCyan: texte(
      import.meta.env.VITE_MARQUE_COULEUR_PASTEL_CYAN,
      PALETTE_NEUTRE.pastelCyan
    ),
    pastelOrange: texte(
      import.meta.env.VITE_MARQUE_COULEUR_PASTEL_ORANGE,
      PALETTE_NEUTRE.pastelOrange
    ),
  },
  messagerie: {
    domainesInternes: domaines(import.meta.env.VITE_MARQUE_DOMAINES_MESSAGERIE_INTERNE, [
      DOMAINE_GABARIT,
    ]),
  },
  legal: {
    raisonSociale: texte(import.meta.env.VITE_MARQUE_RAISON_SOCIALE, REQUIS),
    formeJuridique: texte(import.meta.env.VITE_MARQUE_FORME_JURIDIQUE, REQUIS),
    capitalSocial: texte(import.meta.env.VITE_MARQUE_CAPITAL_SOCIAL, REQUIS),
    immatriculation: texte(import.meta.env.VITE_MARQUE_IMMATRICULATION, REQUIS),
    identifiantEntreprise: texte(import.meta.env.VITE_MARQUE_IDENTIFIANT_ENTREPRISE, REQUIS),
    numeroTva: texte(import.meta.env.VITE_MARQUE_NUMERO_TVA, REQUIS),
    siegeSocial: texte(import.meta.env.VITE_MARQUE_SIEGE_SOCIAL, REQUIS),
    directeurPublication: texte(import.meta.env.VITE_MARQUE_DIRECTEUR_PUBLICATION, REQUIS),
    hebergeur: texte(import.meta.env.VITE_MARQUE_HEBERGEUR, REQUIS),
    hebergeurAdresse: texte(import.meta.env.VITE_MARQUE_HEBERGEUR_ADRESSE, REQUIS),
    hebergeurLocalisation: texte(import.meta.env.VITE_MARQUE_HEBERGEUR_LOCALISATION, REQUIS),
    autoriteControle: texte(import.meta.env.VITE_MARQUE_AUTORITE_CONTROLE, REQUIS),
    autoriteControleUrl: texte(import.meta.env.VITE_MARQUE_AUTORITE_CONTROLE_URL, REQUIS),
    autoriteControleAdresse: texte(
      import.meta.env.VITE_MARQUE_AUTORITE_CONTROLE_ADRESSE,
      REQUIS
    ),
    miseAJour: texte(import.meta.env.VITE_MARQUE_LEGAL_MISE_A_JOUR, REQUIS),
    sousTraitants: liste(import.meta.env.VITE_MARQUE_SOUS_TRAITANTS, []),
  },
  contacts: {
    general: texte(import.meta.env.VITE_MARQUE_CONTACT_GENERAL, CONTACT_GENERAL_GABARIT),
    support: texte(import.meta.env.VITE_MARQUE_CONTACT_SUPPORT, CONTACT_SUPPORT_GABARIT),
    securite: texte(import.meta.env.VITE_MARQUE_CONTACT_SECURITE, CONTACT_SECURITE_GABARIT),
    protectionDonnees: texte(
      import.meta.env.VITE_MARQUE_CONTACT_PROTECTION_DONNEES,
      CONTACT_DPO_GABARIT
    ),
  },
}

/** Variable d'environnement associée à chaque champ légal textuel. */
const VARIABLES_LEGALES: Readonly<Record<CleLegaleTexte, string>> = {
  raisonSociale: 'VITE_MARQUE_RAISON_SOCIALE',
  formeJuridique: 'VITE_MARQUE_FORME_JURIDIQUE',
  capitalSocial: 'VITE_MARQUE_CAPITAL_SOCIAL',
  immatriculation: 'VITE_MARQUE_IMMATRICULATION',
  identifiantEntreprise: 'VITE_MARQUE_IDENTIFIANT_ENTREPRISE',
  numeroTva: 'VITE_MARQUE_NUMERO_TVA',
  siegeSocial: 'VITE_MARQUE_SIEGE_SOCIAL',
  directeurPublication: 'VITE_MARQUE_DIRECTEUR_PUBLICATION',
  hebergeur: 'VITE_MARQUE_HEBERGEUR',
  hebergeurAdresse: 'VITE_MARQUE_HEBERGEUR_ADRESSE',
  hebergeurLocalisation: 'VITE_MARQUE_HEBERGEUR_LOCALISATION',
  autoriteControle: 'VITE_MARQUE_AUTORITE_CONTROLE',
  autoriteControleUrl: 'VITE_MARQUE_AUTORITE_CONTROLE_URL',
  autoriteControleAdresse: 'VITE_MARQUE_AUTORITE_CONTROLE_ADRESSE',
  miseAJour: 'VITE_MARQUE_LEGAL_MISE_A_JOUR',
}

/**
 * Rend une valeur destinée à l'affichage. Une valeur vide n'est jamais masquée
 * ni remplacée par un texte plausible : elle devient un marqueur explicite qui
 * nomme la variable à renseigner.
 */
export function valeurAffichable(valeur: string, variable: string): string {
  const nettoye = valeur.trim()
  return nettoye.length > 0 ? nettoye : `[À RENSEIGNER : ${variable}]`
}

/** Valeur affichable d'un champ légal textuel. */
export function champLegal(cle: CleLegaleTexte, marque: Marque = MARQUE): string {
  return valeurAffichable(marque.legal[cle], VARIABLES_LEGALES[cle])
}

function reglesPour(marque: Marque): readonly RegleChamp[] {
  const legal = marque.legal
  return [
    {
      chemin: 'url',
      variable: 'VITE_MARQUE_URL',
      usage: 'URL canonique publique (security.txt, liens absolus, partages)',
      valeur: marque.url,
      gabarit: URL_GABARIT,
    },
    {
      chemin: 'logo',
      variable: 'VITE_MARQUE_LOGO',
      usage: "Logo affiché à l'authentification et dans les exports",
      valeur: marque.logo,
      gabarit: LOGO_GABARIT,
    },
    {
      chemin: 'contacts.general',
      variable: 'VITE_MARQUE_CONTACT_GENERAL',
      usage: 'Contact éditeur des mentions légales',
      valeur: marque.contacts.general,
      gabarit: CONTACT_GENERAL_GABARIT,
    },
    {
      chemin: 'contacts.support',
      variable: 'VITE_MARQUE_CONTACT_SUPPORT',
      usage: "Contact support affiché dans l'application",
      valeur: marque.contacts.support,
      gabarit: CONTACT_SUPPORT_GABARIT,
    },
    {
      chemin: 'contacts.securite',
      variable: 'VITE_MARQUE_CONTACT_SECURITE',
      usage: 'Contact sécurité (security.txt, divulgation coordonnée)',
      valeur: marque.contacts.securite,
      gabarit: CONTACT_SECURITE_GABARIT,
    },
    {
      chemin: 'contacts.protectionDonnees',
      variable: 'VITE_MARQUE_CONTACT_PROTECTION_DONNEES',
      usage: 'Contact protection des données (exercice des droits RGPD)',
      valeur: marque.contacts.protectionDonnees,
      gabarit: CONTACT_DPO_GABARIT,
    },
    {
      chemin: 'legal.raisonSociale',
      variable: VARIABLES_LEGALES.raisonSociale,
      usage: 'Mentions légales — éditeur ; politique — responsable du traitement',
      valeur: legal.raisonSociale,
      gabarit: '',
    },
    {
      chemin: 'legal.formeJuridique',
      variable: VARIABLES_LEGALES.formeJuridique,
      usage: 'Mentions légales — forme juridique',
      valeur: legal.formeJuridique,
      gabarit: '',
    },
    {
      chemin: 'legal.capitalSocial',
      variable: VARIABLES_LEGALES.capitalSocial,
      usage: 'Mentions légales — capital social (« sans objet » si non applicable)',
      valeur: legal.capitalSocial,
      gabarit: '',
    },
    {
      chemin: 'legal.immatriculation',
      variable: VARIABLES_LEGALES.immatriculation,
      usage: 'Mentions légales — registre et numéro d’immatriculation',
      valeur: legal.immatriculation,
      gabarit: '',
    },
    {
      chemin: 'legal.identifiantEntreprise',
      variable: VARIABLES_LEGALES.identifiantEntreprise,
      usage: "Mentions légales — identifiant d'entreprise (SIREN, BCE, UID…)",
      valeur: legal.identifiantEntreprise,
      gabarit: '',
    },
    {
      chemin: 'legal.numeroTva',
      variable: VARIABLES_LEGALES.numeroTva,
      usage: 'Mentions légales — numéro de TVA intracommunautaire',
      valeur: legal.numeroTva,
      gabarit: '',
    },
    {
      chemin: 'legal.siegeSocial',
      variable: VARIABLES_LEGALES.siegeSocial,
      usage: 'Mentions légales — siège social ; politique — coordonnées',
      valeur: legal.siegeSocial,
      gabarit: '',
    },
    {
      chemin: 'legal.directeurPublication',
      variable: VARIABLES_LEGALES.directeurPublication,
      usage: 'Mentions légales — directeur de la publication',
      valeur: legal.directeurPublication,
      gabarit: '',
    },
    {
      chemin: 'legal.hebergeur',
      variable: VARIABLES_LEGALES.hebergeur,
      usage: 'Mentions légales — hébergeur',
      valeur: legal.hebergeur,
      gabarit: '',
    },
    {
      chemin: 'legal.hebergeurAdresse',
      variable: VARIABLES_LEGALES.hebergeurAdresse,
      usage: "Mentions légales — adresse de l'hébergeur",
      valeur: legal.hebergeurAdresse,
      gabarit: '',
    },
    {
      chemin: 'legal.hebergeurLocalisation',
      variable: VARIABLES_LEGALES.hebergeurLocalisation,
      usage: 'Politique — localisation des données hébergées',
      valeur: legal.hebergeurLocalisation,
      gabarit: '',
    },
    {
      chemin: 'legal.autoriteControle',
      variable: VARIABLES_LEGALES.autoriteControle,
      usage: 'Politique — autorité de contrôle compétente en cas de réclamation',
      valeur: legal.autoriteControle,
      gabarit: '',
    },
    {
      chemin: 'legal.autoriteControleUrl',
      variable: VARIABLES_LEGALES.autoriteControleUrl,
      usage: "Politique — site de l'autorité de contrôle",
      valeur: legal.autoriteControleUrl,
      gabarit: '',
    },
    {
      chemin: 'legal.autoriteControleAdresse',
      variable: VARIABLES_LEGALES.autoriteControleAdresse,
      usage: "Politique — adresse postale de l'autorité de contrôle",
      valeur: legal.autoriteControleAdresse,
      gabarit: '',
    },
    {
      chemin: 'legal.miseAJour',
      variable: VARIABLES_LEGALES.miseAJour,
      usage: 'Date de dernière mise à jour affichée sur les deux pages publiques',
      valeur: legal.miseAJour,
      gabarit: '',
    },
    {
      chemin: 'legal.sousTraitants',
      variable: 'VITE_MARQUE_SOUS_TRAITANTS',
      usage: 'Politique — liste des sous-traitants (séparés par des virgules)',
      valeur: legal.sousTraitants.join(', '),
      gabarit: '',
    },
  ]
}

/**
 * Contrôle l'identité configurée. À appeler au démarrage (mode développement)
 * et dans un test de contrat avant mise en service.
 */
export function verifierMarque(marque: Marque = MARQUE): RapportMarque {
  const manquants: ChampMarque[] = []
  const exemples: ChampMarque[] = []

  for (const regle of reglesPour(marque)) {
    if (regle.valeur.trim().length === 0) {
      manquants.push({
        chemin: regle.chemin,
        variable: regle.variable,
        niveau: 'manquant',
        usage: regle.usage,
      })
      continue
    }
    if (regle.gabarit.length > 0 && regle.valeur === regle.gabarit) {
      exemples.push({
        chemin: regle.chemin,
        variable: regle.variable,
        niveau: 'exemple',
        usage: regle.usage,
      })
    }
  }

  return {
    complete: manquants.length === 0 && exemples.length === 0,
    manquants,
    exemples,
  }
}

/**
 * Journalise en clair ce qui n'est pas renseigné. Un message par champ, avec la
 * variable à définir et l'endroit où l'absence est visible.
 */
export function journaliserMarque(
  rapport: RapportMarque = verifierMarque(),
  journal: (message: string) => void = (message: string): void => {
    console.warn(message)
  }
): void {
  if (rapport.complete) return

  for (const champ of rapport.manquants) {
    journal(
      `[marque] ${champ.chemin} non renseigné — définir ${champ.variable} (${champ.usage}).`
    )
  }
  for (const champ of rapport.exemples) {
    journal(
      `[marque] ${champ.chemin} est encore le gabarit de démonstration — définir ${champ.variable} avant mise en service (${champ.usage}).`
    )
  }
}

/**
 * Jetons CSS dérivés de la palette. Les noms correspondent aux variables
 * réellement consommées par les feuilles de style de la distribution, dont
 * les pastels renommés `--marque-pastel-*`.
 */
export function variablesCssMarque(
  palette: PaletteMarque = MARQUE.palette
): Readonly<Record<string, string>> {
  return {
    '--primary': palette.primaire,
    '--primary-light': palette.primaireClaire,
    '--primary-dark': palette.primaireFoncee,
    '--accent': palette.accent,
    '--success': palette.succes,
    '--warning': palette.avertissement,
    '--destructive': palette.danger,
    '--background': palette.fond,
    '--foreground': palette.texte,
    '--marque-pastel-violet': palette.pastelViolet,
    '--marque-pastel-blue': palette.pastelBleu,
    '--marque-pastel-cyan': palette.pastelCyan,
    '--marque-pastel-orange': palette.pastelOrange,
  }
}

/** Applique la palette sur un élément (typiquement `document.documentElement`). */
export function appliquerPaletteMarque(
  cible: HTMLElement,
  palette: PaletteMarque = MARQUE.palette
): void {
  const variables = variablesCssMarque(palette)
  for (const [nom, valeur] of Object.entries(variables)) {
    cible.style.setProperty(nom, valeur)
  }
}
