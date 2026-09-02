/**
 * @fileoverview Hooks pour la messagerie instantanée Pulse.
 *
 * Ce module fournit des hooks React Query pour la messagerie temps réel,
 * incluant l'envoi, la modification, la suppression de messages,
 * les réactions et la synchronisation en temps réel via WebSocket.
 *
 * @module hooks/usePulseMessages
 * @see {@link docs/PULSE_USER_GUIDE.md} pour le guide utilisateur
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { fromExtended } from '@/lib/supabaseTyped'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'
import { safeStorage } from '@/lib/safeStorage'
import { refreshPulseMediaUrls } from '@/lib/pulseMediaUrls'
import type { PulseMessage, SendMessageInput, UpdateMessageInput } from '@/types/pulse'
import { useAuth } from '@/components/AuthProvider'

const PAGE_SIZE = 50

type PulseMessageHideRow = { message_id: string }

async function removeHiddenMessages(
  profileId: string | undefined,
  messages: PulseMessage[]
): Promise<PulseMessage[]> {
  if (messages.length === 0) return messages

  // If the profile isn't loaded yet, we still want hides to work.
  // We fetch the profile id once (cached) via auth as a fallback.
  let effectiveProfileId = profileId
  if (!effectiveProfileId) {
    try {
      effectiveProfileId = await getReliableProfileId(undefined)
    } catch {
      // If we can't resolve the profile id yet, return unfiltered messages.
      return messages
    }
  }

  const messageIds = messages.map((m) => m.id)

  const { data: hidden, error: hiddenError } = await fromExtended('pulse_message_hides')
    .select('message_id')
    .eq('user_id', effectiveProfileId)
    .in('message_id', messageIds)

  if (hiddenError) throw hiddenError

  const hiddenSet = new Set<string>(
    ((hidden || []) as unknown as PulseMessageHideRow[]).map((h) => h.message_id)
  )
  return messages.filter((m) => !hiddenSet.has(m.id))
}

// Query keys
export const pulseMessageKeys = {
  all: ['pulse-messages'] as const,
  byConversation: (convId: string) => [...pulseMessageKeys.all, 'conversation', convId] as const,
  thread: (messageId: string) => [...pulseMessageKeys.all, 'thread', messageId] as const,
  search: (convId: string, query: string) =>
    [...pulseMessageKeys.all, 'search', convId, query] as const,
}

// Fetch messages avec pagination
async function fetchMessages(
  conversationId: string,
  page: number,
  profileId: string | undefined
): Promise<{
  messages: PulseMessage[]
  hasMore: boolean
}> {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error, count } = await supabase
    .from('pulse_messages')
    .select(
      `
      *,
      user:profiles!pulse_messages_user_id_fkey(id, nom, prenom, email, avatar_url),
      reactions:pulse_reactions(id, emoji, user_id, user:profiles(id, nom, prenom, avatar_url)),
      media:pulse_media(*),
      task_links:pulse_message_task_links(
        id,
        task_id,
        link_type,
        task:taches(id, titre, statut, priorite)
      )
    `,
      { count: 'exact' }
    )
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .is('parent_message_id', null) // Exclure les réponses de thread
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw error

  const visibleMessages = await removeHiddenMessages(
    profileId,
    (data || []) as unknown as PulseMessage[]
  )
  const messages = await refreshPulseMediaUrls(visibleMessages)

  return {
    messages,
    hasMore: count ? from + PAGE_SIZE < count : false,
  }
}

// Fetch thread replies
async function fetchThreadReplies(
  parentMessageId: string,
  profileId: string | undefined
): Promise<PulseMessage[]> {
  const { data, error } = await supabase
    .from('pulse_messages')
    .select(
      `
      *,
      user:profiles!pulse_messages_user_id_fkey(id, nom, prenom, email, avatar_url),
      reactions:pulse_reactions(id, emoji, user_id),
      media:pulse_media(*)
    `
    )
    .eq('parent_message_id', parentMessageId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  const visibleMessages = await removeHiddenMessages(
    profileId,
    (data || []) as unknown as PulseMessage[]
  )
  return refreshPulseMediaUrls(visibleMessages)
}

/**
 * Hook pour récupérer les messages d'une conversation avec pagination infinie.
 *
 * Récupère les messages par pages de 50, avec leurs relations (utilisateur,
 * réactions, médias, liens de tâches). Exclut les messages masqués par l'utilisateur.
 *
 * @param {string | undefined} conversationId - ID de la conversation
 *
 * @returns {UseInfiniteQueryResult} Résultat de la query infinie
 * @property {Object[]} data.pages - Pages de messages chargées
 * @property {PulseMessage[]} data.pages[].messages - Messages de la page
 * @property {boolean} hasNextPage - Indique s'il y a plus de messages
 * @property {function} fetchNextPage - Charge la page suivante
 * @property {boolean} isFetchingNextPage - Chargement de la page suivante en cours
 *
 * @example
 * ```tsx
 * function ChatMessages({ conversationId }) {
 *   const {
 *     data,
 *     hasNextPage,
 *     fetchNextPage,
 *     isFetchingNextPage
 *   } = usePulseMessages(conversationId);
 *
 *   const allMessages = data?.pages.flatMap(p => p.messages) || [];
 *
 *   return (
 *     <VirtualizedList
 *       items={allMessages}
 *       onEndReached={() => hasNextPage && fetchNextPage()}
 *       loading={isFetchingNextPage}
 *     />
 *   );
 * }
 * ```
 *
 * @see {@link useSendPulseMessage} pour envoyer un message
 * @see {@link usePulseMessagesRealtime} pour les mises à jour temps réel
 */
