/**
 * OpenPulse — abstraction des fournisseurs de modeles de langage.
 *
 * Un seul contrat (completion, completion en flux, embeddings, transcription)
 * et quatre implementations interchangeables, choisies par variable
 * d'environnement :
 *
 *   VITE_IA_FOURNISSEUR (navigateur) / IA_FOURNISSEUR (serveur)
 *     openai-compatible | azure-openai | anthropic | ollama | aucun
 *
 * Trois regles de conception, non negociables pour une distribution
 * auto-hebergeable :
 *
 * 1. AUCUN nom de deploiement, de modele ni d'hote n'est ecrit en dur. Sur un
 *    service Azure OpenAI, le « modele » EST le nom du deploiement cree par
 *    l'organisation : il n'existe aucune valeur par defaut raisonnable. Son
 *    absence produit donc un etat « configuration incomplete » explicite, et
 *    jamais une URL devinee qui echouerait en 404 sans explication.
 *
 * 2. Ce module ne leve JAMAIS d'exception au chargement, et
 *    `obtenirFournisseurIA()` n'en leve pas davantage : quand rien n'est
 *    configure, elle renvoie un fournisseur absent qui echoue proprement au
 *    moment de l'appel, avec le code `non_configure`. Une page peut donc
 *    importer ce fichier sans risque d'ecran blanc.
 *
 * 3. La cle d'API n'est jamais lue depuis une variable `VITE_*` : tout ce qui
 *    porte ce prefixe est inline dans le paquet JavaScript et devient public.
 *    Elle se lit uniquement dans `IA_CLE_API`, cote serveur. Dans le
 *    navigateur, on vise donc soit un relais de meme origine
 *    (`VITE_IA_URL_BASE=/api/ia`), soit un service local sans cle (Ollama).
 */

// ---------------------------------------------------------------------------
// Contrat public
// ---------------------------------------------------------------------------

export type TypeFournisseurIA =
  | 'openai-compatible'
  | 'azure-openai'
  | 'anthropic'
  | 'ollama'
  | 'aucun'

export type TypeFournisseurActif = Exclude<TypeFournisseurIA, 'aucun'>

export const TYPES_FOURNISSEUR_IA: readonly TypeFournisseurIA[] = [
  'openai-compatible',
  'azure-openai',
  'anthropic',
  'ollama',
  'aucun',
]

export type CapaciteIA = 'completion' | 'flux' | 'embeddings' | 'transcription'

export type RoleMessageIA = 'systeme' | 'utilisateur' | 'assistant'

export interface MessageIA {
  readonly role: RoleMessageIA
  readonly contenu: string
}

export interface OptionsCompletion {
  /** Surcharge ponctuelle du modele (ou du deploiement, sur Azure OpenAI). */
  readonly modele?: string | undefined
  readonly temperature?: number | undefined
  readonly jetonsMaximum?: number | undefined
  /** Demande une reponse strictement JSON quand le fournisseur le permet. */
  readonly formatJson?: boolean | undefined
  readonly signal?: AbortSignal | undefined
  readonly delaiMs?: number | undefined
}

export interface UsageJetons {
  readonly jetonsEntree: number | null
  readonly jetonsSortie: number | null
  readonly jetonsTotal: number | null
}

export interface ResultatCompletion {
  readonly contenu: string
  readonly modele: string
  readonly usage: UsageJetons
}

/** Fragment emis par la completion en flux. `termine` marque la fin propre. */
export interface FragmentFlux {
  readonly texte: string
  readonly termine: boolean
}

export interface OptionsEmbeddings {
  readonly modele?: string | undefined
  readonly signal?: AbortSignal | undefined
  readonly delaiMs?: number | undefined
}

export interface ResultatEmbeddings {
  readonly vecteurs: readonly (readonly number[])[]
  readonly modele: string
  readonly dimensions: number
}

export interface EntreeTranscription {
  readonly donnees: Blob
  readonly nomFichier: string
  /** Code de langue BCP 47 abrege, par exemple « fr ». */
  readonly langue?: string | undefined
}

export interface OptionsTranscription {
  readonly modele?: string | undefined
  readonly signal?: AbortSignal | undefined
  readonly delaiMs?: number | undefined
}

export interface ResultatTranscription {
  readonly texte: string
  readonly modele: string
}

export interface FournisseurIA {
  readonly identifiant: TypeFournisseurIA
  /** Modele (ou deploiement) de conversation actif ; `null` si non configure. */
  readonly modeleConversation: string | null
  supporte(capacite: CapaciteIA): boolean
  completion(
    messages: readonly MessageIA[],
    options?: OptionsCompletion
  ): Promise<ResultatCompletion>
  completionEnFlux(
    messages: readonly MessageIA[],
    options?: OptionsCompletion
  ): AsyncIterable<FragmentFlux>
  embeddings(textes: readonly string[], options?: OptionsEmbeddings): Promise<ResultatEmbeddings>
  transcription(
    entree: EntreeTranscription,
    options?: OptionsTranscription
  ): Promise<ResultatTranscription>
}

// ---------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------

export type CodeErreurIA =
  | 'non_configure'
  | 'capacite_absente'
  | 'authentification'
  | 'quota'
  | 'delai_depasse'
  | 'annule'
  | 'reponse_invalide'
  | 'reseau'
  | 'amont'

export interface OptionsErreurIA {
  readonly fournisseur?: TypeFournisseurIA | undefined
  readonly statutHttp?: number | undefined
  readonly causeOriginale?: unknown
}

