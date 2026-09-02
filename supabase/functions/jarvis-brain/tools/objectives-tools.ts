/**
 * JARVIS V11.0 - Objectives Tools
 *
 * Outils pour la gestion des objectifs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Edge functions use a service-role key for one-off database calls; they do not
// own a browser session that needs persistence or token refresh timers.
function createSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export interface ObjectiveInput {
  title: string
  description?: string
  category: 'revenue' | 'productivity' | 'quality' | 'growth' | 'custom'
  target_metric: string
  target_value: number
  unit?: string
  end_date: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Créer un nouvel objectif
 */
export async function createObjective(
  userId: string,
  input: ObjectiveInput
): Promise<{ success: boolean; objective?: any; error?: string }> {
  try {
    const supabase = createSupabaseClient()

    const milestones = [
      { value: input.target_value * 0.25, label: '25%', achieved: false, achieved_at: null },
      { value: input.target_value * 0.5, label: '50%', achieved: false, achieved_at: null },
      { value: input.target_value * 0.75, label: '75%', achieved: false, achieved_at: null },
      { value: input.target_value, label: '100%', achieved: false, achieved_at: null },
    ]

    const { data, error } = await supabase
      .from('jarvis_objectives')
      .insert({
        user_id: userId,
        title: input.title,
        description: input.description || null,
        category: input.category,
        target_metric: input.target_metric,
        target_value: input.target_value,
        current_value: 0,
        unit: input.unit || '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: input.end_date,
        status: 'active',
        priority: input.priority || 'medium',
        milestones,
        progress_history: [],
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, objective: data }
  } catch (error: unknown) {
    console.error('[Objectives Tools] Create error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Mettre à jour la progression d'un objectif
 */
export async function updateObjectiveProgress(
  userId: string,
  objectiveId: string,
  newValue: number,
  note?: string
): Promise<{ success: boolean; objective?: any; error?: string }> {
  try {
    const supabase = createSupabaseClient()

    // Récupérer l'objectif actuel
    const { data: current, error: fetchError } = await supabase
      .from('jarvis_objectives')
      .select('*')
      .eq('id', objectiveId)
      .eq('user_id', userId)
      .single()

    if (fetchError) throw fetchError
    if (!current) throw new Error('Objectif non trouvé')

    const previousValue = current.current_value || 0
    const progressHistory = current.progress_history || []

    // Ajouter au historique
    progressHistory.push({
      date: new Date().toISOString(),
      value: newValue,
      delta: newValue - previousValue,
      note: note || null,
    })

    // Mettre à jour les milestones
    const milestones = current.milestones || []
    for (const milestone of milestones) {
      if (!milestone.achieved && newValue >= milestone.value) {
        milestone.achieved = true
        milestone.achieved_at = new Date().toISOString()
      }
    }

    // Déterminer le nouveau statut
    let newStatus = current.status
    if (newValue >= current.target_value) {
      newStatus = 'completed'
    }

    const { data, error } = await supabase
      .from('jarvis_objectives')
      .update({
        current_value: newValue,
        progress_history: progressHistory,
        milestones,
        status: newStatus,
      })
      .eq('id', objectiveId)
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      objective: data,
    }
  } catch (error: unknown) {
    console.error('[Objectives Tools] Update error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Lister les objectifs d'un utilisateur
 */
export async function listObjectives(
  userId: string,
  status?: string
): Promise<{ success: boolean; objectives?: any[]; error?: string }> {
  try {
    const supabase = createSupabaseClient()

    let query = supabase
      .from('jarvis_objectives')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, objectives: data }
  } catch (error: unknown) {
    console.error('[Objectives Tools] List error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Analyser la progression vers les objectifs
 */
export async function analyzeObjectivesProgress(userId: string): Promise<{
  success: boolean
  summary?: {
    total: number
    active: number
    completed: number
    onTrack: number
    behind: number
    recommendations: string[]
  }
  error?: string
}> {
  try {
    const supabase = createSupabaseClient()

    const { data: objectives, error } = await supabase
      .from('jarvis_objectives')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error

    const now = new Date()
    let onTrack = 0
    let behind = 0
    const recommendations: string[] = []

    const activeObjectives = objectives?.filter((o) => o.status === 'active') || []

    for (const obj of activeObjectives) {
      const startDate = new Date(obj.start_date)
      const endDate = new Date(obj.end_date)
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

      const expectedProgress = (daysElapsed / totalDays) * 100
      const actualProgress = obj.target_value > 0 ? (obj.current_value / obj.target_value) * 100 : 0

      if (actualProgress >= expectedProgress * 0.9) {
        onTrack++
      } else {
        behind++
        const gap = expectedProgress - actualProgress
        if (gap > 20) {
          recommendations.push(
            `⚠️ "${obj.title}" est en retard de ${gap.toFixed(0)}% - action urgente requise`
          )
        }
      }
    }

    return {
      success: true,
      summary: {
        total: objectives?.length || 0,
        active: activeObjectives.length,
        completed: objectives?.filter((o) => o.status === 'completed').length || 0,
        onTrack,
        behind,
        recommendations,
      },
    }
  } catch (error: unknown) {
    console.error('[Objectives Tools] Analyze error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Définitions des outils pour le registry
export const OBJECTIVES_TOOL_DEFINITIONS = [
  {
    name: 'create_objective',
    description:
      "Créer un nouvel objectif business pour l'utilisateur. Les objectifs peuvent être liés au CA, à la productivité, à la qualité ou à la croissance.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: "Titre de l'objectif" },
        description: { type: 'string', description: 'Description détaillée (optionnel)' },
        category: {
          type: 'string',
          enum: ['revenue', 'productivity', 'quality', 'growth', 'custom'],
          description: "Catégorie de l'objectif",
        },
        target_metric: {
          type: 'string',
          description: 'Métrique cible (ca_mensuel, taches_completees, satisfaction_moyenne, etc.)',
        },
        target_value: { type: 'number', description: 'Valeur cible à atteindre' },
        unit: { type: 'string', description: 'Unité de mesure (€, %, count)' },
        end_date: { type: 'string', description: 'Date limite au format YYYY-MM-DD' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: "Priorité de l'objectif",
        },
      },
      required: ['title', 'category', 'target_metric', 'target_value', 'end_date'],
    },
    security_level: 'moderate',
  },
  {
    name: 'update_objective_progress',
    description: "Mettre à jour manuellement la progression d'un objectif",
    parameters: {
      type: 'object',
      properties: {
        objective_id: { type: 'string', description: "ID de l'objectif" },
        new_value: { type: 'number', description: 'Nouvelle valeur actuelle' },
        note: { type: 'string', description: 'Note explicative (optionnel)' },
      },
      required: ['objective_id', 'new_value'],
    },
    security_level: 'safe',
  },
  {
    name: 'list_objectives',
    description: "Lister les objectifs de l'utilisateur, avec filtrage optionnel par statut",
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'failed', 'cancelled'],
          description: 'Filtrer par statut (optionnel)',
        },
      },
      required: [],
    },
    security_level: 'safe',
  },
  {
    name: 'analyze_objectives',
    description:
      'Analyser la progression globale vers les objectifs et obtenir des recommandations',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    security_level: 'safe',
  },
]
