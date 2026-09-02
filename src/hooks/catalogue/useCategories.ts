import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseBrowser'
import { useToast } from '@/hooks/shared/use-toast'
import { queryPresets } from '@/lib/queryPresets'

export interface Category {
  id: string
  nom: string
  description?: string
  couleur: string
  ordre: number
  created_at: string
}

export function useCategories() {
  const { toast } = useToast()

  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories_taches')
        .select('id, nom, description, couleur, ordre, created_at')
        .order('ordre', { ascending: true })
        .limit(100)

      if (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les catégories",
          variant: "destructive"
        })
        throw error
      }

      return data as Category[]
    },
    ...queryPresets.reference, // 30 min staleTime - categories rarely change
  })
}