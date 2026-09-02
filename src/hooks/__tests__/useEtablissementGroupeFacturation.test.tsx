import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return { mockFrom }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

// debug est un utilitaire maison qui ne doit pas bloquer les tests
vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

import {
  useEtablissementGroupeId,
  useGroupeFacturationData,
  useEtablissementGroupeFacturation,
} from '@/hooks/crm/useEtablissementGroupeFacturation'
import { supabase } from '@/integrations/supabase/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// Proxy chaînable universel
type Chainable = { [k: string]: (...args: unknown[]) => Chainable | Promise<unknown> }
function makeChain(resolvedValue: unknown): Chainable {
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'then')
        return (cb: (v: unknown) => unknown) => Promise.resolve(resolvedValue).then(cb)
      if (prop === 'maybeSingle') return vi.fn(() => Promise.resolve(resolvedValue))
      if (prop === 'single') return vi.fn(() => Promise.resolve(resolvedValue))
      return vi.fn((..._args: unknown[]) => new Proxy({}, handler))
    },
  }
  return new Proxy({}, handler) as Chainable
}

const mockGroupeData = {
  id: 'groupe-1',
  nom: 'Groupe Nord',
  type_offre: 'premium',
  periodicite_paiement: 'trimestriel',
  pallier_vise: 'pallier_2',
  modele_statique_succes: null,
  tarifs_palliers: { pallier_1: 5000, pallier_2: 8000 },
  paiement_initial: 10000,
  email_facturation: 'factu@groupe-nord.fr',
  adresse_facturation: '10 rue de la Paix, Paris',
  siret_facturation: '12345678900012',
  conditions_paiement_defaut: '30 jours',
  mode_paiement_prefere: 'virement',
  vecteur_achat: 'commercial',
}

describe('useEtablissementGroupeId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne null quand etablissementId est undefined', async () => {
    const { result } = renderHook(() => useEtablissementGroupeId(undefined), {
      wrapper: createWrapper(),
    })

    // Query disabled => data = undefined, isLoading = false
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeUndefined()
  })

  it('retourne le groupe_id quand trouve', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { groupe_id: 'groupe-1' }, error: null }))

    const { result } = renderHook(() => useEtablissementGroupeId('etab-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBe('groupe-1')
  })

  it('retourne null quand aucun groupe trouve (data=null)', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }))

    const { result } = renderHook(() => useEtablissementGroupeId('etab-orphan'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
  })

  it("retourne null en cas d'erreur Supabase (sans crash)", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'Err' } }))

    const { result } = renderHook(() => useEtablissementGroupeId('etab-err'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Le hook attrape l'erreur et retourne null
    expect(result.current.data).toBeNull()
  })
})

describe('useGroupeFacturationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retourne null quand groupeId est undefined', async () => {
    const { result } = renderHook(() => useGroupeFacturationData(undefined), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeUndefined()
  })

  it("retourne les donnees du groupe avec le compte d'etablissements", async () => {
    // Appels : groupes_etablissements (groupe), etablissements_groupes (membres), etablissements (count)
    mockFrom
      .mockReturnValueOnce(makeChain({ data: mockGroupeData, error: null })) // groupe data via maybeSingle
      .mockReturnValueOnce(
        makeChain({
          data: [{ etablissement_id: 'etab-1' }, { etablissement_id: 'etab-2' }],
          error: null,
        })
      ) // membres
      .mockReturnValueOnce(makeChain({ data: [], error: null, count: 2 })) // count etablissements groupe

    const { result } = renderHook(() => useGroupeFacturationData('groupe-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).not.toBeNull()
    expect(result.current.data?.groupe_nom).toBe('Groupe Nord')
    expect(result.current.data?.type_offre).toBe('premium')
    expect(result.current.data?.email_facturation).toBe('factu@groupe-nord.fr')
    expect(result.current.data?.tarifs_palliers).toEqual({ pallier_1: 5000, pallier_2: 8000 })
  })

  it("retourne null quand le groupe n'existe pas (data=null)", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }))

    const { result } = renderHook(() => useGroupeFacturationData('groupe-inexistant'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeNull()
  })
})

describe('useEtablissementGroupeFacturation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ne charge pas quand enabled=false', async () => {
    const { result } = renderHook(() => useEtablissementGroupeFacturation('etab-1', false), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBeUndefined()
    expect(result.current.groupeId).toBeUndefined()
  })

  it('charge les donnees en cascade quand enabled=true', async () => {
    // Etape 1 : etablissements_groupes (groupe_id)
    // Etape 2 : groupes_etablissements (groupe data)
    // Etape 3 : etablissements_groupes (membres)
    // Etape 4 : etablissements (count)
    mockFrom
      .mockReturnValueOnce(makeChain({ data: { groupe_id: 'groupe-1' }, error: null }))
      .mockReturnValueOnce(makeChain({ data: mockGroupeData, error: null }))
      .mockReturnValueOnce(makeChain({ data: [{ etablissement_id: 'etab-1' }], error: null }))
      .mockReturnValueOnce(makeChain({ data: [], error: null, count: 1 }))

    const { result } = renderHook(() => useEtablissementGroupeFacturation('etab-1', true), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 3000 })

    expect(result.current.groupeId).toBe('groupe-1')
    expect(result.current.data?.groupe_nom).toBe('Groupe Nord')
    expect(typeof result.current.refetch).toBe('function')
  })
})