/**
 * Erreur unique de la couche IA. `code` est stable et destine au code appelant
 * (choix du message affiche, decision de reessai) ; `message` est destine aux
 * journaux et ne contient jamais de secret.
 */
export class ErreurIA extends Error {
  readonly code: CodeErreurIA
  readonly fournisseur: TypeFournisseurIA | null
  readonly statutHttp: number | null
  readonly causeOriginale: unknown

  constructor(code: CodeErreurIA, message: string, options: OptionsErreurIA = {}) {
    super(message)
    this.name = 'ErreurIA'
    this.code = code
    this.fournisseur = options.fournisseur ?? null
    this.statutHttp = options.statutHttp ?? null
    this.causeOriginale = options.causeOriginale
  }
}

export function estErreurIA(valeur: unknown): valeur is ErreurIA {
  return valeur instanceof ErreurIA
}

// ---------------------------------------------------------------------------
// Lecture de l'environnement
// ---------------------------------------------------------------------------

export type SourceEnvironnement = Readonly<Record<string, string | undefined>>

function lireEnvironnementVite(): SourceEnvironnement {
  try {
    return (import.meta.env ?? {}) as unknown as SourceEnvironnement
  } catch {
    // Contexte d'execution sans `import.meta` (outillage, script Node).
    return {}
  }
}

function lireEnvironnementProcessus(): SourceEnvironnement {
  const portee = globalThis as {
    process?: { env?: Record<string, string | undefined> }
  }
  return portee.process?.env ?? {}
}

/** Fusion des deux sources : le build Vite gagne dans le navigateur. */
export function environnementParDefaut(): SourceEnvironnement {
  return { ...lireEnvironnementProcessus(), ...lireEnvironnementVite() }
}

/**
 * Suffixes lus avec le prefixe `VITE_IA_` puis `IA_`. Volontairement, la cle
 * d'API n'est pas dans cette liste : voir `lireCleApi`.
 */
const PREFIXES_PUBLICS: readonly string[] = ['VITE_IA_', 'IA_']

function lireVariablePublique(env: SourceEnvironnement, suffixe: string): string {
  for (const prefixe of PREFIXES_PUBLICS) {
    const brut = env[`${prefixe}${suffixe}`]
    if (typeof brut === 'string' && brut.trim() !== '') return brut.trim()
  }
  return ''
}

/** La cle ne se lit que sans prefixe `VITE_`, pour ne jamais entrer au bundle. */
function lireCleApi(env: SourceEnvironnement): string {
  const brut = env['IA_CLE_API']
  return typeof brut === 'string' && brut.trim() !== '' ? brut.trim() : ''
}

// ---------------------------------------------------------------------------
// Configuration resolue
// ---------------------------------------------------------------------------

export interface ConfigurationIA {
  readonly type: TypeFournisseurActif
  /** Sans barre oblique finale. Une valeur commencant par « / » est un relais. */
  readonly urlBase: string
  readonly cleApi: string | null
  readonly modeleConversation: string
  readonly modeleEmbeddings: string | null
  readonly modeleTranscription: string | null
  readonly versionApi: string | null
  readonly delaiMs: number
}

export interface VariableManquante {
  readonly nom: string
  readonly explication: string
}

export type ResolutionConfigurationIA =
  | { readonly statut: 'ok'; readonly configuration: ConfigurationIA }
  | { readonly statut: 'desactive'; readonly raison: string }
  | {
      readonly statut: 'incomplet'
      readonly raison: string
      readonly manquantes: readonly VariableManquante[]
    }

const DELAI_PAR_DEFAUT_MS = 90_000
const VERSION_ANTHROPIC_PAR_DEFAUT = '2023-06-01'
/** Boucle locale : seule valeur par defaut acceptable, aucune donnee ne sort. */
const URL_OLLAMA_PAR_DEFAUT = 'http://127.0.0.1:11434/v1'
const URL_ANTHROPIC_PAR_DEFAUT = 'https://api.anthropic.com'

function estTypeFournisseur(valeur: string): valeur is TypeFournisseurIA {
  return (TYPES_FOURNISSEUR_IA as readonly string[]).includes(valeur)
}

function normaliserUrl(brut: string): string {
  return brut.replace(/\/+$/, '')
}

/** Un chemin relatif designe un relais servi par la meme origine que l'app. */
function estRelaisMemeOrigine(urlBase: string): boolean {
  return urlBase.startsWith('/')
}

function lireEntier(brut: string, repli: number): number {
  const valeur = Number.parseInt(brut, 10)
  return Number.isFinite(valeur) && valeur > 0 ? valeur : repli
}

/**
 * Deduit la configuration depuis l'environnement. Ne leve jamais : elle decrit
 * l'etat, y compris incomplet, pour que l'interface puisse l'expliquer.
 */
