import { useMemo, useCallback } from "react"
import { useEtablissements } from "../crm/useEtablissements"
import { useTaches } from "../tasks/useTaches"
import { useProfiles, useCurrentProfile } from "../profile/useProfiles"
import { Activity, ActivityPriority } from "@/components/dashboard/ActivityCard"

interface TaskMetrics {
  tasksCompleted: number
  tasksPending: number
  tasksUrgent: number
}

interface EtablissementWithActivity {
  id: string
  nom: string
  statut: string
  updated_at: string
  created_at: string
}

interface TacheWithActivity {
  id: string
  titre: string
  statut: string
  etablissement_id: string
  responsable_id?: string
  echeance?: string
  created_at: string
  updated_at: string
}

/** Champs supplémentaires (jointures groupe, updated_by) non strictement typés par useEtablissements */
type EtabExtras = {
  logo_url?: string | null
  groupe_logo_url?: string | null
  updated_by?: string | null
}
const withExtras = <T,>(e: T) => e as T & EtabExtras

export function useActivityFeed() {
  const { data: etablissements, isLoading: etablissementsLoading } = useEtablissements()
  const { data: allTaches, isLoading: tachesLoading } = useTaches()
  const { data: profiles } = useProfiles()
  const { data: currentProfile } = useCurrentProfile()

  const isLoading = etablissementsLoading || tachesLoading

  // Créer un mapping des établissements par ID
  const etablissementsMap = useMemo(() => {
    if (!etablissements) return new Map()
    return new Map(etablissements.map(e => [e.id, e]))
  }, [etablissements])

  // Créer un mapping des profils par ID
  const profilesMap = useMemo(() => {
    if (!profiles) return new Map()
    return new Map(profiles.map(p => [p.id, p]))
  }, [profiles])

  // Fonction pour déterminer la priorité d'une activité
  const calculatePriority = useCallback((
    type: Activity['type'],
    statut: string,
    urgentTasksCount: number
  ): ActivityPriority => {
    // Critical: Tâches urgentes non traitées ou statuts bloquants
    if (urgentTasksCount > 0 || statut === 'Bloqué') return 'critical'
    
    // High: Changements de statut importants ou nouvelles tâches
    if (type === 'status_change' && ['Négociation', 'Contractualisation', 'Vendu'].includes(statut)) {
      return 'high'
    }
    if (type === 'task_added') return 'high'
    
    // Medium: Autres changements de statut
    if (type === 'status_change') return 'medium'
    
    // Low: Modifications mineures
    return 'low'
  }, [])

  // Pre-compute task metrics per etablissement using a Map - O(n) instead of O(n*m)
  const taskMetricsByEtab = useMemo(() => {
    if (!allTaches) return new Map<string, TaskMetrics>()
    
    const today = new Date()
    const metricsMap = new Map<string, TaskMetrics>()
    
    // Group tasks by etablissement_id
    const tasksByEtab = new Map<string, typeof allTaches>()
    for (const task of allTaches) {
      const existing = tasksByEtab.get(task.etablissement_id) || []
      existing.push(task)
      tasksByEtab.set(task.etablissement_id, existing)
    }
    
    // Calculate metrics once per etablissement
    for (const [etabId, tasks] of tasksByEtab) {
      let completed = 0
      let pending = 0
      let urgent = 0
      
      for (const t of tasks) {
        if (t.statut === 'Terminé') {
          completed++
        } else {
          pending++
          // Check if urgent
          if (t.echeance) {
            const echeance = new Date(t.echeance)
            const diffDays = Math.ceil((echeance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays <= 7 && diffDays >= 0) {
              urgent++
            }
          }
        }
      }
      
      metricsMap.set(etabId, { tasksCompleted: completed, tasksPending: pending, tasksUrgent: urgent })
    }
    
    return metricsMap
  }, [allTaches])

  // Helper to get metrics from precomputed Map
  const getTaskMetrics = useCallback((etablissementId: string): TaskMetrics => {
    return taskMetricsByEtab.get(etablissementId) || { tasksCompleted: 0, tasksPending: 0, tasksUrgent: 0 }
  }, [taskMetricsByEtab])

  // Mon Activité (établissements que j'ai modifiés)
  const myActivity = useMemo((): Activity[] => {
    if (!etablissements || !currentProfile) return []
    
    return etablissements
      .filter(e => {
        // Filtrer par utilisateur connecté via updated_by
        const etabWithUpdatedBy = withExtras(e)
        return e.updated_at && etabWithUpdatedBy.updated_by === currentProfile.user_id
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
      .map(e => {
        const taskMetrics = getTaskMetrics(e.id)
        const priority = calculatePriority('modification', e.statut, taskMetrics.tasksUrgent)
        const etabWithLogo = withExtras(e)
        
        return {
          id: `activity-${e.id}`,
          etablissementId: e.id,
          etablissementNom: e.nom,
          etablissementLogo: etabWithLogo.logo_url || etabWithLogo.groupe_logo_url || null,
          statut: e.statut,
          type: 'modification' as const,
          description: `Dernière modification de l'établissement`,
          timestamp: e.updated_at,
          priority,
          ...taskMetrics
        }
      })
  }, [etablissements, currentProfile, getTaskMetrics, calculatePriority])

  // Actions Requises (établissements nécessitant une attention)
  const requiredActions = useMemo((): Activity[] => {
    if (!etablissements || !allTaches || !currentProfile) return []
    
    const actions: Activity[] = []
    
    // 1. Établissements avec tâches urgentes
    etablissements.forEach(e => {
      const taskMetrics = getTaskMetrics(e.id)
      const etabWithLogo = withExtras(e)
      
      if (taskMetrics.tasksUrgent > 0) {
        actions.push({
          id: `urgent-${e.id}`,
          etablissementId: e.id,
          etablissementNom: e.nom,
          etablissementLogo: etabWithLogo.logo_url || etabWithLogo.groupe_logo_url || null,
          statut: e.statut,
          type: 'task_added',
          description: `${taskMetrics.tasksUrgent} tâche${taskMetrics.tasksUrgent > 1 ? 's' : ''} urgente${taskMetrics.tasksUrgent > 1 ? 's' : ''} à traiter`,
          timestamp: e.updated_at,
          priority: 'critical',
          ...taskMetrics
        })
      }
    })
    
    // 2. Établissements bloqués
    etablissements
      .filter(e => e.statut === 'Bloqué')
      .forEach(e => {
        const taskMetrics = getTaskMetrics(e.id)
        const etabWithLogo = withExtras(e)
        actions.push({
          id: `blocked-${e.id}`,
          etablissementId: e.id,
          etablissementNom: e.nom,
          etablissementLogo: etabWithLogo.logo_url || etabWithLogo.groupe_logo_url || null,
          statut: e.statut,
          type: 'status_change',
          description: 'Établissement bloqué - action requise pour débloquer',
          timestamp: e.updated_at,
          priority: 'critical',
          ...taskMetrics
        })
      })
    
    // 3. Établissements en négociation/contractualisation sans activité récente (> 7 jours)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    etablissements
      .filter(e => ['Négociation', 'Contractualisation'].includes(e.statut))
      .filter(e => new Date(e.updated_at) < sevenDaysAgo)
      .forEach(e => {
        const taskMetrics = getTaskMetrics(e.id)
        const etabWithLogo = withExtras(e)
        actions.push({
          id: `stale-${e.id}`,
          etablissementId: e.id,
          etablissementNom: e.nom,
          etablissementLogo: etabWithLogo.logo_url || etabWithLogo.groupe_logo_url || null,
          statut: e.statut,
          type: 'status_change',
          description: 'Aucune activité depuis plus de 7 jours - relance nécessaire',
          timestamp: e.updated_at,
          priority: 'high',
          ...taskMetrics
        })
      })
    
    return actions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [etablissements, allTaches, currentProfile, getTaskMetrics])

  // Activité Équipe (modifications par d'autres membres)
  const teamActivity = useMemo((): Activity[] => {
    if (!etablissements || !allTaches || !currentProfile) return []
    
    // Tâches récemment créées par d'autres membres
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const recentTasks = allTaches
      .filter(t => new Date(t.created_at) > sevenDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(t => {
        const etablissement = etablissementsMap.get(t.etablissement_id)
        if (!etablissement) return null
        
        const responsable = t.responsable_id ? profilesMap.get(t.responsable_id) : null
        const taskMetrics = getTaskMetrics(t.etablissement_id)
        const etabWithLogo = withExtras(etablissement)
        
        return {
          id: `task-${t.id}`,
          etablissementId: t.etablissement_id,
          etablissementNom: etablissement.nom,
          etablissementLogo: etabWithLogo.logo_url || etabWithLogo.groupe_logo_url || null,
          statut: etablissement.statut,
          type: 'task_added' as const,
          description: t.titre,
          timestamp: t.created_at,
          userId: t.responsable_id,
          userName: responsable?.nom || undefined,
          priority: calculatePriority('task_added', etablissement.statut, taskMetrics.tasksUrgent),
          ...taskMetrics
        }
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
    
    return recentTasks as Activity[]
  }, [etablissements, allTaches, currentProfile, etablissementsMap, profilesMap, getTaskMetrics, calculatePriority])

  return {
    myActivity,
    requiredActions,
    teamActivity,
    isLoading
  }
}
