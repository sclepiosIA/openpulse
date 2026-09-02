import { useMemo } from 'react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { CustomerHealthScore } from '../crm/useCustomerHealth'
import { calculateEtablissementValue } from '@/lib/valueCalculations'

export interface ProductionStats {
  totalClients: number
  totalRevenue: number
  averageHealthScore: number
  averageNPS: number
  
  byHealth: {
    healthy: { count: number; revenue: number; nps: number }
    atRisk: { count: number; revenue: number; nps: number }
    churnRisk: { count: number; revenue: number; nps: number }
    onboarding: { count: number; revenue: number; nps: number }
  }
  
  renewals: {
    next30Days: Etablissement[]
    next90Days: Etablissement[]
    expired: Etablissement[]
  }
  
  trends: {
    recentlyLaunched: number
    stable: number
  }
}

export function useProductionStats(
  etablissements: Etablissement[],
  healthScores: Map<string, CustomerHealthScore>,
  healthMetrics?: Map<string, any>
): ProductionStats {
  return useMemo(() => {
    let totalRevenue = 0
    let totalNPS = 0
    let npsCount = 0

    const byHealth = {
      healthy: { count: 0, revenue: 0, nps: 0, npsCount: 0 },
      atRisk: { count: 0, revenue: 0, nps: 0, npsCount: 0 },
      churnRisk: { count: 0, revenue: 0, nps: 0, npsCount: 0 },
      onboarding: { count: 0, revenue: 0, nps: 0, npsCount: 0 }
    }

    const renewals = {
      next30Days: [] as Etablissement[],
      next90Days: [] as Etablissement[],
      expired: [] as Etablissement[]
    }

    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    let recentlyLaunched = 0
    let stable = 0

    etablissements.forEach(etab => {
      const health = healthScores.get(etab.id)
      const metrics = healthMetrics?.get(etab.id)

      // Calculer le CA avec la fonction unifiée
      const revenue = calculateEtablissementValue(etab)
      totalRevenue += revenue

      // NPS
      const nps = metrics?.nps_score
      if (nps !== undefined) {
        totalNPS += nps
        npsCount++
      }

      // Par santé
      if (health) {
        const segment = health.status === 'healthy' ? 'healthy'
          : health.status === 'at-risk' ? 'atRisk'
          : health.status === 'onboarding' ? 'onboarding'
          : 'churnRisk'
        
        byHealth[segment].count++
        byHealth[segment].revenue += revenue
        if (nps !== undefined) {
          byHealth[segment].nps += nps
          byHealth[segment].npsCount++
        }
      }

      // Renouvellements
      if (metrics?.contract_end_date) {
        const contractEnd = new Date(metrics.contract_end_date)
        const daysUntil = Math.floor((contractEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysUntil < 0) {
          renewals.expired.push(etab)
        } else if (daysUntil <= 30) {
          renewals.next30Days.push(etab)
        } else if (daysUntil <= 90) {
          renewals.next90Days.push(etab)
        }
      }

      // Trends
      if (etab.date_signature) {
        const signatureDate = new Date(etab.date_signature)
        if (signatureDate >= threeMonthsAgo) {
          recentlyLaunched++
        } else {
          stable++
        }
      }
    })

    // Moyennes NPS
    Object.keys(byHealth).forEach(key => {
      const segment = byHealth[key as keyof typeof byHealth]
      if (segment.npsCount > 0) {
        segment.nps = segment.nps / segment.npsCount
      }
    })

    return {
      totalClients: etablissements.length,
      totalRevenue,
      averageHealthScore: etablissements.length > 0
        ? Array.from(healthScores.values()).reduce((sum, h) => sum + (h.status !== 'onboarding' ? h.score : 0), 0) 
          / etablissements.filter(e => {
            const h = healthScores.get(e.id)
            return h && h.status !== 'onboarding'
          }).length
        : 0,
      averageNPS: npsCount > 0 ? totalNPS / npsCount : 0,
      byHealth: {
        healthy: { ...byHealth.healthy, nps: byHealth.healthy.nps },
        atRisk: { ...byHealth.atRisk, nps: byHealth.atRisk.nps },
        churnRisk: { ...byHealth.churnRisk, nps: byHealth.churnRisk.nps },
        onboarding: { ...byHealth.onboarding, nps: byHealth.onboarding.nps }
      },
      renewals,
      trends: {
        recentlyLaunched,
        stable
      }
    }
  }, [etablissements, healthScores, healthMetrics])
}