export function usePulseMessages(conversationId: string | undefined) {
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id

  return useInfiniteQuery({
    queryKey: pulseMessageKeys.byConversation(conversationId || ''),
    queryFn: ({ pageParam = 0 }) => fetchMessages(conversationId!, pageParam, profileId),
    getNextPageParam: (lastPage, allPages) => (lastPage.hasMore ? allPages.length : undefined),
    enabled: !!conversationId,
    staleTime: 30 * 1000, // Messages need fresher data (30s for real-time chat)
    initialPageParam: 0,
    // Garder les données précédentes visibles pendant le chargement (évite flash blanc)
    placeholderData: (previousData) => previousData,
  })
}

// Hook: Réponses d'un thread
export function usePulseThreadReplies(parentMessageId: string | undefined) {
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id

  return useQuery({
    queryKey: pulseMessageKeys.thread(parentMessageId || ''),
    queryFn: () => fetchThreadReplies(parentMessageId!, profileId),
    enabled: !!parentMessageId,
    staleTime: 30 * 1000, // Thread replies need fresher data (30s)
  })
}

// Helper to reliably get profile ID with async fallback (memoized)
let cachedProfileId: string | null = null
let cachedProfileIdPromise: Promise<string> | null = null

async function getReliableProfileId(currentProfileId: string | undefined): Promise<string> {
  if (currentProfileId) {
    cachedProfileId = currentProfileId
    return currentProfileId
  }

  if (cachedProfileId) return cachedProfileId

  if (!cachedProfileIdPromise) {
    cachedProfileIdPromise = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Non authentifié')

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (error || !profile) throw new Error('Profil introuvable')
      cachedProfileId = profile.id
      return profile.id
    })().finally(() => {
      // allow future retries if something went wrong
      cachedProfileIdPromise = null
    })
  }

  return cachedProfileIdPromise
}

// Hook: Envoyer un message
export function useSendPulseMessage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: currentProfile } = useCurrentProfile()

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      // Use reliable profile ID fetching with fallback
      const profileId = await getReliableProfileId(currentProfile?.id)

      const { data, error } = await fromExtended('pulse_messages')
        .insert({
          conversation_id: input.conversation_id,
          user_id: profileId,
          content: input.content,
          parent_message_id: input.parent_message_id || null,
          mentions: input.mentions || [],
          message_type: 'text',
        })
        .select(
          `
          *,
          user:profiles!pulse_messages_user_id_fkey(id, nom, prenom, email, avatar_url)
        `
        )
        // safe: guaranteed-row
        .single()

      if (error) throw error

      // Mettre à jour updated_at de la conversation
      await fromExtended('pulse_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.conversation_id)

      return data as unknown as PulseMessage
    },
    onSuccess: (data) => {
      // Invalider les queries
      queryClient.invalidateQueries({
        queryKey: pulseMessageKeys.byConversation(data.conversation_id),
      })
      if (data.parent_message_id) {
        queryClient.invalidateQueries({
          queryKey: pulseMessageKeys.thread(data.parent_message_id),
        })
      }
    },
    onError: (error: Error) => {
      debug.error('Error sending message:', error)
      toast.error("Erreur lors de l'envoi du message")
    },
  })
}