export function resoudreConfigurationIA(
  env: SourceEnvironnement = environnementParDefaut()
): ResolutionConfigurationIA {
  const typeBrut = lireVariablePublique(env, 'FOURNISSEUR')

  if (typeBrut === '') {
    return {
      statut: 'desactive',
      raison:
        "Aucun fournisseur de modeles de langage n'est declare. Definir VITE_IA_FOURNISSEUR pour activer les fonctions d'assistance.",
    }
  }

  if (!estTypeFournisseur(typeBrut)) {
    return {
      statut: 'incomplet',
      raison: `Fournisseur « ${typeBrut} » inconnu. Valeurs acceptees : ${TYPES_FOURNISSEUR_IA.join(', ')}.`,
      manquantes: [
        {
          nom: 'VITE_IA_FOURNISSEUR',
          explication: `Une des valeurs suivantes : ${TYPES_FOURNISSEUR_IA.join(', ')}.`,
        },
      ],
    }
  }

  if (typeBrut === 'aucun') {
    return {
      statut: 'desactive',
      raison:
        'Les fonctions de modeles de langage sont volontairement desactivees (VITE_IA_FOURNISSEUR=aucun).',
    }
  }

  const type: TypeFournisseurActif = typeBrut
  const manquantes: VariableManquante[] = []

  const urlBrute = lireVariablePublique(env, 'URL_BASE')
  let urlBase = normaliserUrl(urlBrute)
  if (urlBase === '') {
    if (type === 'ollama') urlBase = URL_OLLAMA_PAR_DEFAUT
    else if (type === 'anthropic') urlBase = URL_ANTHROPIC_PAR_DEFAUT
    else {
      manquantes.push({
        nom: 'VITE_IA_URL_BASE',
        explication:
          type === 'azure-openai'
            ? 'Racine du service Azure OpenAI de votre organisation, sans chemin (le deploiement est ajoute automatiquement).'
            : "Racine de l'API compatible OpenAI, par exemple https://ia.example.org/v1, ou un chemin de relais local comme /api/ia.",
      })
    }
  }

  const modeleConversation = lireVariablePublique(env, 'MODELE_CONVERSATION')
  if (modeleConversation === '') {
    manquantes.push({
      nom: 'VITE_IA_MODELE_CONVERSATION',
      explication:
        type === 'azure-openai'
          ? "Nom du deploiement de conversation cree dans votre service Azure OpenAI. Aucune valeur par defaut n'est possible : ce nom vous est propre."
          : 'Identifiant du modele de conversation servi par votre fournisseur.',
    })
  }

  const versionBrute = lireVariablePublique(env, 'VERSION_API')
  let versionApi: string | null = versionBrute === '' ? null : versionBrute
  if (type === 'azure-openai' && versionApi === null) {
    manquantes.push({
      nom: 'VITE_IA_VERSION_API',
      explication:
        'Valeur du parametre api-version exige par le service Azure OpenAI (elle depend de la version deployee chez vous).',
    })
  }
  if (type === 'anthropic' && versionApi === null) {
    versionApi = VERSION_ANTHROPIC_PAR_DEFAUT
  }

  const cleBrute = lireCleApi(env)
  const cleApi = cleBrute === '' ? null : cleBrute
  const cleNecessaire = type !== 'ollama' && !estRelaisMemeOrigine(urlBase) && cleApi === null
  if (cleNecessaire) {
    manquantes.push({
      nom: 'IA_CLE_API',
      explication:
        "Cle d'API du fournisseur. Elle se configure cote serveur uniquement : ne jamais utiliser de nom commencant par VITE_, qui serait publie dans le paquet JavaScript. Dans le navigateur, viser plutot un relais de meme origine via VITE_IA_URL_BASE=/api/ia.",
    })
  }

  if (manquantes.length > 0) {
    return {
      statut: 'incomplet',
      raison: `Le fournisseur « ${type} » est declare mais sa configuration est incomplete.`,
      manquantes,
    }
  }

  const modeleEmbeddings = lireVariablePublique(env, 'MODELE_EMBEDDINGS')
  const modeleTranscription = lireVariablePublique(env, 'MODELE_TRANSCRIPTION')

  return {
    statut: 'ok',
    configuration: {
      type,
      urlBase,
      cleApi,
      modeleConversation,
      modeleEmbeddings: modeleEmbeddings === '' ? null : modeleEmbeddings,
      modeleTranscription: modeleTranscription === '' ? null : modeleTranscription,
      versionApi,
      delaiMs: lireEntier(lireVariablePublique(env, 'DELAI_MS'), DELAI_PAR_DEFAUT_MS),
    },
  }
}

// ---------------------------------------------------------------------------
// Outillage HTTP et lecture defensive du JSON
// ---------------------------------------------------------------------------

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

function chaineOuNull(valeur: unknown): string | null {
  return typeof valeur === 'string' ? valeur : null
}

function nombreOuNull(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null
}

function analyserJson(brut: string): unknown {
  try {
    return JSON.parse(brut) as unknown
  } catch {
    return null
  }
}

function estAbandon(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    chaineOuNull((cause as { name?: unknown }).name) === 'AbortError'
  )
}

function erreurDepuisStatut(
  statut: number,
  detail: string,
  fournisseur: TypeFournisseurIA
): ErreurIA {
  const options: OptionsErreurIA = { fournisseur, statutHttp: statut }
  if (statut === 401 || statut === 403) {
    return new ErreurIA(
      'authentification',
      `Le fournisseur a refuse l'authentification (HTTP ${statut}). Verifier IA_CLE_API cote serveur.`,
      options
    )
  }
  if (statut === 429) {
    return new ErreurIA(
      'quota',
      `Quota ou debit depasse chez le fournisseur (HTTP ${statut}).`,
      options
    )
  }
  if (statut === 408 || statut === 504) {
    return new ErreurIA('delai_depasse', `Le fournisseur a expire (HTTP ${statut}).`, options)
  }
  if (statut === 404) {
    return new ErreurIA(
      'amont',
      `Cible introuvable chez le fournisseur (HTTP 404). Sur un service Azure OpenAI, cela signifie presque toujours un nom de deploiement absent ou errone. Detail : ${detail}`,
      options
    )
  }
  return new ErreurIA(
    'amont',
    `Le fournisseur a repondu HTTP ${statut}. Detail : ${detail}`,
    options
  )
}

