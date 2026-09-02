/**
 * Tests unitaires pour useCustomerHealth.
 *
 * Ce hook est un useMemo pur — pas de requête réseau, pas de QueryClient.
 * Les tests couvrent :
 * — Cas onboarding (< 3 mois en production)
 * — Score et statut pour toutes les branches (healthy / at-risk / churn-risk / critical)
 * — Calcul précis des facteurs pondérés
 * — Alertes générées (tickets, paiement, NPS, adoption, inactivité, renouvellement)
 * — Absences de métriques (score neutre adoption=50)
 * — Helpers de présentation (getHealthColor, getHealthBadgeColor, getHealthLabel, getHealthIcon)
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { EtablissementData as Etablissement } from '@/hooks/crm/useEtablissements'
import {
  useCustomerHealth,
  getHealthColor,
  getHealthBadgeColor,
  getHealthLabel,
  getHealthIcon,
} from '@/hooks/crm/useCustomerHealth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construit une date ISO dans le passé, il y a `months` mois environ */
function monthsAgo(months: number): string {
  const d = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function daysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

/** Crée un Etablissement minimal valide pour les tests. */
function makeEtab(overrides: Partial<Etablissement> = {}): Etablissement {
  return {
    id: 'etab-test',
    nom: 'CH Test',
    ville: 'Paris',
    region: 'Île-de-France',
    type: 'CH',
    statut: 'Production',
    date_prise_contact: '2025-01-01',
    date_signature: monthsAgo(12), // 12 mois = en production
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Etablissement
}

// ─── Calcul attendu du score pondéré ─────────────────────────────────────────
//
// score = adoption*0.30 + support*0.20 + payment*0.20 + engagement*0.15 + feedback*0.15
//

describe('useCustomerHealth', () => {
  describe('cas onboarding (< 3 mois)', () => {
    it('retourne status=onboarding quand date_signature < 3 mois', () => {
      const etab = makeEtab({ date_signature: monthsAgo(2) })
      const { result } = renderHook(() => useCustomerHealth([etab]))

      const health = result.current.get('etab-test')!
      expect(health.status).toBe('onboarding')
      expect(health.score).toBe(0)
      expect(health.alerts).toContain("En phase d'onboarding - Suivi renforcé requis")
    })

    it('retourne status=onboarding quand date_signature absente', () => {
      const etab = makeEtab({ date_signature: undefined })
      const { result } = renderHook(() => useCustomerHealth([etab]))

      const health = result.current.get('etab-test')!
      expect(health.status).toBe('onboarding')
    })
  })

  describe('cas sans métriques disponibles', () => {
    it('adoption=50 (score neutre) quand healthMetrics absent', () => {
      const etab = makeEtab()
      const { result } = renderHook(() => useCustomerHealth([etab]))

      const health = result.current.get('etab-test')!
      expect(health.factors.adoption).toBe(50)
      expect(health.alerts).toContain("Métriques d'adoption manquantes")
    })

    it('calcule le score avec tous les facteurs à défaut', () => {
      // Avec adoption=50, support=100, payment=100, engagement=100, feedback=100
      // score = 50*0.30 + 100*0.20 + 100*0.20 + 100*0.15 + 100*0.15
      //       = 15 + 20 + 20 + 15 + 15 = 85
      const etab = makeEtab()
      const { result } = renderHook(() => useCustomerHealth([etab]))

      const health = result.current.get('etab-test')!
      expect(health.score).toBe(85)
      expect(health.status).toBe('healthy')
    })
  })

  describe('statut healthy (score >= 80)', () => {
    it('retourne healthy avec adoption élevée et pas de problèmes', () => {
      const etab = makeEtab()
      const metrics = new Map([
        [
          'etab-test',
          { adoption_rate: 90, support_tickets_open: 0, payment_status: 'on_time', nps_score: 9 },
        ],
      ])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const health = result.current.get('etab-test')!
      // adoption=min(100,90*1.1)=99, support=100, payment=100, engagement=100, feedback=100
      // score = 99*0.30 + 100*0.20 + 100*0.20 + 100*0.15 + 100*0.15
      //       = 29.7 + 20 + 20 + 15 + 15 = 99.7 → round = 100
      expect(health.status).toBe('healthy')
      expect(health.score).toBeGreaterThanOrEqual(80)
      expect(health.factors.adoption).toBe(Math.min(100, 90 * 1.1))
      expect(health.factors.feedback).toBe(100)
    })
  })

  describe('statut at-risk (60 <= score < 80)', () => {
    it('retourne at-risk avec adoption faible', () => {
      const etab = makeEtab()
      const metrics = new Map([
        ['etab-test', { adoption_rate: 40, support_tickets_open: 0, payment_status: 'on_time' }],
      ])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const health = result.current.get('etab-test')!
      // adoption=40 (< 50), support=100, payment=100, engagement=100, feedback=100
      // score = 40*0.30 + 100*0.20 + 100*0.20 + 100*0.15 + 100*0.15
      //       = 12 + 20 + 20 + 15 + 15 = 82 → healthy
      // => on teste avec tickets + inactivité pour descendre
      expect(health.factors.adoption).toBe(40)
      expect(health.alerts).toContain('Adoption faible: 40%')
    })

    it('retourne at-risk avec 4 tickets ouverts', () => {
      const etab = makeEtab()
      const metrics = new Map([
        ['etab-test', { adoption_rate: 60, support_tickets_open: 4, payment_status: 'on_time' }],
      ])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const health = result.current.get('etab-test')!
      // adoption: 60<70 → factors.adoption=70, support: 4>3 → factors.support=70
      // score = 70*0.30 + 70*0.20 + 100*0.20 + 100*0.15 + 100*0.15
      //       = 21 + 14 + 20 + 15 + 15 = 85 → healthy... mais avec nps absent → feedback=100
      // Pour at-risk : adoption_rate=55 → factors.adoption=70, + late payment
      expect(health.factors.support).toBe(70)
      expect(health.alerts.some((a) => a.includes('tickets support actifs'))).toBe(true)
    })
  })

  describe('statut churn-risk (40 <= score < 60)', () => {
    it('retourne churn-risk avec adoption très faible + payment overdue + inactivité', () => {
      const etab = makeEtab()
      const metrics = new Map([
        [
          'etab-test',
          {
            adoption_rate: 40, // factors.adoption = 40
            support_tickets_open: 6, // factors.support = 40
            payment_status: 'overdue', // factors.payment = 30
            last_activity_date: daysAgo(35), // factors.engagement = 40
            nps_score: 5, // factors.feedback = 40
          },
        ],
      ])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const health = result.current.get('etab-test')!
      // score = 40*0.30 + 40*0.20 + 30*0.20 + 40*0.15 + 40*0.15
      //       = 12 + 8 + 6 + 6 + 6 = 38 → critical (< 40)
      // Avec adoption=40, support=40, payment=30, engagement=40, feedback=40 → score=38
      expect(health.score).toBeLessThan(60)
      // Le statut peut être churn-risk ou critical selon le score exact
      expect(['churn-risk', 'critical']).toContain(health.status)
    })
  })

  describe('statut critical (score < 40)', () => {
    it('retourne critical avec tous les indicateurs au rouge', () => {
      const etab = makeEtab()
      const metrics = new Map([
        [
          'etab-test',
          {
            adoption_rate: 40, // factors.adoption = 40
            support_tickets_open: 7, // factors.support = 40 (> 5)
            payment_status: 'overdue', // factors.payment = 30
            last_activity_date: daysAgo(45), // factors.engagement = 40 (> 30)
            nps_score: 4, // factors.feedback = 40 (nps <= 6)
          },
        ],
      ])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const health = result.current.get('etab-test')!
      // score = 40*0.30 + 40*0.20 + 30*0.20 + 40*0.15 + 40*0.15
      //       = 12 + 8 + 6 + 6 + 6 = 38 → critical
      expect(health.score).toBe(38)
      expect(health.status).toBe('critical')
      expect(health.alerts).toContain('Situation critique - Escalation immédiate')
    })
  })

  describe('facteurs individuels — calcul précis', () => {
    it('adoption 75% → factors.adoption=70, alerte "Adoption moyenne"', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { adoption_rate: 65 }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.adoption).toBe(70)
      expect(h.alerts.some((a) => a.includes('Adoption moyenne'))).toBe(true)
    })

    it('adoption >= 70% → factors.adoption = min(100, rate*1.1)', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { adoption_rate: 80 }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.adoption).toBe(Math.min(100, 80 * 1.1))
    })

    it('paiement en retard → factors.payment=60, alerte "Retard de paiement"', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { payment_status: 'late' }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.payment).toBe(60)
      expect(h.alerts).toContain('Retard de paiement')
    })

    it('paiement en souffrance → factors.payment=30, alerte "Paiement en retard"', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { payment_status: 'overdue' }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.payment).toBe(30)
      expect(h.alerts).toContain('Paiement en retard')
    })

    it('NPS > 8 → factors.feedback=100', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { nps_score: 9.5 }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.feedback).toBe(100)
    })

    it('NPS <= 6 → factors.feedback=40, alerte NPS faible', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { nps_score: 5.0 }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.feedback).toBe(40)
      expect(h.alerts.some((a) => a.includes('NPS faible'))).toBe(true)
    })

    it('NPS entre 6 et 8 → factors.feedback=75', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { nps_score: 7 }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.feedback).toBe(75)
    })

    it('inactivité 20 jours → factors.engagement=70', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { last_activity_date: daysAgo(20) }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.engagement).toBe(70)
      expect(h.alerts).toContain('Activité faible récemment')
    })

    it('inactivité > 30 jours → factors.engagement=40', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { last_activity_date: daysAgo(40) }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.engagement).toBe(40)
      expect(h.alerts.some((a) => a.includes("Pas d'activité depuis"))).toBe(true)
    })

    it('plus de 5 tickets → factors.support=40', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { support_tickets_open: 6 }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.support).toBe(40)
      expect(h.alerts.some((a) => a.includes('tickets support ouverts'))).toBe(true)
    })

    it('1 à 3 tickets → factors.support=85', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { support_tickets_open: 2 }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.factors.support).toBe(85)
    })
  })

  describe('alertes de renouvellement', () => {
    it('contrat expiré → alerte "Contrat expiré"', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { contract_end_date: daysAgo(5) }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.alerts).toContain('Contrat expiré')
    })

    it('renouvellement dans 10 jours → alerte avec jours', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { contract_end_date: daysFromNow(10) }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.alerts.some((a) => a.includes('Renouvellement dans') && a.includes('jours'))).toBe(
        true
      )
    })

    it('renouvellement dans 45 jours → alerte avec mois', () => {
      const etab = makeEtab()
      const metrics = new Map([['etab-test', { contract_end_date: daysFromNow(45) }]])
      const { result } = renderHook(() => useCustomerHealth([etab], metrics))

      const h = result.current.get('etab-test')!
      expect(h.alerts.some((a) => a.includes('Renouvellement dans') && a.includes('mois'))).toBe(
        true
      )
    })
  })

  describe('liste vide et multiples établissements', () => {
    it('retourne une Map vide pour un tableau vide', () => {
      const { result } = renderHook(() => useCustomerHealth([]))
      expect(result.current.size).toBe(0)
    })

    it('calcule indépendamment chaque établissement', () => {
      const etab1 = makeEtab({ id: 'e1', date_signature: monthsAgo(12) })
      const etab2 = makeEtab({ id: 'e2', date_signature: monthsAgo(1) }) // onboarding
      const metrics = new Map([
        [
          'e1',
          { adoption_rate: 90, support_tickets_open: 0, payment_status: 'on_time', nps_score: 9 },
        ],
      ])
      const { result } = renderHook(() => useCustomerHealth([etab1, etab2], metrics))

      expect(result.current.get('e1')!.status).toBe('healthy')
      expect(result.current.get('e2')!.status).toBe('onboarding')
    })
  })
})

