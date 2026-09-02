import { useMemo } from 'react'
import type { Etablissement } from '@/hooks/crm/useEtablissements'
import type { DeploymentHealthStatus } from './useDeploymentFilters'

export interface HealthScore {
  score: number
  status: DeploymentHealthStatus
  reasons: string[]
}

export function useDeploymentHealth(
  etablissements: Etablissement[],
  tasksStats?: Map<string, { total: number; onTime: number; delayed: number; blocked: number }>
) {
  return useMemo(() => {
    const healthMap = new Map<string, HealthScore>()

    etablissements.forEach(etablissement => {
      const reasons: string[] = []
      let score = 100

      // Critère 1 : Progression vs temps écoulé (40 points)
      const daysSinceSignature = etablissement.date_signature
        ? Math.floor((Date.now() - new Date(etablissement.date_signature).getTime()) / (1000 * 60 * 60 * 24))
        : 0

      const progression = etablissement.progression || 0
      const expectedProgression = Math.min(100, daysSinceSignature * 2) // Attend ~2% par jour

      if (progression < expectedProgression - 20) {
        score -= 40
        reasons.push('Progression lente par rapport au temps écoulé')
      } else if (progression < expectedProgression - 10) {
        score -= 20
        reasons.push('Progression légèrement en retard')
      }

      // Critère 2 : Tâches dans les délais (30 points)
      const tasks = tasksStats?.get(etablissement.id)
      if (tasks) {
        const delayRate = tasks.total > 0 ? tasks.delayed / tasks.total : 0
        if (delayRate > 0.3) {
          score -= 30
          reasons.push(`${tasks.delayed} tâche(s) en retard`)
        } else if (delayRate > 0.15) {
          score -= 15
          reasons.push(`${tasks.delayed} tâche(s) en retard`)
        }

        // Critère 3 : Bloqueurs critiques (20 points)
        if (tasks.blocked > 0) {
          score -= 20 * Math.min(tasks.blocked, 2)
          reasons.push(`${tasks.blocked} bloqueur(s) critique(s)`)
        }
      }

      // Critère 4 : Équipe assignée (10 points)
      if (!etablissement.csm_id || !etablissement.chef_projet_id) {
        score -= 10
        reasons.push('Équipe incomplète')
      }

      // Déterminer le statut
      let status: DeploymentHealthStatus
      if (score >= 80) {
        status = 'healthy'
      } else if (score >= 60) {
        status = 'at-risk'
      } else if (score >= 40) {
        status = 'delayed'
      } else {
        status = 'blocked'
      }

      healthMap.set(etablissement.id, { score, status, reasons })
    })

    return healthMap
  }, [etablissements, tasksStats])
}

export function getHealthColor(status: DeploymentHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'text-green-600 dark:text-green-400'
    case 'at-risk':
      return 'text-orange-600 dark:text-orange-400'
    case 'delayed':
      return 'text-red-600 dark:text-red-400'
    case 'blocked':
      return 'text-red-700 dark:text-red-500'
  }
}

export function getHealthBadgeColor(status: DeploymentHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
    case 'at-risk':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800'
    case 'delayed':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
    case 'blocked':
      return 'bg-red-200 text-red-900 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700'
  }
}

export function getHealthLabel(status: DeploymentHealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Dans les temps'
    case 'at-risk':
      return 'À risque'
    case 'delayed':
      return 'En retard'
    case 'blocked':
      return 'Bloqué'
  }
}

export function getHealthIcon(status: DeploymentHealthStatus): string {
  switch (status) {
    case 'healthy':
      return '🟢'
    case 'at-risk':
      return '🟠'
    case 'delayed':
      return '🔴'
    case 'blocked':
      return '🚨'
  }
}