// Hook: Modifier un message
export function useUpdatePulseMessage() {
  const queryClient = useQueryClient()
  const { data: currentProfile } = useCurrentProfile()

  return useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string } & UpdateMessageInput) => {
      // Use reliable profile ID fetching with fallback
      const profileId = await getReliableProfileId(currentProfile?.id)

      const { data, error } = await fromExtended('pulse_messages')
        .update({
          content,
          edited_at: new Date().toISOString(),
          edited_by: profileId,
        })
        .eq('id', messageId)
        .select()
        // safe: guaranteed-row
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data: { conversation_id: string }) => {
      queryClient.invalidateQueries({
        queryKey: pulseMessageKeys.byConversation(data.conversation_id),
      })
      toast.success('Message modifié')
    },
    onError: (error: Error) => {
      debug.error('Error updating message:', error)
      toast.error('Erreur lors de la modification')
    },
  })
}

// Hook: Masquer un message (suppression locale "pour moi")
export function useDeletePulseMessage() {
  const queryClient = useQueryClient()
  const { data: currentProfile } = useCurrentProfile()

  return useMutation({
    mutationFn: async ({
      messageId,
      conversationId,
    }: {
      messageId: string
      conversationId: string
    }) => {
      const profileId = await getReliableProfileId(currentProfile?.id)

      const { error } = await fromExtended('pulse_message_hides').upsert(
        {
          message_id: messageId,
          user_id: profileId,
          hidden_at: new Date().toISOString(),
        },
        { onConflict: 'message_id,user_id' }
      )

      if (error) throw error

      return { conversationId, messageId }
    },
    // Optimistic update: remove the message from the current cache immediately

    onMutate: async ({ messageId, conversationId }) => {
      const key = pulseMessageKeys.byConversation(conversationId)

      await queryClient.cancelQueries({ queryKey: key })

      const previous = queryClient.getQueryData(key)

      queryClient.setQueryData(key, (old: { pages?: { messages: PulseMessage[] }[] }) => {
        if (!old?.pages) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            messages: Array.isArray(p.messages)
              ? p.messages.filter((m: PulseMessage) => m.id !== messageId)
              : p.messages,
          })),
        }
      })

      return { previous, key }
    },
    onError: (error: Error, _vars, context) => {
      debug.error('Error deleting message:', error)
      if (context?.previous && context?.key) {
        queryClient.setQueryData(context.key, context.previous)
      }
      toast.error('Erreur lors de la suppression')
    },
    onSuccess: () => {
      // Optimistic update is sufficient - no invalidation to avoid re-displaying deleted message
      toast.success('Message supprimé')
    },
    onSettled: (_data, _error, variables) => {
      // Eventual consistency: refetch after a delay to sync counts (non-blocking)
      if (variables?.conversationId) {
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: pulseMessageKeys.byConversation(variables.conversationId),
          })
        }, 2000)
      }
    },
  })
}

// Hook: Ajouter une réaction
export function useAddPulseReaction() {
  const queryClient = useQueryClient()
  const { data: currentProfile } = useCurrentProfile()

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      // Use reliable profile ID fetching with fallback
      const profileId = await getReliableProfileId(currentProfile?.id)

      const { error } = await fromExtended('pulse_reactions').insert({
        message_id: messageId,
        user_id: profileId,
        emoji,
      })

      if (error) {
        // Si la réaction existe déjà, on la supprime (toggle)
        if (error.code === '23505') {
          const { error: deleteError } = await fromExtended('pulse_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', profileId)
            .eq('emoji', emoji)

          if (deleteError) throw deleteError
          return { action: 'removed' }
        }
        throw error
      }
      return { action: 'added' }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pulseMessageKeys.all })
    },
  })
}