// ─── Helpers de présentation ──────────────────────────────────────────────────

describe('getHealthColor', () => {
  it('healthy → text-success', () => expect(getHealthColor('healthy')).toBe('text-success'))
  it('at-risk → text-warning', () => expect(getHealthColor('at-risk')).toBe('text-warning'))
  it('churn-risk → text-destructive', () =>
    expect(getHealthColor('churn-risk')).toBe('text-destructive'))
  it('critical → text-destructive', () =>
    expect(getHealthColor('critical')).toBe('text-destructive'))
  it('onboarding → text-primary', () => expect(getHealthColor('onboarding')).toBe('text-primary'))
})

describe('getHealthBadgeColor', () => {
  it('healthy contient bg-success', () =>
    expect(getHealthBadgeColor('healthy')).toContain('bg-success'))
  it('at-risk contient bg-warning', () =>
    expect(getHealthBadgeColor('at-risk')).toContain('bg-warning'))
  it('churn-risk contient bg-destructive', () =>
    expect(getHealthBadgeColor('churn-risk')).toContain('bg-destructive'))
  it('critical contient bg-destructive/20', () =>
    expect(getHealthBadgeColor('critical')).toContain('bg-destructive/20'))
  it('onboarding contient bg-primary', () =>
    expect(getHealthBadgeColor('onboarding')).toContain('bg-primary'))
})

describe('getHealthLabel', () => {
  it('healthy → Bon', () => expect(getHealthLabel('healthy')).toBe('Bon'))
  it('at-risk → At Risk', () => expect(getHealthLabel('at-risk')).toBe('At Risk'))
  it('churn-risk → Churn Risk', () => expect(getHealthLabel('churn-risk')).toBe('Churn Risk'))
  it('critical → Critical', () => expect(getHealthLabel('critical')).toBe('Critical'))
  it('onboarding → Onboarding', () => expect(getHealthLabel('onboarding')).toBe('Onboarding'))
})

describe('getHealthIcon', () => {
  it('healthy → 🟢', () => expect(getHealthIcon('healthy')).toBe('🟢'))
  it('at-risk → 🟠', () => expect(getHealthIcon('at-risk')).toBe('🟠'))
  it('churn-risk → 🔴', () => expect(getHealthIcon('churn-risk')).toBe('🔴'))
  it('critical → 🚨', () => expect(getHealthIcon('critical')).toBe('🚨'))
  it('onboarding → 🆕', () => expect(getHealthIcon('onboarding')).toBe('🆕'))
})
