import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useDebouncedValue } from '@/hooks/shared/useDebouncedValue'
import { debug } from '@/lib/debug'
import type { ReceiptStatus } from '@/components/pulse/MessageReadReceipt'
import { pulseUnreadKeys } from '@/hooks/pulse/usePulseUnreadCount'

interface MessageReceipt {
  message_id: string
  user_id: string
  delivered_at: string | null
  read_at: string | null
}

interface ReceiptMessageMeta {
  id: string
  user_id: string
  created_at: string
}

interface ConversationMemberReadState {
  user_id: string
  last_read_at: string | null
}

interface ConversationMemberReadStateResult {
  members: ConversationMemberReadState[]
  count: number
}

interface ReceiptPayload {
  receipts: MessageReceipt[]
  messages: ReceiptMessageMeta[]
}

interface ReceiptSummary {
  deliveredCount: number
  readCount: number
  totalRecipients: number
  status: ReceiptStatus
}

const DEFAULT_SUMMARY: ReceiptSummary = {
  deliveredCount: 0,
  readCount: 0,
  totalRecipients: 0,
  status: 'sent',
}

/**
 * Hook pour gérer les accusés de réception des messages
 * Optimisé avec debounce et memoization pour réduire les re-renders
 */
export function usePulseMessageReceipts(conversationId: string | undefined) {
  const { data: profile } = useCurrentProfile()
  const queryClient = useQueryClient()
  const invalidateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const makeRealtimeChannelId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }, [])

  // Debouncer le conversationId pour ne charger les receipts qu'après stabilisation (500ms)
  // Cela évite de lancer des requêtes pendant la navigation rapide entre conversations
  const stableConversationId = useDebouncedValue(conversationId, 200)

  // Debounced invalidation pour éviter les rafales de re-renders
  const debouncedInvalidate = useCallback(() => {
    if (invalidateTimeoutRef.current) {
      clearTimeout(invalidateTimeoutRef.current)
    }
    invalidateTimeoutRef.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: ['pulse-message-receipts', stableConversationId],
      })
    }, 150)
  }, [stableConversationId, queryClient])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (invalidateTimeoutRef.current) {
        clearTimeout(invalidateTimeoutRef.current)
      }
    }
  }, [])

  // Récupérer les accusés pour tous les messages de la conversation
  // Utiliser le stableConversationId pour éviter les requêtes pendant navigation rapide
  const { data: receiptPayload = { receipts: [], messages: [] } } = useQuery({
    queryKey: ['pulse-message-receipts', stableConversationId],
    queryFn: async () => {
      if (!stableConversationId) return { receipts: [], messages: [] } satisfies ReceiptPayload

      try {
        // D'abord récupérer les IDs des messages
        const { data: messages, error: messagesError } = await supabase
          .from('pulse_messages' as const)
          .select('id, user_id, created_at')
          .eq('conversation_id', stableConversationId)

        if (messagesError || !messages?.length) {
          return { receipts: [], messages: [] } satisfies ReceiptPayload
        }

        const messageMeta = messages as ReceiptMessageMeta[]
        const messageIds = messageMeta.map((m) => m.id)

        const { data, error } = await supabase
          .from('pulse_message_receipts')
          .select('message_id, user_id, delivered_at, read_at')
          .in('message_id', messageIds)

        if (error) {
          if (import.meta.env.DEV) debug.error('[PulseReceipts] Error fetching receipts:', error)
          return { receipts: [], messages: messageMeta } satisfies ReceiptPayload
        }

        return {
          receipts: data as MessageReceipt[],
          messages: messageMeta,
        } satisfies ReceiptPayload
      } catch (err) {
        // Erreur silencieuse pour ne pas bloquer l'UI (logging en DEV uniquement)
        if (import.meta.env.DEV) debug.error('[PulseReceipts] Error fetching receipts:', err)
        return { receipts: [], messages: [] } satisfies ReceiptPayload
      }
    },
    enabled: !!stableConversationId,
    staleTime: 30000,
    retry: 1,
    // Garder les données précédentes visibles pendant le chargement
    placeholderData: (previousData) => previousData,
  })

  const receipts = receiptPayload.receipts
  const receiptMessages = receiptPayload.messages

  // Récupérer les membres et leur dernière lecture : c'est le fallback le plus fiable
  // quand les receipts détaillés ont été créés avant l'ouverture du fil.
  const { data: memberReadState = { members: [], count: 1 } } = useQuery({
    queryKey: ['pulse-conversation-member-read-state', stableConversationId],
    queryFn: async () => {
      if (!stableConversationId) {
        return { members: [], count: 1 } satisfies ConversationMemberReadStateResult
      }

      const { data, count, error } = await supabase
        .from('pulse_conversation_members')
        .select('user_id, last_read_at', { count: 'exact' })
        .eq('conversation_id', stableConversationId)

      if (error) {
        debug.error('Error fetching member count:', error)
        return { members: [], count: 1 } satisfies ConversationMemberReadStateResult
      }

      const members = Array.isArray(data) ? (data as ConversationMemberReadState[]) : []
      return {
        members,
        count: count || members.length || 1,
      } satisfies ConversationMemberReadStateResult
    },
    enabled: !!stableConversationId,
    staleTime: 60000,
  })

  const memberCount = memberReadState.count

  // Précalculer les statuts de tous les messages en une seule passe
  const receiptsByMessageId = useMemo(() => {
    const map = new Map<string, ReceiptSummary>()
    const fallbackTotalRecipients = Math.max(memberCount - 1, 0) // Exclure l'auteur
    const members = memberReadState.members
    const messageMetaById = new Map(receiptMessages.map((message) => [message.id, message]))

    // Grouper les receipts par message_id
    const groupedReceipts = new Map<string, MessageReceipt[]>()
    for (const receipt of receipts) {
      const existing = groupedReceipts.get(receipt.message_id) || []
      existing.push(receipt)
      groupedReceipts.set(receipt.message_id, existing)
    }

    const messageIds = new Set<string>([
      ...receiptMessages.map((message) => message.id),
      ...groupedReceipts.keys(),
    ])

    // Calculer le statut pour chaque message connu
    for (const messageId of messageIds) {
      const messageReceipts = groupedReceipts.get(messageId) || []
      const messageMeta = messageMetaById.get(messageId)
      const recipients = messageMeta
        ? members.filter((member) => member.user_id !== messageMeta.user_id)
        : []
      const totalRecipients = recipients.length > 0 ? recipients.length : fallbackTotalRecipients
      const deliveredCount = messageReceipts.filter((r) => r.delivered_at).length
      const readUserIds = new Set(messageReceipts.filter((r) => r.read_at).map((r) => r.user_id))

      if (messageMeta) {
        const messageTime = new Date(messageMeta.created_at).getTime()
        for (const recipient of recipients) {
          if (!recipient.last_read_at) continue
          if (new Date(recipient.last_read_at).getTime() >= messageTime) {
            readUserIds.add(recipient.user_id)
          }
        }
      }

      const readCount = readUserIds.size

      // 1 coche = non lu, 2 coches bleues = lu
      // On ignore volontairement l'état "delivered" pour ne pas afficher 2 coches grises
      let status: ReceiptStatus = 'sent'
      if (readCount > 0) {
        status = 'read'
      }

      map.set(messageId, {
        deliveredCount,
        readCount,
        totalRecipients,
        status,
      })
    }

    return map
  }, [receipts, receiptMessages, memberCount, memberReadState.members])

  // Marquer les messages comme lus (utilise conversationId direct, pas le debounced)
  const markAsRead = useMutation({
    mutationFn: async () => {
      if (!conversationId || !profile?.id) return

      const { error } = await supabase.rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: profile.id,
      })

      if (error) {
        debug.error('Error marking messages as read:', error)
        throw error
      }
    },
    onSuccess: () => {
      debouncedInvalidate()
      // Invalider aussi le compteur de badges global
      queryClient.invalidateQueries({
        queryKey: pulseUnreadKeys.total,
      })
    },
  })

  // Marquer les messages comme délivrés (appelé au chargement)
  const markAsDelivered = useMutation({
    mutationFn: async () => {
      if (!profile?.id) return

      const { error } = await supabase.rpc('mark_messages_as_delivered', {
        p_user_id: profile.id,
      })

      if (error) {
        // Accusé de réception best-effort, déclenché au montage : quand
        // l'utilisateur change de page aussitôt, la requête est annulée et
        // remonte en `TypeError: Failed to fetch`. Ce n'est pas une anomalie
        // applicative et cela n'a aucune conséquence fonctionnelle (le
        // marquage sera rejoué au prochain montage) — on n'en fait donc pas
        // une erreur, sinon la console se remplit de faux signaux.
        const isNetworkAbort = /failed to fetch|networkerror|load failed|aborted/i.test(
          error.message ?? ''
        )
        if (isNetworkAbort) {
          debug.warn('Accusé de réception Pulse ignoré (requête interrompue):', error.message)
          return
        }
        debug.error('Error marking messages as delivered:', error)
        throw error
      }
    },
    onSuccess: () => {
      debouncedInvalidate()
    },
  })

  // Écouter les changements en temps réel avec debounce
  useEffect(() => {
    if (!stableConversationId) return

    const channelName = `receipts-${stableConversationId}-${makeRealtimeChannelId()}`
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pulse_message_receipts',
          },
          () => {
            // Utiliser le debounce au lieu d'invalider immédiatement
            debouncedInvalidate()
          }
        )
        .subscribe()
    } catch (error) {
      debug.error('[PulseReceipts] Realtime subscription failed:', error)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [stableConversationId, debouncedInvalidate, makeRealtimeChannelId])

  // Marquer comme délivré au montage (une seule fois)
  useEffect(() => {
    if (profile?.id) {
      markAsDelivered.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Calculer le statut d'un message - O(1) grâce à la Map précalculée
  const getMessageReceiptStatus = useCallback(
    (messageId: string, _authorId: string, isOwnMessage: boolean): ReceiptSummary => {
      if (!isOwnMessage) {
        return DEFAULT_SUMMARY
      }

      const fallbackTotalRecipients = Math.max(
        memberReadState.members.filter((member) => member.user_id !== _authorId).length ||
          memberCount - 1,
        0
      )

      return (
        receiptsByMessageId.get(messageId) || {
          ...DEFAULT_SUMMARY,
          totalRecipients: fallbackTotalRecipients,
        }
      )
    },
    [receiptsByMessageId, memberCount, memberReadState.members]
  )

  // `mutation.mutate` est stable entre les renders — on le référence directement
  // pour que les consommateurs (useEffect avec markAsRead en dep) ne se re-déclenchent pas.
  const markAsReadMutate = markAsRead.mutate
  const markAsDeliveredMutate = markAsDelivered.mutate
  const markAsReadStable = useCallback(() => {
    markAsReadMutate()
  }, [markAsReadMutate])
  const markAsDeliveredStable = useCallback(() => {
    markAsDeliveredMutate()
  }, [markAsDeliveredMutate])

  return {
    receipts,
    markAsRead: markAsReadStable,
    markAsDelivered: markAsDeliveredStable,
    getMessageReceiptStatus,
    isGroupChat: memberCount > 2,
  }
}