// Hook: Realtime pour les nouveaux messages (debounced + compose-dirty guard)
const PULSE_COMPOSE_DIRTY_KEY = 'pulse-compose-dirty'
const DEBOUNCE_MS = 200
const MAX_DEFER_MS = 10000 // flush even if composing after 10s

export function usePulseMessagesRealtime(conversationId: string | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: currentProfile } = useCurrentProfile()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingInvalidationRef = useRef(false)

  // Debounced invalidation that respects compose-dirty flag
  const scheduleInvalidation = useCallback(() => {
    if (!conversationId) return

    pendingInvalidationRef.current = true

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      // If user is composing, defer but set a max-wait timer
      if (safeStorage.getItem(PULSE_COMPOSE_DIRTY_KEY) === '1') {
        debug.log('⏸️ Pulse invalidation deferred (composing)')

        // Set max-defer timer if not already set
        if (!deferTimerRef.current) {
          deferTimerRef.current = setTimeout(() => {
            debug.log('⏱️ Pulse max-defer reached, flushing')
            pendingInvalidationRef.current = false
            deferTimerRef.current = null
            queryClient.invalidateQueries({
              queryKey: pulseMessageKeys.byConversation(conversationId),
            })
          }, MAX_DEFER_MS)
        }

        // Poll every 500ms to check if composing stopped
        const pollId = setInterval(() => {
          if (
            safeStorage.getItem(PULSE_COMPOSE_DIRTY_KEY) !== '1' &&
            pendingInvalidationRef.current
          ) {
            clearInterval(pollId)
            pendingInvalidationRef.current = false
            if (deferTimerRef.current) {
              clearTimeout(deferTimerRef.current)
              deferTimerRef.current = null
            }
            queryClient.invalidateQueries({
              queryKey: pulseMessageKeys.byConversation(conversationId),
            })
          }
        }, 500)

        // Safety: stop polling after max-defer
        setTimeout(() => clearInterval(pollId), MAX_DEFER_MS + 1000)
        return
      }

      pendingInvalidationRef.current = false
      queryClient.invalidateQueries({
        queryKey: pulseMessageKeys.byConversation(conversationId),
      })
    }, DEBOUNCE_MS)
  }, [queryClient, conversationId])

  const handleNewMessage = useCallback(
    (payload: { new: Record<string, unknown> }) => {
      // Skip invalidation for own messages (already handled by optimistic update / onSuccess)
      const messageUserId = payload.new?.user_id
      if (currentProfile?.id && messageUserId === currentProfile.id) {
        debug.log('⏭️ Skipping realtime invalidation for own message')
        return
      }
      scheduleInvalidation()
    },
    [currentProfile?.id, scheduleInvalidation]
  )

  const handleUpdateMessage = useCallback(() => {
    scheduleInvalidation()
  }, [scheduleInvalidation])

  const handleNewReaction = useCallback(() => {
    scheduleInvalidation()
  }, [scheduleInvalidation])

  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`pulse-messages-${conversationId}-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pulse_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleNewMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pulse_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleUpdateMessage
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pulse_reactions',
        },
        handleNewReaction
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (deferTimerRef.current) {
        clearTimeout(deferTimerRef.current)
      }
    }
  }, [conversationId, handleNewMessage, handleUpdateMessage, handleNewReaction])
}

// Hook: Recherche dans les messages
export function usePulseMessageSearch(conversationId: string, query: string) {
  const { user } = useAuth()
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id

  return useQuery({
    queryKey: pulseMessageKeys.search(conversationId, query),
    queryFn: async () => {
      if (!query || query.length < 2) return []

      const { data, error } = await supabase
        .from('pulse_messages')
        .select(
          `
          *,
          user:profiles!pulse_messages_user_id_fkey(id, nom, prenom, email, avatar_url)
        `
        )
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .textSearch('search_vector', query, { type: 'websearch', config: 'french' })
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return removeHiddenMessages(profileId, (data || []) as unknown as PulseMessage[])
    },
    enabled: !!conversationId && query.length >= 2,
    staleTime: 30 * 1000,
  })
}
