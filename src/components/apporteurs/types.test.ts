import type {
  Apporteur,
  ApporteurClient,
  ApporteurProspect,
  ApporteurStatut,
  ClientStatut,
  JournalEntry,
  NextStep,
} from './types'

describe('types.ts', () => {
  const clientStatuts: ClientStatut[] = ['signe', 'onboarding', 'churne']
  const apporteurStatuts: ApporteurStatut[] = ['sain', 'a_surveiller', 'en_negociation']

  const client: ApporteurClient = {
    nom: 'Client Alpha',
    statut: 'signe',
  }

  const prospect: ApporteurProspect = {
    nom: 'Prospect Beta',
    stade: 'qualification',
  }

  const journalEntry: JournalEntry = {
    date: '2024-01-15',
    resume: 'Premier échange effectué',
  }

  const nextStep: NextStep = {
    action: 'Relancer le partenaire',
    echeance: '2024-02-01',
  }

  const apporteur: Apporteur = {
    id: 'app-1',
    partenaireId: 'part-1',
    nom: 'Partenaire Nord',
    typePartenariat: 'courtage',
    dateDebut: '2024-01-01',
    statut: 'sain',
    metrics: {
      clientsApportes: 12,
      prospectsActifs: 5,
      tauxConversion: 40,
      arrGenere: 24000,
    },
    clients: [
      { nom: 'Client Alpha', statut: 'signe' },
      { nom: 'Client Gamma', statut: 'onboarding' },
    ],
    prospects: [
      { nom: 'Prospect Beta', stade: 'qualification' },
      { nom: 'Prospect Delta', stade: 'demo' },
    ],
    journal: [
      { date: '2024-01-15', resume: 'Premier échange effectué' },
      { date: '2024-01-20', resume: 'Proposition envoyée' },
    ],
    nextStep: {
      action: 'Relancer le partenaire',
      echeance: '2024-02-01',
    },
  }

  it('accepte les valeurs autorisées de ClientStatut', () => {
    expect(clientStatuts).toHaveLength(3)
    expect(clientStatuts).toEqual(['signe', 'onboarding', 'churne'])
    expect(new Set(clientStatuts).size).toBe(3)
    expect(client.statut).toBe('signe')
  })

  it('accepte les valeurs autorisées de ApporteurStatut', () => {
    expect(apporteurStatuts).toHaveLength(3)
    expect(apporteurStatuts).toEqual(['sain', 'a_surveiller', 'en_negociation'])
    expect(new Set(apporteurStatuts).size).toBe(3)
    expect(apporteur.statut).toBe('sain')
  })

  it('respecte la structure de ApporteurClient', () => {
    expect(client).toMatchObject({
      nom: 'Client Alpha',
      statut: 'signe',
    })
    expect(typeof client.nom).toBe('string')
    expect(clientStatuts).toContain(client.statut)
  })

  it('respecte la structure de ApporteurProspect', () => {
    expect(prospect).toMatchObject({
      nom: 'Prospect Beta',
      stade: 'qualification',
    })
    expect(typeof prospect.nom).toBe('string')
    expect(typeof prospect.stade).toBe('string')
  })

  it('respecte la structure de JournalEntry avec une date ISO simple', () => {
    expect(journalEntry).toEqual({
      date: '2024-01-15',
      resume: 'Premier échange effectué',
    })
    expect(typeof journalEntry.date).toBe('string')
    expect(typeof journalEntry.resume).toBe('string')
    expect(journalEntry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('respecte la structure de NextStep avec une échéance ISO simple', () => {
    expect(nextStep).toEqual({
      action: 'Relancer le partenaire',
      echeance: '2024-02-01',
    })
    expect(typeof nextStep.action).toBe('string')
    expect(typeof nextStep.echeance).toBe('string')
    expect(nextStep.echeance).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('respecte la structure complète de Apporteur', () => {
    expect(apporteur.id).toBe('app-1')
    expect(apporteur.partenaireId).toBe('part-1')
    expect(apporteur.nom).toBe('Partenaire Nord')
    expect(apporteur.typePartenariat).toBe('courtage')
    expect(apporteur.dateDebut).toBe('2024-01-01')
    expect(apporteur.statut).toBe('sain')

    expect(apporteur.metrics).toEqual({
      clientsApportes: 12,
      prospectsActifs: 5,
      tauxConversion: 40,
      arrGenere: 24000,
    })

    expect(apporteur.clients).toHaveLength(2)
    expect(apporteur.clients[0]).toEqual({
      nom: 'Client Alpha',
      statut: 'signe',
    })
    expect(apporteur.clients[1]).toEqual({
      nom: 'Client Gamma',
      statut: 'onboarding',
    })

    expect(apporteur.prospects).toHaveLength(2)
    expect(apporteur.prospects[0]).toEqual({
      nom: 'Prospect Beta',
      stade: 'qualification',
    })

    expect(apporteur.journal).toHaveLength(2)
    expect(apporteur.journal[1]).toEqual({
      date: '2024-01-20',
      resume: 'Proposition envoyée',
    })

    expect(apporteur.nextStep).toEqual({
      action: 'Relancer le partenaire',
      echeance: '2024-02-01',
    })
  })

  it('garantit des bornes métiers cohérentes sur metrics', () => {
    expect(apporteur.metrics.clientsApportes).toBeGreaterThanOrEqual(0)
    expect(apporteur.metrics.prospectsActifs).toBeGreaterThanOrEqual(0)
    expect(apporteur.metrics.tauxConversion).toBeGreaterThanOrEqual(0)
    expect(apporteur.metrics.tauxConversion).toBeLessThanOrEqual(100)
    expect(apporteur.metrics.arrGenere).toBeGreaterThanOrEqual(0)
  })

  it('conserve des tableaux typés et homogènes dans Apporteur', () => {
    expect(apporteur.clients.every((item) => typeof item.nom === 'string')).toBe(true)
    expect(apporteur.clients.every((item) => clientStatuts.includes(item.statut))).toBe(true)
    expect(apporteur.prospects.every((item) => typeof item.stade === 'string')).toBe(true)
    expect(apporteur.journal.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date))).toBe(true)
    expect(apporteur.journal.every((item) => typeof item.resume === 'string')).toBe(true)
  })

  it('autorise partenaireId comme champ optionnel', () => {
    const apporteurSansPartenaire: Apporteur = {
      id: 'app-2',
      nom: 'Partenaire Sud',
      typePartenariat: 'integration',
      dateDebut: '2024-03-10',
      statut: 'en_negociation',
      metrics: {
        clientsApportes: 0,
        prospectsActifs: 3,
        tauxConversion: 0,
        arrGenere: 0,
      },
      clients: [],
      prospects: [{ nom: 'Prospect Echo', stade: 'contact' }],
      journal: [{ date: '2024-03-11', resume: 'Prise de contact' }],
      nextStep: { action: 'Planifier un rendez-vous', echeance: '2024-03-20' },
    }

    expect(apporteurSansPartenaire.partenaireId).toBeUndefined()
    expect(apporteurSansPartenaire.statut).toBe('en_negociation')
    expect(apporteurSansPartenaire.clients).toHaveLength(0)
    expect(apporteurSansPartenaire.prospects).toHaveLength(1)
  })
})