async function lireDetailErreur(reponse: Response): Promise<string> {
  try {
    const texte = await reponse.text()
    return texte.slice(0, 400)
  } catch {
    return '(corps de reponse illisible)'
  }
}

interface RequeteIA {
  readonly url: string
  readonly entetes: Readonly<Record<string, string>>
  readonly corps: BodyInit
  readonly signal: AbortSignal | undefined
  readonly delaiMs: number
  readonly fournisseur: TypeFournisseurIA
}

async function envoyer(requete: RequeteIA): Promise<Response> {
  const controleur = new AbortController()
  const minuterie: ReturnType<typeof setTimeout> = setTimeout(() => {
    controleur.abort()
  }, requete.delaiMs)
  const externe = requete.signal
  const relais = (): void => {
    controleur.abort()
  }

  if (externe !== undefined) {
    if (externe.aborted) {
      clearTimeout(minuterie)
      throw new ErreurIA('annule', "Appel annule avant l'envoi.", {
        fournisseur: requete.fournisseur,
      })
    }
    externe.addEventListener('abort', relais, { once: true })
  }

  try {
    const reponse = await fetch(requete.url, {
      method: 'POST',
      headers: { ...requete.entetes },
      body: requete.corps,
      signal: controleur.signal,
    })
    if (!reponse.ok) {
      const detail = await lireDetailErreur(reponse)
      throw erreurDepuisStatut(reponse.status, detail, requete.fournisseur)
    }
    return reponse
  } catch (cause) {
    if (cause instanceof ErreurIA) throw cause
    if (externe !== undefined && externe.aborted) {
      throw new ErreurIA('annule', "Appel annule par l'appelant.", {
        fournisseur: requete.fournisseur,
        causeOriginale: cause,
      })
    }
    if (estAbandon(cause)) {
      throw new ErreurIA(
        'delai_depasse',
        `Le fournisseur n'a pas repondu en moins de ${requete.delaiMs} ms.`,
        { fournisseur: requete.fournisseur, causeOriginale: cause }
      )
    }
    throw new ErreurIA(
      'reseau',
      'Le fournisseur de modeles est injoignable depuis cet environnement.',
      { fournisseur: requete.fournisseur, causeOriginale: cause }
    )
  } finally {
    clearTimeout(minuterie)
    if (externe !== undefined) externe.removeEventListener('abort', relais)
  }
}

async function lireJson(reponse: Response, fournisseur: TypeFournisseurIA): Promise<unknown> {
  const brut = await reponse.text()
  const charge = analyserJson(brut)
  if (charge === null) {
    throw new ErreurIA('reponse_invalide', "La reponse du fournisseur n'est pas du JSON.", {
      fournisseur,
    })
  }
  return charge
}

/** Decoupe un flux « server-sent events » et emet les charges utiles brutes. */
async function* lireEvenementsSse(
  reponse: Response,
  fournisseur: TypeFournisseurIA
): AsyncGenerator<string, void, undefined> {
  const flux = reponse.body
  if (flux === null) {
    throw new ErreurIA('reponse_invalide', 'Le fournisseur a repondu sans corps de flux.', {
      fournisseur,
    })
  }
  const lecteur = flux.getReader()
  const decodeur = new TextDecoder()
  let tampon = ''
  try {
    for (;;) {
      const morceau = await lecteur.read()
      if (morceau.done) break
      tampon += decodeur.decode(morceau.value, { stream: true })
      let coupure = tampon.indexOf('\n')
      while (coupure !== -1) {
        const ligne = tampon.slice(0, coupure).trim()
        tampon = tampon.slice(coupure + 1)
        if (ligne.startsWith('data:')) {
          const charge = ligne.slice(5).trim()
          if (charge !== '' && charge !== '[DONE]') yield charge
        }
        coupure = tampon.indexOf('\n')
      }
    }
  } finally {
    try {
      await lecteur.cancel()
    } catch {
      // Flux deja clos par le fournisseur : rien a faire.
    }
  }
}

// ---------------------------------------------------------------------------
// Extraction des reponses
// ---------------------------------------------------------------------------

const USAGE_VIDE: UsageJetons = { jetonsEntree: null, jetonsSortie: null, jetonsTotal: null }

function usageOpenAI(charge: unknown): UsageJetons {
  if (!estObjet(charge)) return USAGE_VIDE
  const usage = charge['usage']
  if (!estObjet(usage)) return USAGE_VIDE
  return {
    jetonsEntree: nombreOuNull(usage['prompt_tokens']),
    jetonsSortie: nombreOuNull(usage['completion_tokens']),
    jetonsTotal: nombreOuNull(usage['total_tokens']),
  }
}

function usageAnthropic(charge: unknown): UsageJetons {
  if (!estObjet(charge)) return USAGE_VIDE
  const usage = charge['usage']
  if (!estObjet(usage)) return USAGE_VIDE
  const entree = nombreOuNull(usage['input_tokens'])
  const sortie = nombreOuNull(usage['output_tokens'])
  return {
    jetonsEntree: entree,
    jetonsSortie: sortie,
    jetonsTotal: entree !== null && sortie !== null ? entree + sortie : null,
  }
}

function premierChoix(charge: unknown): Record<string, unknown> | null {
  if (!estObjet(charge)) return null
  const choix = charge['choices']
  if (!Array.isArray(choix) || choix.length === 0) return null
  const premier: unknown = choix[0]
  return estObjet(premier) ? premier : null
}

