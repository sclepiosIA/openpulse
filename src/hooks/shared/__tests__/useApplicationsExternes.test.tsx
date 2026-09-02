/* @vitest-environment jsdom */

import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useApplicationsExternes } from '@/hooks/shared/useApplicationsExternes'

/**
 * Ce que ce fichier protège : `requete.data ?? []` fabriquait un tableau NEUF à
 * chaque rendu. Un composant qui recopie cette valeur dans un état, avec un
 * effet qui en dépend, boucle alors sans fin — au chargement et en cas
 * d'erreur, c'est-à-dire précisément quand l'écran doit rester utilisable.
 *
 * Le défaut ne se voit pas à la lecture : les deux rendus donnent le même
 * CONTENU. Seule l'identité de la référence le révèle.
 */

const mockMaybeSingle = vi.fn()
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
  },
}))
vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

function enveloppe() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useApplicationsExternes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('rend la MÊME référence tant que la lecture n’a pas abouti', () => {
    mockMaybeSingle.mockReturnValue(new Promise(() => {}))
    const { result, rerender } = renderHook(() => useApplicationsExternes(), {
      wrapper: enveloppe(),
    })
    const premier = result.current.applications
    rerender()
    const second = result.current.applications

    expect(premier).toEqual([])
    // C'est l'identité qui compte, pas l'égalité : deux tableaux vides
    // distincts relancent l'effet, et l'écran boucle.
    expect(second).toBe(premier)
  })

  it('rend la même référence après un échec de lecture', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('refus de la base'))
    const { result, rerender } = renderHook(() => useApplicationsExternes(), {
      wrapper: enveloppe(),
    })
    const premier = result.current.applications
    rerender()
    expect(result.current.applications).toBe(premier)
  })
})
