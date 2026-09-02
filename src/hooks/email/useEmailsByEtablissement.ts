import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryPresets } from '@/lib/queryPresets'

interface EmailThread {
  id: string
  subject: string | null
  message_count: number
  unread_count: number
  last_message_date: string | null
  is_archived: boolean | null
  created_at: string
}

interface EtablissementEmailStats {
  etablissement_id: string
  etablissement_nom: string
  etablissement_ville: string
  total_threads: number
  total_messages: number
  unread_count: number
  last_message_date: string | null
  avg_response_time_hours: number | null
  active_threads: number
  archived_threads: number
  relationship_status: string
  engagement_score: number
  last_email_received_at: string | null
  last_email_sent_at: string | null
  threads: EmailThread[]
}

export function useEmailsByEtablissement() {
  return useQuery({
    queryKey: ['emails-by-etablissement'],
    queryFn: async () => {
      // Récupérer tous les threads avec leurs messages et établissements
      const { data: threads, error } = await supabase
        .from('email_threads')
        .select(
          `
          id,
          etablissement_id,
          subject,
          message_count,
          unread_count,
          last_message_date,
          is_archived,
          created_at,
          etablissement:etablissements (
            id,
            nom,
            ville,
            statut,
            relationship_status,
            engagement_score,
            last_email_received_at,
            last_email_sent_at
          ),
          messages:email_messages (
            id,
            sent_date,
            from_address,
            is_sent
          )
        `
        )
        .order('last_message_date', { ascending: false })
        .limit(2000)

      if (error) throw error

      // Grouper par établissement et calculer les statistiques
      const statsMap = new Map<string, EtablissementEmailStats>()

      threads?.forEach((thread) => {
        if (!thread.etablissement_id || !thread.etablissement) return

        const etablissementId = thread.etablissement_id
        const etablissement = thread.etablissement

        if (!statsMap.has(etablissementId)) {
          statsMap.set(etablissementId, {
            etablissement_id: etablissementId,
            etablissement_nom: etablissement.nom,
            etablissement_ville: etablissement.ville,
            total_threads: 0,
            total_messages: 0,
            unread_count: 0,
            last_message_date: null,
            avg_response_time_hours: null,
            active_threads: 0,
            archived_threads: 0,
            relationship_status: etablissement.relationship_status || 'prospect',
            engagement_score: etablissement.engagement_score || 0,
            last_email_received_at: etablissement.last_email_received_at,
            last_email_sent_at: etablissement.last_email_sent_at,
            threads: [],
          })
        }

        const stats = statsMap.get(etablissementId)!

        stats.total_threads++
        stats.total_messages += thread.message_count || 0
        stats.unread_count += thread.unread_count || 0
        stats.threads.push(thread)

        if (thread.is_archived) {
          stats.archived_threads++
        } else {
          stats.active_threads++
        }

        // Mettre à jour la date du dernier message
        if (
          thread.last_message_date &&
          (!stats.last_message_date ||
            new Date(thread.last_message_date) > new Date(stats.last_message_date))
        ) {
          stats.last_message_date = thread.last_message_date
        }

        // Calculer le temps de réponse moyen (simplifié)
        // On calcule le temps entre les messages reçus et les messages envoyés
        if (thread.messages && thread.messages.length > 1) {
          const sortedMessages = [...thread.messages].sort(
            (a, b) => new Date(a.sent_date).getTime() - new Date(b.sent_date).getTime()
          )

          const responseTimes: number[] = []
          for (let i = 0; i < sortedMessages.length - 1; i++) {
            const currentMsg = sortedMessages[i]
            const nextMsg = sortedMessages[i + 1]

            // Si on reçoit un message puis on envoie une réponse
            if (!currentMsg.is_sent && nextMsg.is_sent) {
              const timeDiff =
                new Date(nextMsg.sent_date).getTime() - new Date(currentMsg.sent_date).getTime()
              const hours = timeDiff / (1000 * 60 * 60)
              responseTimes.push(hours)
            }
          }

          if (responseTimes.length > 0) {
            const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            stats.avg_response_time_hours = Math.round(avgTime * 10) / 10
          }
        }
      })

      // Convertir en tableau et trier par nombre de threads décroissant
      return Array.from(statsMap.values()).sort((a, b) => b.total_threads - a.total_threads)
    },
    ...queryPresets.standard,
    meta: {
      errorMessage: 'Impossible de charger les statistiques emails par établissement',
    },
  })
}
