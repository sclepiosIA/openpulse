import { apporteursSeed } from './apporteursSeed'

/**
 * Traitement conjoint obligatoire avec `src/data/apporteursSeed.ts` : ce test figeait
 * les noms de l amont. Les INVARIANTS NUMERIQUES sont volontairement identiques a ceux
 * de l amont (6 clients apportes, 14 prospects actifs, 257 000 EUR d ARR cumule,
 * repartitions [4,2,0] / [3,2,3] / [3,2,2]) : la couverture est preservee a l identique,
 * seules les identites changent.
 */
describe('apporteursSeed', () => {
  it('expose exactement les trois apporteurs attendus dans l’ordre métier', () => {
    expect(apporteursSeed).toHaveLength(3)

    expect(apporteursSeed.map((apporteur) => apporteur.id)).toEqual([
      'boreale-systemes',
      'altiora-advisors',
      'groupement-vesone',
    ])

    expect(apporteursSeed.map((apporteur) => apporteur.nom)).toEqual([
      'Boréale Systèmes',
      'Altiora Advisors',
      'Groupement Vésone',
    ])
  })

  it('respecte la structure complète attendue pour chaque apporteur', () => {
    for (const apporteur of apporteursSeed) {
      expect(Object.keys(apporteur).filter((key) => key !== 'dateFin').sort()).toEqual(
        [
          'clients',
          'dateDebut',
          'exchanges',
          'id',
          'journal',
          'metrics',
          'nextStep',
          'nextSteps',
          'nom',
          'partenaireId',
          'prospects',
          'statut',
          'typePartenariat',
        ].sort()
      )

      expect(typeof apporteur.id).toBe('string')
      expect(apporteur.id.length).toBeGreaterThan(0)
      expect(typeof apporteur.partenaireId).toBe('string')
      expect(apporteur.partenaireId).toMatch(/^[0-9a-f-]{36}$/)
      expect(typeof apporteur.nom).toBe('string')
      expect(typeof apporteur.typePartenariat).toBe('string')
      expect(apporteur.dateDebut).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (apporteur.dateFin !== undefined) {
        expect(apporteur.dateFin).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
      expect(['sain', 'a_surveiller', 'en_negociation']).toContain(apporteur.statut)

      expect(Object.keys(apporteur.metrics).sort()).toEqual(
        ['arrGenere', 'clientsApportes', 'prospectsActifs', 'tauxConversion'].sort()
      )

      expect(apporteur.metrics.clientsApportes).toBeGreaterThanOrEqual(0)
      expect(apporteur.metrics.prospectsActifs).toBeGreaterThanOrEqual(0)
      expect(apporteur.metrics.tauxConversion).toBeGreaterThanOrEqual(0)
      expect(apporteur.metrics.tauxConversion).toBeLessThanOrEqual(100)
      expect(apporteur.metrics.arrGenere).toBeGreaterThanOrEqual(0)

      expect(Array.isArray(apporteur.clients)).toBe(true)
      expect(Array.isArray(apporteur.prospects)).toBe(true)
      expect(Array.isArray(apporteur.journal)).toBe(true)
      expect(Array.isArray(apporteur.exchanges)).toBe(true)
      expect(Array.isArray(apporteur.nextSteps)).toBe(true)

      expect(apporteur.nextStep.action.length).toBeGreaterThan(0)
      expect(apporteur.nextStep.echeance).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('contient les métriques et statuts précis de Boréale Systèmes', () => {
    const boreale = apporteursSeed.find((apporteur) => apporteur.id === 'boreale-systemes')

    expect(boreale).toEqual(
      expect.objectContaining({
        nom: 'Boréale Systèmes',
        typePartenariat: 'Éditeur de dossier patient (partenaire technique)',
        dateDebut: '2026-03-01',
        dateFin: '2029-03-01',
        statut: 'sain',
        metrics: {
          clientsApportes: 4,
          prospectsActifs: 6,
          tauxConversion: 40,
          arrGenere: 185000,
        },
        nextStep: {
          action: 'Relance du CHU Montaubry — envoi de la proposition finale co-signée',
          echeance: '2026-07-15',
        },
      })
    )

    expect(boreale?.clients).toHaveLength(4)
    expect(boreale?.clients).toEqual([
      { nom: 'CH Villebrume', statut: 'signe', ca: 80000 },
      { nom: 'Clinique du Vallon', statut: 'onboarding', ca: 45000 },
      { nom: 'CH Roqueverte', statut: 'signe', ca: 65000 },
      { nom: 'GHT Aure et Ombreuse', statut: 'signe', ca: 50000 },
    ])

    expect(boreale?.prospects).toEqual([
      { nom: 'CHU Montaubry', stade: 'Négociation', ca: 120000 },
      { nom: 'CH Pierrefosse', stade: 'RDV pris', ca: 90000 },
      { nom: 'Clinique des Glycines', stade: 'Etude émise', ca: 70000 },
    ])

    expect(boreale?.journal[0]).toEqual({
      date: '2026-06-24',
      resume:
        'Comité de pilotage trimestriel — alignement des feuilles de route produit pour le T3.',
    })
  })

  it('contient les signaux de surveillance précis pour Altiora Advisors', () => {
    const altiora = apporteursSeed.find((apporteur) => apporteur.id === 'altiora-advisors')

    expect(altiora).toEqual(
      expect.objectContaining({
        nom: 'Altiora Advisors',
        typePartenariat: 'Intégrateur de dossier patient',
        dateDebut: '2025-02-15',
        statut: 'a_surveiller',
        metrics: {
          clientsApportes: 2,
          prospectsActifs: 3,
          tauxConversion: 25,
          arrGenere: 72000,
        },
        nextStep: {
          action: 'Atelier de repositionnement du partenariat',
          echeance: '2026-07-11',
        },
      })
    )

    expect(altiora?.clients).toEqual([
      { nom: 'CH Lorgeval', statut: 'signe', ca: 60000 },
      { nom: 'Polyclinique de Vaupré', statut: 'churne', ca: 0 },
    ])

    expect(altiora?.prospects).toEqual([
      { nom: 'CH Marnecourt', stade: 'Attente post RDV', ca: 50000 },
      { nom: 'CHU Saint-Elme', stade: 'Prospect', ca: 80000 },
    ])

    expect(altiora?.journal).toEqual([
      { date: '2026-06-30', resume: "Réunion tendue — baisse d'activité constatée sur le T2." },
      {
        date: '2026-05-20',
        resume: 'Perte de la Polyclinique de Vaupré (partie chez un concurrent).',
      },
    ])
  })

  it('décrit Groupement Vésone comme une négociation sans client signé ni ARR', () => {
    const vesone = apporteursSeed.find((apporteur) => apporteur.id === 'groupement-vesone')

    expect(vesone).toEqual(
      expect.objectContaining({
        nom: 'Groupement Vésone',
        typePartenariat: "Groupement d'achat hospitalier",
        dateDebut: '2026-05-10',
        statut: 'en_negociation',
        metrics: {
          clientsApportes: 0,
          prospectsActifs: 5,
          tauxConversion: 0,
          arrGenere: 0,
        },
        clients: [],
        nextStep: {
          action: 'Signature du contrat de partenariat définitif',
          echeance: '2026-07-25',
        },
      })
    )

    expect(vesone?.prospects).toEqual([
      { nom: 'CH Aubercourt', stade: 'RDV pris', ca: 40000 },
      { nom: 'CH Fontenoy', stade: 'Attente RDV', ca: 30000 },
      { nom: 'GHT Rives de Vègre', stade: 'Prospect', ca: 25000 },
    ])

    expect(vesone?.journal).toEqual([
      {
        date: '2026-06-18',
        resume: 'Cadrage commercial — accord de principe sur une commission de 8 %.',
      },
      { date: '2026-05-10', resume: "Signature du protocole d'accord de partenariat." },
    ])
  })

  it('garantit l’unicité des identifiants et la cohérence des agrégats clients/prospects', () => {
    const ids = apporteursSeed.map((apporteur) => apporteur.id)
    const partenaireIds = apporteursSeed.map((apporteur) => apporteur.partenaireId)

    expect(new Set(ids).size).toBe(apporteursSeed.length)
    expect(new Set(partenaireIds).size).toBe(apporteursSeed.length)

    const totalClientsApportes = apporteursSeed.reduce(
      (total, apporteur) => total + apporteur.metrics.clientsApportes,
      0
    )
    const totalProspectsActifs = apporteursSeed.reduce(
      (total, apporteur) => total + apporteur.metrics.prospectsActifs,
      0
    )
    const totalArrGenere = apporteursSeed.reduce(
      (total, apporteur) => total + apporteur.metrics.arrGenere,
      0
    )

    expect(totalClientsApportes).toBe(6)
    expect(totalProspectsActifs).toBe(14)
    expect(totalArrGenere).toBe(257000)

    expect(apporteursSeed.map((apporteur) => apporteur.clients.length)).toEqual([4, 2, 0])
    expect(apporteursSeed.map((apporteur) => apporteur.prospects.length)).toEqual([3, 2, 3])
    expect(apporteursSeed.map((apporteur) => apporteur.journal.length)).toEqual([3, 2, 2])
  })
})
