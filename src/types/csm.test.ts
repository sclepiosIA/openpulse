import { JALON_TYPES, CSM_VIEWS } from './csm'

describe('CSM module static exports', () => {
  describe('JALON_TYPES', () => {
    it('contains expected entries in order with exact labels', () => {
      expect(JALON_TYPES).toEqual([
        { value: 'presentation', label: 'Présentation' },
        { value: 'pre_deploiement', label: 'Pré-déploiement' },
        { value: 'cadrage', label: 'Cadrage' },
        { value: 'deploiement', label: 'Déploiement' },
        { value: 'suivi_t1', label: 'Suivi T1' },
        { value: 'suivi_t2', label: 'Suivi T2' },
        { value: 'bilan_annuel', label: 'Bilan annuel' },
      ])
    })

    it('has unique values and labels', () => {
      const values = JALON_TYPES.map(j => j.value)
      const labels = JALON_TYPES.map(j => j.label)
      expect(new Set(values).size).toBe(values.length)
      expect(new Set(labels).size).toBe(labels.length)
    })

    it('maps value to label correctly', () => {
      const map = Object.fromEntries(JALON_TYPES.map(j => [j.value, j.label]))
      expect(map.presentation).toBe('Présentation')
      expect(map.pre_deploiement).toBe('Pré-déploiement')
      expect(map.cadrage).toBe('Cadrage')
      expect(map.deploiement).toBe('Déploiement')
      expect(map.suivi_t1).toBe('Suivi T1')
      expect(map.suivi_t2).toBe('Suivi T2')
      expect(map.bilan_annuel).toBe('Bilan annuel')
    })

    it('contains exactly the expected set of values', () => {
      const expectedValues = [
        'presentation',
        'pre_deploiement',
        'cadrage',
        'deploiement',
        'suivi_t1',
        'suivi_t2',
        'bilan_annuel',
      ]
      const actualValues = JALON_TYPES.map(j => j.value)
      expect(new Set(actualValues)).toEqual(new Set(expectedValues))
      expect(actualValues.length).toBe(expectedValues.length)
    })
  })

  describe('CSM_VIEWS', () => {
    it('contains expected entries in order with exact labels', () => {
      expect(CSM_VIEWS).toEqual([
        { value: 'comptes', label: 'Comptes' },
        { value: 'contacts', label: 'Contacts' },
        { value: 'parcours', label: 'Parcours' },
        { value: 'facturation', label: 'Facturation' },
        { value: 'utilisation', label: 'Utilisation' },
        { value: 'kpis', label: 'KPIs' },
      ])
    })

    it('has unique values and labels', () => {
      const values = CSM_VIEWS.map(v => v.value)
      const labels = CSM_VIEWS.map(v => v.label)
      expect(new Set(values).size).toBe(values.length)
      expect(new Set(labels).size).toBe(labels.length)
    })

    it('maps value to label correctly', () => {
      const map = Object.fromEntries(CSM_VIEWS.map(v => [v.value, v.label]))
      expect(map.comptes).toBe('Comptes')
      expect(map.contacts).toBe('Contacts')
      expect(map.parcours).toBe('Parcours')
      expect(map.facturation).toBe('Facturation')
      expect(map.utilisation).toBe('Utilisation')
      expect(map.kpis).toBe('KPIs')
    })

    it('contains exactly the expected set of values', () => {
      const expectedValues = ['comptes', 'contacts', 'parcours', 'facturation', 'utilisation', 'kpis']
      const actualValues = CSM_VIEWS.map(v => v.value)
      expect(new Set(actualValues)).toEqual(new Set(expectedValues))
      expect(actualValues.length).toBe(expectedValues.length)
    })
  })
})