function contenuOpenAI(charge: unknown): string | null {
  const choix = premierChoix(charge)
  if (choix === null) return null
  const message = choix['message']
  if (!estObjet(message)) return null
  return chaineOuNull(message['content'])
}

function deltaOpenAI(charge: unknown): string | null {
  const choix = premierChoix(charge)
  if (choix === null) return null
  const delta = choix['delta']
  if (!estObjet(delta)) return null
  return chaineOuNull(delta['content'])
}

function contenuAnthropic(charge: unknown): string | null {
  if (!estObjet(charge)) return null
  const blocs = charge['content']
  if (!Array.isArray(blocs)) return null
  const morceaux: string[] = []
  for (const bloc of blocs) {
    if (!estObjet(bloc)) continue
    const texte = chaineOuNull(bloc['text'])
    if (texte !== null) morceaux.push(texte)
  }
  return morceaux.length > 0 ? morceaux.join('') : null
}

function deltaAnthropic(charge: unknown): string | null {
  if (!estObjet(charge)) return null
  if (chaineOuNull(charge['type']) !== 'content_block_delta') return null
  const delta = charge['delta']
  if (!estObjet(delta)) return null
  return chaineOuNull(delta['text'])
}

function vecteursOpenAI(charge: unknown): number[][] | null {
  if (!estObjet(charge)) return null
  const donnees = charge['data']
  if (!Array.isArray(donnees)) return null
  const vecteurs: number[][] = []
  for (const element of donnees) {
    if (!estObjet(element)) return null
    const brut = element['embedding']
    if (!Array.isArray(brut)) return null
    const vecteur: number[] = []
    for (const composante of brut) {
      if (typeof composante !== 'number' || !Number.isFinite(composante)) return null
      vecteur.push(composante)
    }
    vecteurs.push(vecteur)
  }
  return vecteurs
}

function texteTranscription(charge: unknown): string | null {
  if (!estObjet(charge)) return null
  return chaineOuNull(charge['text'])
}

// ---------------------------------------------------------------------------
// Construction des requetes par famille de fournisseur
// ---------------------------------------------------------------------------

function roleOpenAI(role: RoleMessageIA): 'system' | 'user' | 'assistant' {
  if (role === 'systeme') return 'system'
  if (role === 'assistant') return 'assistant'
  return 'user'
}

interface CibleHttp {
  readonly url: string
  readonly entetes: Record<string, string>
}

function cibleCompatibleOpenAI(config: ConfigurationIA, chemin: string): CibleHttp {
  const entetes: Record<string, string> = {}
  if (config.cleApi !== null) entetes['Authorization'] = `Bearer ${config.cleApi}`
  return { url: `${config.urlBase}${chemin}`, entetes }
}

function cibleAzure(config: ConfigurationIA, deploiement: string, chemin: string): CibleHttp {
  const entetes: Record<string, string> = {}
  if (config.cleApi !== null) entetes['api-key'] = config.cleApi
  const version = config.versionApi ?? ''
  const url = `${config.urlBase}/openai/deployments/${encodeURIComponent(deploiement)}${chemin}?api-version=${encodeURIComponent(version)}`
  return { url, entetes }
}

function cibleAnthropic(config: ConfigurationIA): CibleHttp {
  const entetes: Record<string, string> = {
    'anthropic-version': config.versionApi ?? VERSION_ANTHROPIC_PAR_DEFAUT,
  }
  if (config.cleApi !== null) entetes['x-api-key'] = config.cleApi
  return { url: `${config.urlBase}/v1/messages`, entetes }
}

function corpsOpenAI(
  modele: string,
  messages: readonly MessageIA[],
  options: OptionsCompletion,
  flux: boolean
): string {
  const charge: Record<string, unknown> = {
    model: modele,
    messages: messages.map((message) => ({
      role: roleOpenAI(message.role),
      content: message.contenu,
    })),
    stream: flux,
  }
  if (options.temperature !== undefined) charge['temperature'] = options.temperature
  if (options.jetonsMaximum !== undefined) charge['max_tokens'] = options.jetonsMaximum
  if (options.formatJson === true) charge['response_format'] = { type: 'json_object' }
  return JSON.stringify(charge)
}

function corpsAnthropic(
  modele: string,
  messages: readonly MessageIA[],
  options: OptionsCompletion,
  flux: boolean
): string {
  const consignes = messages
    .filter((message) => message.role === 'systeme')
    .map((message) => message.contenu)
    .join('\n\n')
  const echanges = messages
    .filter((message) => message.role !== 'systeme')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.contenu,
    }))
  const charge: Record<string, unknown> = {
    model: modele,
    messages: echanges,
    max_tokens: options.jetonsMaximum ?? 4096,
    stream: flux,
  }
  if (consignes !== '') charge['system'] = consignes
  if (options.temperature !== undefined) charge['temperature'] = options.temperature
  return JSON.stringify(charge)
}

function corpsEmbeddings(modele: string, textes: readonly string[], avecModele: boolean): string {
  const charge: Record<string, unknown> = { input: [...textes] }
  if (avecModele) charge['model'] = modele
  return JSON.stringify(charge)
}

function corpsTranscription(
  entree: EntreeTranscription,
  modele: string,
  avecModele: boolean
): FormData {
  const formulaire = new FormData()
  formulaire.append('file', entree.donnees, entree.nomFichier)
  if (avecModele) formulaire.append('model', modele)
  if (entree.langue !== undefined && entree.langue !== '') {
    formulaire.append('language', entree.langue)
  }
  return formulaire
}

