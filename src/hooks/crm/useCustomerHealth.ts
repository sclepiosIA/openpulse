import { useMemo } from 'react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'

export type CustomerHealthStatus = 'healthy' | 'at-risk' | 'churn-risk' | 'critical' | 'onboarding'

export interface CustomerHealthScore {
  score: number
  status: CustomerHealthStatus
  factors: {
    adoption: number
    support: number
    payment: number
    engagement: number
    feedback: number
  }
  alerts: string[]
}

export function useCustomerHealth(
  etablissements: Etablissement[],
  healthMetrics?: Map<string, any>
) {
  return useMemo(() => {
    const healthMap = new Map<string, CustomerHealthScore>()

    etablissements.forEach(etablissement => {
      const alerts: string[] = []
      const factors = {
        adoption: 100,
        support: 100,
        payment: 100,
        engagement: 100,
        feedback: 100
      }

      // Calculer les mois en production
      const monthsInProduction = etablissement.date_signature
        ? Math.floor((Date.now() - new Date(etablissement.date_signature).getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0

      // Cas spécial : Onboarding (< 3 mois)
      if (monthsInProduction < 3) {
        healthMap.set(etablissement.id, {
          score: 0,
          status: 'onboarding',
          factors,
          alerts: ['En phase d\'onboarding - Suivi renforcé requis']
        })
        return
      }

      // Récupérer les métriques si disponibles
      const metrics = healthMetrics?.get(etablissement.id)

      // 1. Adoption (30%) - Basé sur les métriques réelles uniquement
      if (metrics?.adoption_rate !== undefined && metrics.adoption_rate !== null) {
        const adoptionRate = metrics.adoption_rate
        factors.adoption = Math.min(100, adoptionRate * 1.1)
        
        if (adoptionRate < 50) {
          factors.adoption = 40
          alerts.push(`Adoption faible: ${adoptionRate.toFixed(0)}%`)
        } else if (adoptionRate < 70) {
          factors.adoption = 70
          alerts.push(`Adoption moyenne: ${adoptionRate.toFixed(0)}%`)
        }
      } else {
        // Pas de métriques disponibles
        factors.adoption = 50 // Score neutre si pas de données
        alerts.push('Métriques d\'adoption manquantes')
      }

      // 2. Support (20%) - Volume de tickets
      const supportTickets = metrics?.support_tickets_open || 0
      if (supportTickets > 5) {
        factors.support = 40
        alerts.push(`${supportTickets} tickets support ouverts`)
      } else if (supportTickets > 3) {
        factors.support = 70
        alerts.push(`${supportTickets} tickets support actifs`)
      } else if (supportTickets > 0) {
        factors.support = 85
      }

      // 3. Paiement (20%)
      const paymentStatus = metrics?.payment_status || 'on_time'
      if (paymentStatus === 'overdue') {
        factors.payment = 30
        alerts.push('Paiement en retard')
      } else if (paymentStatus === 'late') {
        factors.payment = 60
        alerts.push('Retard de paiement')
      }

      // 4. Engagement (15%) - Dernière activité
      const lastActivity = metrics?.last_activity_date
      if (lastActivity) {
        const daysSinceActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSinceActivity > 30) {
          factors.engagement = 40
          alerts.push(`Pas d'activité depuis ${daysSinceActivity} jours`)
        } else if (daysSinceActivity > 14) {
          factors.engagement = 70
          alerts.push('Activité faible récemment')
        }
      }

      // 5. Feedback (15%) - NPS
      const nps = metrics?.nps_score
      if (nps !== undefined && nps !== null) {
        if (nps <= 6) {
          factors.feedback = 40
          alerts.push(`NPS faible: ${nps.toFixed(1)}`)
        } else if (nps <= 8) {
          factors.feedback = 75
        } else {
          factors.feedback = 100
        }
      }

      // Calcul du score global
      const score = Math.round(
        factors.adoption * 0.30 +
        factors.support * 0.20 +
        factors.payment * 0.20 +
        factors.engagement * 0.15 +
        factors.feedback * 0.15
      )

      // Déterminer le statut
      let status: CustomerHealthStatus
      if (score >= 80) {
        status = 'healthy'
      } else if (score >= 60) {
        status = 'at-risk'
        alerts.push('Client à risque - Attention requise')
      } else if (score >= 40) {
        status = 'churn-risk'
        alerts.push('Risque de churn élevé - Action urgente')
      } else {
        status = 'critical'
        alerts.push('Situation critique - Escalation immédiate')
      }

      // Alerte renouvellement
      if (metrics?.contract_end_date) {
        const daysUntilRenewal = Math.floor((new Date(metrics.contract_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysUntilRenewal < 0) {
          alerts.push('Contrat expiré')
        } else if (daysUntilRenewal < 15) {
          alerts.push(`Renouvellement dans ${daysUntilRenewal} jours`)
        } else if (daysUntilRenewal < 30) {
          alerts.push(`Renouvellement dans ${daysUntilRenewal} jours`)
        } else if (daysUntilRenewal < 90) {
          alerts.push(`Renouvellement dans ${Math.round(daysUntilRenewal / 30)} mois`)
        }
      }

      healthMap.set(etablissement.id, { score, status, factors, alerts })
    })

    return healthMap
  }, [etablissements, healthMetrics])
}

export function getHealthColor(status: CustomerHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-success'
    case 'at-risk':
      return 'text-warning'
    case 'churn-risk':
      return 'text-destructive'
    case 'critical':
      return 'text-destructive'
    case 'onboarding':
      return 'text-primary'
  }
}

export function getHealthBadgeColor(status: CustomerHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-success/10 text-success border-success/20'
    case 'at-risk':
      return 'bg-warning/10 text-warning border-warning/20'
    case 'churn-risk':
      return 'bg-destructive/10 text-destructive border-destructive/20'
    case 'critical':
      return 'bg-destructive/20 text-destructive border-destructive/30'
    case 'onboarding':
      return 'bg-primary/10 text-primary border-primary/20'
  }
}

export function getHealthLabel(status: CustomerHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Bon'
    case 'at-risk':
      return 'At Risk'
    case 'churn-risk':
      return 'Churn Risk'
    case 'critical':
      return 'Critical'
    case 'onboarding':
      return 'Onboarding'
  }
}

export function getHealthIcon(status: CustomerHealthStatus): string {
  switch (status) {
    case 'healthy':
      return '🟢'
    case 'at-risk':
      return '🟠'
    case 'churn-risk':
      return '🔴'
    case 'critical':
      return '🚨'
    case 'onboarding':
      return '🆕'
  }
}
