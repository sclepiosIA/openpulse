export type ApporteurStatut = 'sain' | 'a_surveiller' | 'en_negociation'

export type ClientStatut = 'signe' | 'onboarding' | 'churne'

export interface ApporteurClient {
  nom: string
  statut: ClientStatut
  /** Chiffre d'affaires annuel (€) utilisé pour classer le top 3. */
  ca?: number
}

export interface ApporteurProspect {
  nom: string
  stade: string
  /** Chiffre d'affaires estimé (€) utilisé pour classer le top 3. */
  ca?: number
}

export interface JournalEntry {
  date: string // ISO
  resume: string
}

export type ExchangeCanal = 'Email' | 'Visio' | 'Téléphone' | 'RDV'

export interface ExchangeEntry {
  id: string
  date: string // ISO
  canal: ExchangeCanal
  resume: string
}

export interface NextStepEntry {
  id: string
  action: string
  echeance: string // ISO
  owner: string
}

export interface NextStep {
  action: string
  echeance: string // ISO
}

export interface Apporteur {
  id: string
  /** UUID du partenaire lié dans la table `partenaires` (source unique). */
  partenaireId?: string
  nom: string
  typePartenariat: string
  dateDebut: string // ISO — date de signature / début du partenariat, sert de référence pour l'ancienneté
  /** Fin de contrat (ISO). Optionnel. */
  dateFin?: string
  statut: ApporteurStatut
  metrics: {
    clientsApportes: number
    prospectsActifs: number
    tauxConversion: number
    arrGenere: number
  }
  clients: ApporteurClient[]
  prospects: ApporteurProspect[]
  journal: JournalEntry[]
  /** Derniers échanges avec l'AA (affichés dans la carte résumé). */
  exchanges: ExchangeEntry[]
  /** Prochaines étapes planifiées avec l'AA (affichées dans la carte résumé). */
  nextSteps: NextStepEntry[]
  nextStep: NextStep
}