// ---------------------------------------------------------------------------
// Implementation : service compatible OpenAI (et Ollama, meme surface /v1)
// ---------------------------------------------------------------------------

class FournisseurCompatibleOpenAI implements FournisseurIA {
  readonly identifiant: TypeFournisseurIA
  private readonly config: ConfigurationIA

  constructor(config: ConfigurationIA) {
    this.config = config
    this.identifiant = config.type
  }

  get modeleConversation(): string | null {
    return this.config.modeleConversation
  }

  supporte(capacite: CapaciteIA): boolean {
    if (capacite === 'completion' || capacite === 'flux') return true
    if (capacite === 'embeddings') return this.config.modeleEmbeddings !== null
    // Ollama n'expose pas de transcription : seule une API compatible OpenAI
    // au sens strict peut servir /audio/transcriptions.
    if (capacite === 'transcription') {
      return this.identifiant === 'openai-compatible' && this.config.modeleTranscription !== null
    }
    return false
  }

  async completion(
    messages: readonly MessageIA[],
    options: OptionsCompletion = {}
  ): Promise<ResultatCompletion> {
    const modele = options.modele ?? this.config.modeleConversation
    const cible = cibleCompatibleOpenAI(this.config, '/chat/completions')
    const reponse = await envoyer({
      url: cible.url,
      entetes: { ...cible.entetes, 'Content-Type': 'application/json' },
      corps: corpsOpenAI(modele, messages, options, false),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    const charge = await lireJson(reponse, this.identifiant)
    const contenu = contenuOpenAI(charge)
    if (contenu === null) {
      throw new ErreurIA(
        'reponse_invalide',
        'La reponse ne contient pas de champ choices[0].message.content exploitable.',
        { fournisseur: this.identifiant }
      )
    }
    return { contenu, modele, usage: usageOpenAI(charge) }
  }

  async *completionEnFlux(
    messages: readonly MessageIA[],
    options: OptionsCompletion = {}
  ): AsyncGenerator<FragmentFlux, void, undefined> {
    const modele = options.modele ?? this.config.modeleConversation
    const cible = cibleCompatibleOpenAI(this.config, '/chat/completions')
    const reponse = await envoyer({
      url: cible.url,
      entetes: {
        ...cible.entetes,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      corps: corpsOpenAI(modele, messages, options, true),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    for await (const brut of lireEvenementsSse(reponse, this.identifiant)) {
      const texte = deltaOpenAI(analyserJson(brut))
      if (texte !== null && texte !== '') yield { texte, termine: false }
    }
    yield { texte: '', termine: true }
  }

  async embeddings(
    textes: readonly string[],
    options: OptionsEmbeddings = {}
  ): Promise<ResultatEmbeddings> {
    const modele = options.modele ?? this.config.modeleEmbeddings
    if (modele === null) {
      throw new ErreurIA(
        'non_configure',
        'Aucun modele d embeddings configure : definir VITE_IA_MODELE_EMBEDDINGS.',
        { fournisseur: this.identifiant }
      )
    }
    const cible = cibleCompatibleOpenAI(this.config, '/embeddings')
    const reponse = await envoyer({
      url: cible.url,
      entetes: { ...cible.entetes, 'Content-Type': 'application/json' },
      corps: corpsEmbeddings(modele, textes, true),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    const vecteurs = vecteursOpenAI(await lireJson(reponse, this.identifiant))
    if (vecteurs === null || vecteurs.length === 0) {
      throw new ErreurIA('reponse_invalide', 'La reponse ne contient aucun vecteur exploitable.', {
        fournisseur: this.identifiant,
      })
    }
    return { vecteurs, modele, dimensions: vecteurs[0].length }
  }

  async transcription(
    entree: EntreeTranscription,
    options: OptionsTranscription = {}
  ): Promise<ResultatTranscription> {
    const modele = options.modele ?? this.config.modeleTranscription
    if (modele === null || !this.supporte('transcription')) {
      throw new ErreurIA(
        'capacite_absente',
        `Le fournisseur « ${this.identifiant} » n'offre pas de transcription vocale dans cette configuration.`,
        { fournisseur: this.identifiant }
      )
    }
    const cible = cibleCompatibleOpenAI(this.config, '/audio/transcriptions')
    const reponse = await envoyer({
      url: cible.url,
      entetes: cible.entetes,
      corps: corpsTranscription(entree, modele, true),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    const texte = texteTranscription(await lireJson(reponse, this.identifiant))
    if (texte === null) {
      throw new ErreurIA(
        'reponse_invalide',
        'La reponse de transcription ne contient pas de texte.',
        {
          fournisseur: this.identifiant,
        }
      )
    }
    return { texte, modele }
  }
}

// ---------------------------------------------------------------------------
// Implementation : service Azure OpenAI (le modele EST le nom du deploiement)
// ---------------------------------------------------------------------------

class FournisseurAzureOpenAI implements FournisseurIA {
  readonly identifiant: TypeFournisseurIA = 'azure-openai'
  private readonly config: ConfigurationIA

  constructor(config: ConfigurationIA) {
    this.config = config
  }

  get modeleConversation(): string | null {
    return this.config.modeleConversation
  }

  supporte(capacite: CapaciteIA): boolean {
    if (capacite === 'completion' || capacite === 'flux') return true
    if (capacite === 'embeddings') return this.config.modeleEmbeddings !== null
    if (capacite === 'transcription') return this.config.modeleTranscription !== null
    return false
  }

  async completion(
    messages: readonly MessageIA[],
    options: OptionsCompletion = {}
  ): Promise<ResultatCompletion> {
    const deploiement = options.modele ?? this.config.modeleConversation
    const cible = cibleAzure(this.config, deploiement, '/chat/completions')
    const reponse = await envoyer({
      url: cible.url,
      entetes: { ...cible.entetes, 'Content-Type': 'application/json' },
      corps: corpsOpenAI(deploiement, messages, options, false),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    const charge = await lireJson(reponse, this.identifiant)
    const contenu = contenuOpenAI(charge)
    if (contenu === null) {
      throw new ErreurIA(
        'reponse_invalide',
        'La reponse du deploiement ne contient pas de contenu exploitable.',
        { fournisseur: this.identifiant }
      )
    }
    return { contenu, modele: deploiement, usage: usageOpenAI(charge) }
  }

  async *completionEnFlux(
    messages: readonly MessageIA[],
    options: OptionsCompletion = {}
  ): AsyncGenerator<FragmentFlux, void, undefined> {
    const deploiement = options.modele ?? this.config.modeleConversation
    const cible = cibleAzure(this.config, deploiement, '/chat/completions')
    const reponse = await envoyer({
      url: cible.url,
      entetes: {
        ...cible.entetes,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      corps: corpsOpenAI(deploiement, messages, options, true),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    for await (const brut of lireEvenementsSse(reponse, this.identifiant)) {
      const texte = deltaOpenAI(analyserJson(brut))
      if (texte !== null && texte !== '') yield { texte, termine: false }
    }
    yield { texte: '', termine: true }
  }

  async embeddings(
    textes: readonly string[],
    options: OptionsEmbeddings = {}
  ): Promise<ResultatEmbeddings> {
    const deploiement = options.modele ?? this.config.modeleEmbeddings
    if (deploiement === null) {
      throw new ErreurIA(
        'non_configure',
        'Aucun deploiement d embeddings configure : definir VITE_IA_MODELE_EMBEDDINGS avec le nom du deploiement cree dans votre service.',
        { fournisseur: this.identifiant }
      )
    }
    const cible = cibleAzure(this.config, deploiement, '/embeddings')
    const reponse = await envoyer({
      url: cible.url,
      entetes: { ...cible.entetes, 'Content-Type': 'application/json' },
      // Sur Azure, le deploiement est deja dans l'URL : pas de champ `model`.
      corps: corpsEmbeddings(deploiement, textes, false),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    const vecteurs = vecteursOpenAI(await lireJson(reponse, this.identifiant))
    if (vecteurs === null || vecteurs.length === 0) {
      throw new ErreurIA('reponse_invalide', 'La reponse ne contient aucun vecteur exploitable.', {
        fournisseur: this.identifiant,
      })
    }
    return { vecteurs, modele: deploiement, dimensions: vecteurs[0].length }
  }

  async transcription(
    entree: EntreeTranscription,
    options: OptionsTranscription = {}
  ): Promise<ResultatTranscription> {
    const deploiement = options.modele ?? this.config.modeleTranscription
    if (deploiement === null) {
      throw new ErreurIA(
        'non_configure',
        'Aucun deploiement de transcription configure : definir VITE_IA_MODELE_TRANSCRIPTION.',
        { fournisseur: this.identifiant }
      )
    }
    const cible = cibleAzure(this.config, deploiement, '/audio/transcriptions')
    const reponse = await envoyer({
      url: cible.url,
      entetes: cible.entetes,
      corps: corpsTranscription(entree, deploiement, false),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    const texte = texteTranscription(await lireJson(reponse, this.identifiant))
    if (texte === null) {
      throw new ErreurIA(
        'reponse_invalide',
        'La reponse de transcription ne contient pas de texte.',
        {
          fournisseur: this.identifiant,
        }
      )
    }
    return { texte, modele: deploiement }
  }
}

// ---------------------------------------------------------------------------
// Implementation : service Anthropic (ni embeddings ni transcription)
// ---------------------------------------------------------------------------

class FournisseurAnthropic implements FournisseurIA {
  readonly identifiant: TypeFournisseurIA = 'anthropic'
  private readonly config: ConfigurationIA

  constructor(config: ConfigurationIA) {
    this.config = config
  }

  get modeleConversation(): string | null {
    return this.config.modeleConversation
  }

  supporte(capacite: CapaciteIA): boolean {
    return capacite === 'completion' || capacite === 'flux'
  }

  async completion(
    messages: readonly MessageIA[],
    options: OptionsCompletion = {}
  ): Promise<ResultatCompletion> {
    const modele = options.modele ?? this.config.modeleConversation
    const cible = cibleAnthropic(this.config)
    const reponse = await envoyer({
      url: cible.url,
      entetes: { ...cible.entetes, 'Content-Type': 'application/json' },
      corps: corpsAnthropic(modele, messages, options, false),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    const charge = await lireJson(reponse, this.identifiant)
    const contenu = contenuAnthropic(charge)
    if (contenu === null) {
      throw new ErreurIA('reponse_invalide', 'La reponse ne contient aucun bloc de texte.', {
        fournisseur: this.identifiant,
      })
    }
    return { contenu, modele, usage: usageAnthropic(charge) }
  }

  async *completionEnFlux(
    messages: readonly MessageIA[],
    options: OptionsCompletion = {}
  ): AsyncGenerator<FragmentFlux, void, undefined> {
    const modele = options.modele ?? this.config.modeleConversation
    const cible = cibleAnthropic(this.config)
    const reponse = await envoyer({
      url: cible.url,
      entetes: {
        ...cible.entetes,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      corps: corpsAnthropic(modele, messages, options, true),
      signal: options.signal,
      delaiMs: options.delaiMs ?? this.config.delaiMs,
      fournisseur: this.identifiant,
    })
    for await (const brut of lireEvenementsSse(reponse, this.identifiant)) {
      const texte = deltaAnthropic(analyserJson(brut))
      if (texte !== null && texte !== '') yield { texte, termine: false }
    }
    yield { texte: '', termine: true }
  }

  embeddings(): Promise<ResultatEmbeddings> {
    return Promise.reject(
      new ErreurIA(
        'capacite_absente',
        "Ce fournisseur n'expose pas d'API d'embeddings. Configurer un second fournisseur compatible OpenAI pour la recherche semantique.",
        { fournisseur: this.identifiant }
      )
    )
  }

  transcription(): Promise<ResultatTranscription> {
    return Promise.reject(
      new ErreurIA(
        'capacite_absente',
        "Ce fournisseur n'expose pas d'API de transcription vocale.",
        { fournisseur: this.identifiant }
      )
    )
  }
}

// ---------------------------------------------------------------------------
// Implementation : absence de fournisseur (degradation propre)
// ---------------------------------------------------------------------------

/**
 * Objet nul : il remplace un fournisseur non configure. Aucun appel ne part sur
 * le reseau, aucune exception n'est levee a la construction ; chaque methode
 * echoue avec `non_configure` et la raison exacte, que l'interface peut
 * afficher via `FonctionnaliteIndisponible`.
 */
class FournisseurAbsent implements FournisseurIA {
  readonly identifiant: TypeFournisseurIA = 'aucun'
  readonly modeleConversation: string | null = null
  readonly raison: string
  readonly manquantes: readonly VariableManquante[]

  constructor(raison: string, manquantes: readonly VariableManquante[] = []) {
    this.raison = raison
    this.manquantes = manquantes
  }

  supporte(): boolean {
    return false
  }

  private echec(): ErreurIA {
    return new ErreurIA('non_configure', this.raison, { fournisseur: 'aucun' })
  }

  completion(): Promise<ResultatCompletion> {
    return Promise.reject(this.echec())
  }

  // Ce générateur ne produit rien, et c'est voulu : sans fournisseur d'IA
  // configuré, il n'y a pas de flux à rendre, seulement une erreur explicite.
  // Il doit rester un générateur pour respecter le contrat de l'interface, d'où
  // la règle désarmée ici plutôt que dans la configuration : c'est la seule
  // occurrence légitime du dépôt, et elle rendait `npm run lint` rouge — donc
  // toute barrière d'intégration qui l'inclut.

  async *completionEnFlux(): AsyncGenerator<FragmentFlux, void, undefined> {
    yield* []
    throw this.echec()
  }

  embeddings(): Promise<ResultatEmbeddings> {
    return Promise.reject(this.echec())
  }

  transcription(): Promise<ResultatTranscription> {
    return Promise.reject(this.echec())
  }
}

export function estFournisseurAbsent(fournisseur: FournisseurIA): boolean {
  return fournisseur.identifiant === 'aucun'
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

/** Construit le fournisseur correspondant a une resolution. Ne leve jamais. */
export function creerFournisseurIA(resolution: ResolutionConfigurationIA): FournisseurIA {
  if (resolution.statut === 'desactive') {
    return new FournisseurAbsent(resolution.raison)
  }
  if (resolution.statut === 'incomplet') {
    const noms = resolution.manquantes.map((variable) => variable.nom).join(', ')
    const detail = noms === '' ? '' : ` Variables a definir : ${noms}.`
    return new FournisseurAbsent(`${resolution.raison}${detail}`, resolution.manquantes)
  }

  const config = resolution.configuration
  switch (config.type) {
    case 'azure-openai':
      return new FournisseurAzureOpenAI(config)
    case 'anthropic':
      return new FournisseurAnthropic(config)
    case 'openai-compatible':
    case 'ollama':
      return new FournisseurCompatibleOpenAI(config)
    default: {
      // Garde d'exhaustivite : toute nouvelle valeur casse la compilation ici
      // plutot que de produire un fournisseur silencieusement inerte.
      const inattendu: never = config.type
      return new FournisseurAbsent(`Fournisseur non pris en charge : ${String(inattendu)}.`)
    }
  }
}

let fournisseurMemorise: FournisseurIA | null = null

/**
 * Fournisseur actif, deduit de l'environnement. Memorise apres le premier
 * appel. Passer un environnement explicite contourne la memorisation (tests,
 * previsualisation d'une configuration dans une page d'administration).
 */
export function obtenirFournisseurIA(env?: SourceEnvironnement): FournisseurIA {
  if (env !== undefined) {
    return creerFournisseurIA(resoudreConfigurationIA(env))
  }
  if (fournisseurMemorise === null) {
    fournisseurMemorise = creerFournisseurIA(resoudreConfigurationIA())
  }
  return fournisseurMemorise
}

/** A appeler apres un changement de configuration a chaud, et dans les tests. */
export function reinitialiserFournisseurIA(): void {
  fournisseurMemorise = null
}

/** Concatene un flux en une chaine unique, pour les appels non interactifs. */
export async function assemblerFlux(flux: AsyncIterable<FragmentFlux>): Promise<string> {
  const morceaux: string[] = []
  for await (const fragment of flux) {
    if (fragment.texte !== '') morceaux.push(fragment.texte)
  }
  return morceaux.join('')
}
