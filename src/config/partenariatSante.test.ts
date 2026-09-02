import {
  PARTENARIAT_SANTE_CONFIG,
  calcScoreCommercial,
  calcScoreDependance,
  calcScoreGlobal,
  monthsSince,
  scoreColor,
} from './partenariatSante'

describe('partenariatSante', () => {
  describe('PARTENARIAT_SANTE_CONFIG', () => {
    it('expose les paramètres métier attendus', () => {
      expect(PARTENARIAT_SANTE_CONFIG).toEqual({
        objectifProspects: 50,
        tauxPlancher: 5,
        tauxCible: 50,
        dureeMaturationMois: 18,
        seuilDependance: 0.1,
        poids: {
          commercial: 0.25,
          organisation: 0.25,
          relation: 0.25,
          dependance: 0.25,
        },
      })
    })

    it('définit quatre pondérations équilibrées dont la somme vaut 1', () => {
      const poidsEntries = Object.entries(PARTENARIAT_SANTE_CONFIG.poids)
      const poidsValues = Object.values(PARTENARIAT_SANTE_CONFIG.poids)

      expect(poidsEntries).toEqual([
        ['commercial', 0.25],
        ['organisation', 0.25],
        ['relation', 0.25],
        ['dependance', 0.25],
      ])
      expect(poidsValues).toHaveLength(4)
      expect(poidsValues.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1)
    })

    it('garde des bornes cohérentes pour la conversion et la dépendance', () => {
      expect(PARTENARIAT_SANTE_CONFIG.tauxPlancher).toBeLessThan(PARTENARIAT_SANTE_CONFIG.tauxCible)
      expect(PARTENARIAT_SANTE_CONFIG.dureeMaturationMois).toBeGreaterThan(0)
      expect(PARTENARIAT_SANTE_CONFIG.seuilDependance).toBeGreaterThan(0)
      expect(PARTENARIAT_SANTE_CONFIG.seuilDependance).toBeLessThan(1)
      expect(PARTENARIAT_SANTE_CONFIG.objectifProspects).toBe(50)
    })
  })

  describe('monthsSince', () => {
    it.each([
      {
        dateISO: '2024-01-15',
        now: new Date('2024-01-15T12:00:00.000Z'),
        expected: 0,
        label: 'même jour',
      },
      {
        dateISO: '2024-01-15',
        now: new Date('2024-02-15T12:00:00.000Z'),
        expected: 1,
        label: 'un mois complet',
      },
      {
        dateISO: '2024-01-16',
        now: new Date('2024-02-15T12:00:00.000Z'),
        expected: 0,
        label: 'un mois non complet',
      },
      {
        dateISO: '2023-12-31',
        now: new Date('2024-02-29T12:00:00.000Z'),
        expected: 1,
        label: 'passage année bissextile sans deux mois complets',
      },
      {
        dateISO: '2022-06-10',
        now: new Date('2024-07-09T12:00:00.000Z'),
        expected: 24,
        label: 'plusieurs années avec jour précédent',
      },
      {
        dateISO: '2025-01-01',
        now: new Date('2024-01-01T12:00:00.000Z'),
        expected: 0,
        label: 'date future bornée à zéro',
      },
    ])('calcule $expected mois écoulés pour $label', ({ dateISO, now, expected }) => {
      expect(monthsSince(dateISO, now)).toBe(expected)
    })

    it('renvoie 0 pour une date invalide', () => {
      expect(monthsSince('date-invalide', new Date('2024-06-01T12:00:00.000Z'))).toBe(0)
    })
  })

  describe('calcScoreCommercial', () => {
    it.each([
      {
        params: { prospectsCibles: 0, clientsSignes: 0, moisAnciennete: 0 },
        expected: 0,
        label: 'aucun prospect ciblé',
      },
      {
        params: { prospectsCibles: 25, clientsSignes: 1, moisAnciennete: 0 },
        expected: 65,
        label: 'demi-objectif avec conversion légèrement sous le plancher',
      },
      {
        params: { prospectsCibles: 50, clientsSignes: 25, moisAnciennete: 18 },
        expected: 100,
        label: 'objectif atteint et taux cible atteint à maturité',
      },
      {
        params: { prospectsCibles: 100, clientsSignes: 10, moisAnciennete: 18 },
        expected: 60,
        label: 'volume plafonné mais conversion faible à maturité',
      },
      {
        params: { prospectsCibles: 50, clientsSignes: 11, moisAnciennete: 9 },
        expected: 90,
        label: 'maturation à mi-parcours',
      },
      {
        params: { prospectsCibles: 50, clientsSignes: 25, moisAnciennete: 36 },
        expected: 100,
        label: 'maturation plafonnée après la durée cible',
      },
    ])('retourne $expected pour $label', ({ params, expected }) => {
      expect(calcScoreCommercial(params)).toBeCloseTo(expected)
    })

    it('plafonne la composante taux à 100 lorsque le taux réel dépasse le taux attendu', () => {
      expect(
        calcScoreCommercial({
          prospectsCibles: 50,
          clientsSignes: 50,
          moisAnciennete: 0,
        })
      ).toBe(100)
    })
  })

  describe('calcScoreDependance', () => {
    it.each([
      {
        params: { prospectsCiblesPartenaire: 12, prospectsCiblesTousPartenaires: 0 },
        expected: 100,
        label: 'total nul',
      },
      {
        params: { prospectsCiblesPartenaire: 10, prospectsCiblesTousPartenaires: 100 },
        expected: 100,
        label: 'ratio exactement au seuil de dépendance',
      },
      {
        params: { prospectsCiblesPartenaire: 25, prospectsCiblesTousPartenaires: 100 },
        expected: 83.3333333333,
        label: 'ratio modérément au-dessus du seuil',
      },
      {
        params: { prospectsCiblesPartenaire: 55, prospectsCiblesTousPartenaires: 100 },
        expected: 50,
        label: 'ratio médian entre seuil et dépendance totale',
      },
      {
        params: { prospectsCiblesPartenaire: 100, prospectsCiblesTousPartenaires: 100 },
        expected: 0,
        label: 'dépendance totale',
      },
      {
        params: { prospectsCiblesPartenaire: 120, prospectsCiblesTousPartenaires: 100 },
        expected: 0,
        label: 'ratio supérieur à 1 borné à zéro',
      },
    ])('retourne $expected pour $label', ({ params, expected }) => {
      expect(calcScoreDependance(params)).toBeCloseTo(expected)
    })
  })

  describe('calcScoreGlobal', () => {
    it('calcule la moyenne pondérée des quatre dimensions', () => {
      expect(
        calcScoreGlobal({
          commercial: 100,
          organisation: 80,
          relation: 60,
          dependance: 40,
        })
      ).toBe(70)
    })

    it('respecte les pondérations équilibrées de la configuration', () => {
      expect(
        calcScoreGlobal({
          commercial: 20,
          organisation: 40,
          relation: 60,
          dependance: 80,
        })
      ).toBe(50)
    })
  })

  describe('scoreColor', () => {
    it.each([
      { score: 100, expected: 'hsl(142 71% 45%)', label: 'excellent' },
      { score: 70, expected: 'hsl(142 71% 45%)', label: 'seuil vert inclus' },
      { score: 69.99, expected: 'hsl(32 95% 55%)', label: 'juste sous le vert' },
      { score: 40, expected: 'hsl(32 95% 55%)', label: 'seuil orange inclus' },
      { score: 39.99, expected: 'hsl(0 84% 60%)', label: 'juste sous orange' },
      { score: 0, expected: 'hsl(0 84% 60%)', label: 'critique' },
    ])('renvoie la couleur $expected pour un score $label', ({ score, expected }) => {
      expect(scoreColor(score)).toBe(expected)
    })
  })
})
