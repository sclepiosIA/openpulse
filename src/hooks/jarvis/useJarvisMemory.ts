/**
 * useJarvisMemory - Gestion de la mémoire persistante de Jarvis
 *
 * Permet à Jarvis de se souvenir des préférences, faits et contexte
 * de l'utilisateur entre les sessions.
 *
 * PHASE 3 FIX: Utilise fromExtended() au lieu de supabase
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fromExtended } from '@/lib/supabaseTyped'
import { useAuth } from '@/hooks/shared/useAuth'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'
import type { JarvisUserMemoryRow } from '@/types/supabase-extensions'

export type MemoryCategory = 'preference' | 'fact' | 'instruction' | 'context'

export interface JarvisMemory {
  id: string
  user_id: string
  category: MemoryCategory
  key: string
  value: string
  metadata: Record<string, unknown>
  importance: number
  created_at: string
  updated_at: string
  expires_at: string | null
}

interface AddMemoryParams {
  category: MemoryCategory
  key: string
  value: string
  importance?: number
  metadata?: Record<string, unknown>
  expires_at?: string
}

const MEMORY_QUERY_KEY = 'jarvis-memory'

export function useJarvisMemory() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch all memories for the current user
  const { data: memories, isLoading } = useQuery({
    queryKey: [MEMORY_QUERY_KEY, user?.id],
    queryFn: async () => {
      if (!user?.id) return []

      const { data, error } = await fromExtended('jarvis_user_memory')
        .select(
          'id, user_id, category, key, value, metadata, importance, created_at, updated_at, expires_at'
        )
        .eq('user_id', user.id)
        .order('importance', { ascending: false })
        .order('updated_at', { ascending: false })

      if (error) {
        debug.error('Error fetching Jarvis memories:', error)
        return []
      }

      return (data || []) as JarvisUserMemoryRow[]
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Add or update a memory
  const addMemoryMutation = useMutation({
    mutationFn: async (params: AddMemoryParams) => {
      if (!user?.id) throw new Error('Not authenticated')

      const { data, error } = await fromExtended('jarvis_user_memory')
        .upsert(
          {
            user_id: user.id,
            category: params.category,
            key: params.key,
            value: params.value,
            importance: params.importance || 3,
            metadata: params.metadata || {},
            expires_at: params.expires_at || null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,category,key',
          }
        )
        .select()
        // safe: guaranteed-row
        .single() // safe: guaranteed-row

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEMORY_QUERY_KEY, user?.id] })
    },
    onError: (error) => {
      debug.error('Error adding Jarvis memory:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de mémoriser cette information',
        variant: 'destructive',
      })
    },
  })

  // Delete a memory
  const deleteMemoryMutation = useMutation({
    mutationFn: async (key: string) => {
      if (!user?.id) throw new Error('Not authenticated')

      const { error } = await fromExtended('jarvis_user_memory')
        .delete()
        .eq('user_id', user.id)
        .eq('key', key)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEMORY_QUERY_KEY, user?.id] })
    },
    onError: (error) => {
      debug.error('Error deleting Jarvis memory:', error)
      toast({
        title: 'Erreur',
        description: "Impossible d'oublier cette information",
        variant: 'destructive',
      })
    },
  })

  // Clear all memories for a category
  const clearCategoryMutation = useMutation({
    mutationFn: async (category: MemoryCategory) => {
      if (!user?.id) throw new Error('Not authenticated')

      const { error } = await fromExtended('jarvis_user_memory')
        .delete()
        .eq('user_id', user.id)
        .eq('category', category)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [MEMORY_QUERY_KEY, user?.id] })
    },
  })

  // Get formatted context for GPT injection
  const getMemoryContext = useCallback(() => {
    if (!memories?.length) return ''

    // Group by category for better organization
    const grouped = memories.reduce(
      (acc, m) => {
        if (!acc[m.category]) acc[m.category] = []
        acc[m.category].push(m)
        return acc
      },
      {} as Record<string, JarvisUserMemoryRow[]>
    )

    const categoryLabels: Record<MemoryCategory, string> = {
      preference: 'PRÉFÉRENCES',
      fact: 'FAITS CONNUS',
      instruction: 'INSTRUCTIONS PERMANENTES',
      context: 'CONTEXTE ACTUEL',
    }

    let context = "\n\nMÉMOIRE PERSISTANTE (informations sur l'utilisateur):"

    for (const [category, items] of Object.entries(grouped)) {
      const label = categoryLabels[category as MemoryCategory] || category
      context += `\n\n${label}:`
      for (const item of items.slice(0, 10)) {
        // Limit per category
        context += `\n- ${item.key}: ${item.value}`
      }
    }

    return context
  }, [memories])

  // Get memories by category
  const getMemoriesByCategory = useCallback(
    (category: MemoryCategory) => {
      return memories?.filter((m) => m.category === category) || []
    },
    [memories]
  )

  // Check if a specific memory exists
  const hasMemory = useCallback(
    (key: string) => {
      return memories?.some((m) => m.key === key) || false
    },
    [memories]
  )

  // Get a specific memory value
  const getMemoryValue = useCallback(
    (key: string) => {
      return memories?.find((m) => m.key === key)?.value
    },
    [memories]
  )

  return {
    memories,
    isLoading,
    addMemory: addMemoryMutation.mutateAsync,
    deleteMemory: deleteMemoryMutation.mutateAsync,
    clearCategory: clearCategoryMutation.mutateAsync,
    getMemoryContext,
    getMemoriesByCategory,
    hasMemory,
    getMemoryValue,
    isAdding: addMemoryMutation.isPending,
    isDeleting: deleteMemoryMutation.isPending,
  }
}
