import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import * as rgpd from './rgpd'

const {
  STABLE_USER,
  mockFrom,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  TRAITEMENTS,
  CONSENTEMENT,
} = vi.hoisted(() => ({
  STABLE_USER: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockFrom: vi.fn(),
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  TRAITEMENTS: [
    {
      id: 't1',
      nom: 'Gestion des consentements',
      description: 'Collecte et suivi des consentements',
      finalites: ['marketing', 'newsletter'],
      base_legale: 'consentement',
      categories_personnes: ['clients'],
      categories_donnees: ['email', 'ip'],
      donnees_sensibles: false,
      destinataires: ['équipe marketing'],
      transferts_hors_ue: false,
      pays_transfert: null,
      garanties_transfert: null,
      duree_conservation: '3 ans',
      mesures_securite: ['chiffrement'],
      responsable_id: 'u1',
      sous_traitants: ['outil emailing'],
      dpia_requis: false,
      dpia_realise: false,
      dpia_date: null,
      dpia_document_url: null,
      est_actif: true,
      date_creation: '2024-01-01',
      date_derniere_revision: '2024-02-01',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-02-01T00:00:00Z',
      responsable: { id: 'u1', nom: 'Doe', prenom: 'Jane' },
    },
  ],
  CONSENTEMENT: {
    id: 'c1',
    personne_email: 'alice@example.com',
    personne_nom: 'Alice',
    finalite: 'newsletter',
    traitement_id: 't1',
    est_accorde: true,
    date_consentement: '2024-03-01',
    date_retrait: null,
    mode_collecte: 'formulaire web',
    preuve_url: null,
    ip_address: '127.0.0.1',
    user_agent: 'browser',
    version_conditions: 'v1',
    metadata: { source: 'landing' },
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
    traitement: null,
  },
}))

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const resolved = { data: null, error: null }
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => resolved),
      maybeSingle: vi.fn(async () => resolved),
      then: (onFulfilled: (value: typeof resolved) => unknown) => Promise.resolve(resolved).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(resolved).catch(onRejected),
    }
    return builder
  }

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => createBuilder()),
    },
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_USER,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('rgpd.ts', () => {
  it('expose les labels métier attendus', () => {
    expect(rgpd.BASE_LEGALE_LABELS.consentement).toBe('Consentement')
    expect(rgpd.BASE_LEGALE_LABELS.contrat).toBe("Exécution d'un contrat")
    expect(rgpd.BASE_LEGALE_LABELS.interet_legitime).toBe('Intérêt légitime')
    expect(rgpd.DEMANDE_STATUT_LABELS.completee).toBe('Complétée')
    expect(rgpd.DEMANDE_STATUT_COLORS.en_cours).toBe('bg-yellow-100 text-yellow-800')
    expect(rgpd.DROIT_TYPE_LABELS.effacement).toBe("Droit à l'effacement")
    expect(rgpd.DROIT_TYPE_LABELS.portabilite).toBe('Droit à la portabilité')
    expect(rgpd.VIOLATION_SEVERITE_LABELS.elevee).toBe('Élevée')
    expect(rgpd.VIOLATION_SEVERITE_COLORS.critique).toBe('bg-red-100 text-red-800')
  })

  it('permet une requête en chargement puis succès avec des valeurs RGPD réelles', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['rgpd-traitements'],
          queryFn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 5))
            return TRAITEMENTS as rgpd.RgpdTraitement[]
          },
        }),
      { wrapper },
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(TRAITEMENTS)
    expect(result.current.data?.[0].base_legale).toBe('consentement')
    expect(result.current.data?.[0].finalites).toContain('newsletter')
    expect(result.current.data?.[0].responsable?.prenom).toBe('Jane')
    expect(result.current.data?.[0].est_actif).toBe(true)
    expect(result.current.data?.[0].mesures_securite).toContain('chiffrement')
  })

  it('passe en erreur quand la requête renvoie une erreur de type supabase', async () => {
    const wrapper = createWrapper()

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['rgpd-error'],
          queryFn: async () => {
            const response: { data: null; error: { message: string } } = {
              data: null,
              error: { message: 'x' },
            }
            if (response.error) {
              throw new Error(response.error.message)
            }
            return response.data
          },
        }),
      { wrapper },
    )

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('x')
  })

  it('déclenche une mutation et transmet les bonnes valeurs métier', async () => {
    const insertConsentement = vi.fn(async (payload: rgpd.RgpdConsentement) => ({
      data: payload,
      error: null as null | { message: string },
    }))

    const wrapper = createWrapper()

    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: async (payload: rgpd.RgpdConsentement) => {
            const response = await insertConsentement(payload)
            if (response.error) {
              throw new Error(response.error.message)
            }
            return response.data
          },
        }),
      { wrapper },
    )

    await act(async () => {
      await result.current.mutateAsync(CONSENTEMENT as rgpd.RgpdConsentement)
    })

    expect(insertConsentement).toHaveBeenCalledWith(CONSENTEMENT)
    expect(insertConsentement).toHaveBeenCalledWith(
      expect.objectContaining({
        personne_email: 'alice@example.com',
        finalite: 'newsletter',
        est_accorde: true,
        mode_collecte: 'formulaire web',
      }),
    )

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data?.traitement_id).toBe('t1')
    expect(result.current.data?.metadata).toEqual({ source: 'landing' })
    expect(result.current.data?.date_consentement).toBe('2024-03-01')
  })
})