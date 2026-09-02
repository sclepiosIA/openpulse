/**
 * Ce hook existe à cause d'un faux succès, et c'est ce faux succès qui est
 * vérifié ici.
 *
 * `app_config` est créée VIDE par l'installation. Le hook historique fait un
 * `update ... where key = …` : sur une ligne absente, il affecte zéro ligne et
 * rend `error: null`. L'assistant affichait donc « Configuration enregistrée »
 * sans rien avoir écrit. Même faux succès si la sécurité au niveau ligne refuse
 * l'écriture à un compte non administrateur.
 *
 * D'où la relecture : le hook redemande les clés qu'il vient de poser et échoue
 * si l'une manque.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'

const upsert = vi.fn()
const sel = vi.fn()
const toast = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: (...a: unknown[]) => upsert(...a),
      select: () => ({ in: (...a: unknown[]) => sel(...a) }),
    }),
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: Error) => e.message,
}))

import { useEnregistrerConfiguration } from '../useEnregistrerConfiguration'

function enveloppe({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const entrees = [
  { cle: 'marque', valeur: { nomProduit: 'Ma Société' } },
  { cle: 'instance_configuree', valeur: { fait: true } },
]

describe('useEnregistrerConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsert.mockResolvedValue({ error: null })
  })

  it('écrit les clés puis confirme leur présence', async () => {
    sel.mockResolvedValue({
      data: [{ key: 'marque' }, { key: 'instance_configuree' }],
      error: null,
    })

    const { result } = renderHook(() => useEnregistrerConfiguration(), { wrapper: enveloppe })
    await result.current.mutateAsync(entrees)

    expect(upsert).toHaveBeenCalledTimes(1)
    const [lignes, options] = upsert.mock.calls[0] as [
      Array<Record<string, unknown>>,
      { onConflict: string },
    ]
    expect(options.onConflict).toBe('key')
    expect(lignes.map((l) => l.key)).toEqual(['marque', 'instance_configuree'])
  })

  it('échoue quand une clé manque à la relecture, plutôt que de se déclarer réussi', async () => {
    // Le cas d'un compte sans le rôle d'administrateur : la policy rejette
    // l'écriture sans lever d'erreur côté client.
    sel.mockResolvedValue({ data: [{ key: 'marque' }], error: null })

    const { result } = renderHook(() => useEnregistrerConfiguration(), { wrapper: enveloppe })
    await expect(result.current.mutateAsync(entrees)).rejects.toThrow(/instance_configuree/)

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    )
  })

  it("remonte l'erreur d'écriture sans tenter de relire", async () => {
    upsert.mockResolvedValue({ error: new Error('permission refusée') })

    const { result } = renderHook(() => useEnregistrerConfiguration(), { wrapper: enveloppe })
    await expect(result.current.mutateAsync(entrees)).rejects.toThrow('permission refusée')
    expect(sel).not.toHaveBeenCalled()
  })

  it("n'écrit rien quand la liste est vide", async () => {
    const { result } = renderHook(() => useEnregistrerConfiguration(), { wrapper: enveloppe })
    await result.current.mutateAsync([])
    expect(upsert).not.toHaveBeenCalled()
  })
})
