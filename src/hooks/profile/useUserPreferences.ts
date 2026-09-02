import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { useToast } from '@/hooks/shared/use-toast'
import { debug } from '@/lib/debug'

export function useUserPreferences() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)

  // Charger les préférences utilisateur
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error

        setPreferences((data?.preferences as Record<string, unknown>) || {})
      } catch (error) {
        debug.error('Erreur lors du chargement des préférences:', error)
        toast({
          title: 'Erreur',
          description: 'Impossible de charger vos préférences',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadPreferences()
  }, [user, toast])

  // Mettre à jour une préférence
  const updatePreference = async (key: string, value: unknown) => {
    if (!user) return

    // Optimistic local update — preferences UX must never block on backend
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }))

    try {
      const { error } = await supabase.rpc('update_user_preference', {
        preference_key: key,
        preference_value: value as never,
      })

      if (error) throw error
    } catch (error) {
      // Silent fail: preferences are non-critical, avoid spurious "Impossible de sauvegarder" toasts
      // (e.g. on view switches where the RPC sometimes errors transiently)
      debug.error('Erreur lors de la mise à jour de la préférence:', error)
    }
  }

  // Obtenir une préférence avec valeur par défaut
  const getPreference = (key: string, defaultValue: unknown = null) => {
    return preferences[key] !== undefined ? preferences[key] : defaultValue
  }

  // Gestion des favoris groupes
  const toggleFavoriteGroupe = async (groupeId: string) => {
    const currentFavorites = (getPreference('favorite_groupes', []) as string[]) || []
    const newFavorites = currentFavorites.includes(groupeId)
      ? currentFavorites.filter((id) => id !== groupeId)
      : [...currentFavorites, groupeId]

    await updatePreference('favorite_groupes', newFavorites)
    return !currentFavorites.includes(groupeId)
  }

  const isFavoriteGroupe = (groupeId: string): boolean => {
    const favorites = (getPreference('favorite_groupes', []) as string[]) || []
    return favorites.includes(groupeId)
  }

  // Gestion des favoris partenaires
  const toggleFavoritePartenaire = async (partenaireId: string) => {
    const currentFavorites = (getPreference('favorite_partenaires', []) as string[]) || []
    const newFavorites = currentFavorites.includes(partenaireId)
      ? currentFavorites.filter((id) => id !== partenaireId)
      : [...currentFavorites, partenaireId]

    await updatePreference('favorite_partenaires', newFavorites)
    return !currentFavorites.includes(partenaireId)
  }

  const isFavoritePartenaire = (partenaireId: string): boolean => {
    const favorites = (getPreference('favorite_partenaires', []) as string[]) || []
    return favorites.includes(partenaireId)
  }

  // Gestion des vues sauvegardées
  const saveView = async (name: string, viewData: unknown) => {
    const currentViews = (getPreference('saved_views_groupes', {}) as Record<string, unknown>) || {}
    const newViews = {
      ...currentViews,
      [name]: viewData,
    }
    await updatePreference('saved_views_groupes', newViews)
  }

  const deleteView = async (name: string) => {
    const currentViews = (getPreference('saved_views_groupes', {}) as Record<string, unknown>) || {}
    const newViews = { ...currentViews }
    delete newViews[name]
    await updatePreference('saved_views_groupes', newViews)
  }

  const getSavedViews = (): Record<string, unknown> => {
    return (getPreference('saved_views_groupes', {}) as Record<string, unknown>) || {}
  }

  return {
    preferences,
    isLoading,
    updatePreference,
    getPreference,
    toggleFavoriteGroupe,
    isFavoriteGroupe,
    toggleFavoritePartenaire,
    isFavoritePartenaire,
    saveView,
    deleteView,
    getSavedViews,
  }
}
