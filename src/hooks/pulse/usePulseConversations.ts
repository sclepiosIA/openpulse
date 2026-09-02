import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { toast } from 'sonner'
import { debug } from '@/lib/debug'
import { queryPresets } from '@/lib/queryPresets'
import type {
  PulseConversation,
  CreateConversationInput,
  UpdateConversationInput,
} from '@/types/pulse'

// Query keys
export const pulseConversationKeys = {
  all: ['pulse-conversations'] as const,
  list: () => [...pulseConversationKeys.all, 'list'] as const,
  detail: (id: string) => [...pulseConversationKeys.all, 'detail', id] as const,
  byEtablissement: (etabId: string) =>
    [...pulseConversationKeys.all, 'etablissement', etabId] as const,
}

// Fetch all conversations for current user with last message
async function fetchConversations(): Promise<PulseConversation[]> {
  const { data, error } = await supabase
    .from('pulse_conversations')
    .select(
      `
      *,
      etablissement:etablissements(id, nom, logo_url),
      creator:profiles!pulse_conversations_created_by_fkey(id, nom, prenom, email, avatar_url),
      members:pulse_conversation_members(
        id,
        user_id,
        role,
        notification_level,
        last_read_at,
        user:profiles!pulse_conversation_members_user_id_fkey(id, nom, prenom, email, avatar_url)
      ),
      last_message:pulse_messages!pulse_messages_conversation_id_fkey(
        id,
        content,
        user_id,
        created_at,
        user:profiles!pulse_messages_user_id_fkey(nom, prenom, avatar_url)
      )
    `
    )
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })

  if (error) throw error

  // Sort last_message to get most recent and take only one
  const processed = (data || []).map((conv: Record<string, unknown>) => {
    const lastMessages = conv.last_message as { created_at: string }[] | null
    if (Array.isArray(lastMessages) && lastMessages.length > 0) {
      // Sort by created_at descending and take first
      const sorted = [...lastMessages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      return { ...conv, last_message: sorted[0] }
    }
    return { ...conv, last_message: null }
  })

  return processed as unknown as PulseConversation[]
}

// Fetch single conversation with details
async function fetchConversation(id: string): Promise<PulseConversation | null> {
  const { data, error } = await supabase
    .from('pulse_conversations')
    .select(
      `
      *,
      etablissement:etablissements(id, nom, logo_url),
      creator:profiles!pulse_conversations_created_by_fkey(id, nom, prenom, email, avatar_url),
      members:pulse_conversation_members(
        id,
        user_id,
        role,
        notification_level,
        last_read_at,
        joined_at,
        user:profiles!pulse_conversation_members_user_id_fkey(id, nom, prenom, email, avatar_url)
      )
    `
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return data as unknown as PulseConversation
}

// Hook: Liste des conversations
export function usePulseConversations() {
  return useQuery({
    queryKey: pulseConversationKeys.list(),
    queryFn: fetchConversations,
    ...queryPresets.standard, // 2 min staleTime, 30 min gcTime
    refetchInterval: 120 * 1000, // 2 min — realtime handles live updates
    refetchOnWindowFocus: false,
  })
}

// Hook: Détail d'une conversation
export function usePulseConversation(id: string | undefined) {
  return useQuery({
    queryKey: pulseConversationKeys.detail(id || ''),
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
    ...queryPresets.standard, // 2 min staleTime, 30 min gcTime
    // Garder les données précédentes visibles pendant le chargement (évite flash blanc)
    placeholderData: (previousData) => previousData,
  })
}

// Hook: Créer une conversation
export function useCreatePulseConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateConversationInput) => {
      const { data: conversation, error } = await (supabase as any).rpc(
        'create_pulse_conversation',
        {
          p_name: input.name,
          p_description: input.description || null,
          p_visibility: input.visibility || 'private',
          p_etablissement_id: input.etablissement_id || null,
          p_metadata: input.metadata || {},
          p_member_ids: input.member_ids || [],
        }
      )

      if (error) throw error
      if (!conversation) throw new Error('Conversation non créée')

      return conversation as PulseConversation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pulseConversationKeys.all })
      toast.success('Conversation créée')
    },
    onError: (error: Error) => {
      debug.error('Error creating conversation:', error)
      const message = error.message?.includes('Active profile not found')
        ? 'Profil actif introuvable pour créer la conversation'
        : 'Erreur lors de la création de la conversation'
      toast.error(message)
    },
  })
}

// Hook: Mettre à jour une conversation
export function useUpdatePulseConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateConversationInput & { id: string }) => {
      const { data, error } = await supabase
        .from('pulse_conversations')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pulseConversationKeys.all })
      queryClient.invalidateQueries({ queryKey: pulseConversationKeys.detail(data.id) })
      toast.success('Conversation mise à jour')
    },
    onError: (error: Error) => {
      debug.error('Error updating conversation:', error)
      toast.error('Erreur lors de la mise à jour')
    },
  })
}

// Hook: Archiver une conversation
export function useArchivePulseConversation() {
  const queryClient = useQueryClient()
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id

  return useMutation({
    mutationFn: async (id: string) => {
      if (!profileId) throw new Error('Profil introuvable')

      const { error } = await supabase
        .from('pulse_conversations')
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: profileId,
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pulseConversationKeys.all })
      toast.success('Conversation archivée')
    },
    onError: (error: Error) => {
      debug.error('Error archiving conversation:', error)
      toast.error("Erreur lors de l'archivage")
    },
  })
}

// Hook: Ajouter un membre
export function useAddPulseConversationMember() {
  const queryClient = useQueryClient()
  const { data: currentProfile } = useCurrentProfile()
  const profileId = currentProfile?.id

  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
      role = 'member',
    }: {
      conversationId: string
      userId: string
      role?: 'admin' | 'member' | 'guest'
    }) => {
      if (!profileId) throw new Error('Profil introuvable')

      const { error } = await supabase.from('pulse_conversation_members').insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        invited_by: profileId,
      })

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pulseConversationKeys.detail(variables.conversationId),
      })
      toast.success('Membre ajouté')
    },
    onError: (error: Error) => {
      debug.error('Error adding member:', error)
      toast.error("Erreur lors de l'ajout du membre")
    },
  })
}

// Hook: Retirer un membre
export function useRemovePulseConversationMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ conversationId, userId }: { conversationId: string; userId: string }) => {
      const { error } = await supabase
        .from('pulse_conversation_members')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pulseConversationKeys.detail(variables.conversationId),
      })
      toast.success('Membre retiré')
    },
    onError: (error: Error) => {
      debug.error('Error removing member:', error)
      toast.error('Erreur lors du retrait du membre')
    },
  })
}

// Hook: Mettre à jour le rôle d'un membre
export function useUpdatePulseConversationMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      conversationId,
      userId,
      role,
    }: {
      conversationId: string
      userId: string
      role: 'admin' | 'member' | 'guest'
    }) => {
      const { error } = await supabase
        .from('pulse_conversation_members')
        .update({ role })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: pulseConversationKeys.detail(variables.conversationId),
      })
      toast.success('Rôle mis à jour')
    },
    onError: (error: Error) => {
      debug.error('Error updating member role:', error)
      toast.error('Erreur lors de la mise à jour du rôle')
    },
  })
}
