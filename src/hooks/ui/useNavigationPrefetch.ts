/**
 * Hook pour précharger les données au survol des liens de navigation.
 */

import { useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

// Throttle pour éviter le spam de prefetch
const THROTTLE_MS = 2000

export function useNavigationPrefetch() {
  const queryClient = useQueryClient()
  const lastPrefetchRef = useRef<Record<string, number>>({})

  const prefetch = useCallback(
    async (path: string) => {
      const now = Date.now()
      const lastPrefetch = lastPrefetchRef.current[path] || 0

      if (now - lastPrefetch < THROTTLE_MS) return
      lastPrefetchRef.current[path] = now

      try {
        switch (path) {
          case '/etablissements':
            await queryClient.prefetchQuery({
              queryKey: ['etablissements'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('etablissements')
                  .select('id, nom, ville, statut, type, progression')
                  .limit(50)
                return data
              },
              staleTime: 60 * 1000,
            })
            break

          case '/emails':
            await queryClient.prefetchQuery({
              queryKey: ['email-accounts'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('user_email_accounts')
                  .select('id, email_address, display_name, sync_enabled')
                  .eq('sync_enabled', true)
                return data
              },
              staleTime: 2 * 60 * 1000,
            })
            break

          case '/people':
            await queryClient.prefetchQuery({
              queryKey: ['profiles-team'],
              queryFn: async () => {
                const { data } = await supabase.rpc('get_profiles_public')
                return data
              },
              staleTime: 5 * 60 * 1000,
            })
            break

          case '/tresorerie':
            await queryClient.prefetchQuery({
              queryKey: ['tresorerie-kpis-summary'],
              queryFn: async () => {
                const { data: revenus } = await supabase
                  .from('tresorerie_revenus')
                  .select('montant_prevu, statut')
                  .limit(100)
                const { data: depenses } = await supabase
                  .from('tresorerie_depenses')
                  .select('montant, statut')
                  .limit(100)
                return { revenus, depenses }
              },
              staleTime: 2 * 60 * 1000,
            })
            break

          case '/partenaires':
            await queryClient.prefetchQuery({
              queryKey: ['partenaires', 'prefetch-lite'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('partenaires')
                  .select('id, nom, type_partenaire, statut_relation')
                  .limit(50)
                return data
              },
              staleTime: 60 * 1000,
            })
            break

          case '/groupes':
            await queryClient.prefetchQuery({
              queryKey: ['groupes'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('groupes_etablissements')
                  .select('id, nom, description')
                  .limit(50)
                return data
              },
              staleTime: 60 * 1000,
            })
            break

          case '/rd':
            await queryClient.prefetchQuery({
              queryKey: ['rd-projets'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('rd_projets')
                  .select('id, nom, statut')
                  .limit(20)
                return data
              },
              staleTime: 60 * 1000,
            })
            break

          case '/support':
            await queryClient.prefetchQuery({
              queryKey: ['support-tickets-preview'],
              queryFn: async () => {
                const { data } = await supabase
                  .from('support_tickets')
                  .select('id, titre, statut, priorite')
                  .not('statut', 'eq', 'closed')
                  .limit(20)
                return data
              },
              staleTime: 60 * 1000,
            })
            break

          default:
            break
        }
      } catch (e) {
        // Prefetch errors are non-critical, silently ignore
      }
    },
    [queryClient]
  )

  return prefetch
}
