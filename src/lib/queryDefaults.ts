/**
 * Defaults React Query uniformisés par domaine.
 *
 * Objectif stabilité : éviter les refetch en cascade sur focus/reconnect,
 * et calibrer staleTime en fonction du taux de fraîcheur attendu.
 * Consommer via `useQuery({ ...queryDefaults.email, queryKey, queryFn })`.
 */
export const queryDefaults = {
  // Emails: listes lourdes, invalidations gérées par Realtime + push.
  email: {
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  },
  // CRM / établissements: données semi-froides, refetch focus toléré.
  crm: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
  },
  // RH: données froides, invalidées explicitement lors des mutations.
  rh: {
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  },
  // Trésorerie: financier, invalidé après opérations.
  tresorerie: {
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  },
  // Tâches: haute fréquence, courte fraîcheur.
  tasks: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  },
} as const

export type QueryDomain = keyof typeof queryDefaults
