/* @vitest-environment jsdom */

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { useEtablissementUser, useEtablissementUserById } from './useEtablissementUser'

const {
  AUTH_STATE,
  USER_BY_ID_FOUND,
  USER_BY_AUTH_FOUND,
  EMAIL_FOUND,
  UPDATED_LINKED_USER,
  mockFrom,
  debugLog,
  debugError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  USER_BY_ID_FOUND: {
    id: 'eu-by-id-1',
    user_id: 'u1',
    etablissement_id: 'et-1',
    nom: 'Durand',
    prenom: 'Alice',
    email: 'user@example.com',
    telephone: '0102030405',
    fonction: 'Infirmiere',
    service: 'Urgences',
    specialite: 'Traumato',
    statut_formation: 'forme' as const,
    date_premiere_formation: '2024-01-10',
    date_derniere_formation: '2024-06-10',
    nombre_sessions_suivies: 3,
    derniere_utilisation: '2024-06-11',
    nombre_connexions: 12,
    actif: true,
    compte_verrouille: false,
    created_at: '2024-01-01',
    updated_at: '2024-06-11',
    etablissements: { nom: 'Clinique du Centre', ville: 'Lyon' },
  },
  USER_BY_AUTH_FOUND: {
    id: 'eu-auth-1',
    user_id: 'u1',
    etablissement_id: 'et-1',
    nom: 'Martin',
    prenom: 'Jeanne',
    email: 'user@example.com',
    telephone: '0600000000',
    fonction: 'Cadre',
    service: 'Bloc',
    specialite: 'Anesthesie',
    statut_formation: 'en_cours' as const,
    date_premiere_formation: '2024-02-01',
    date_derniere_formation: '2024-05-01',
    nombre_sessions_suivies: 2,
    derniere_utilisation: '2024-05-20',
    nombre_connexions: 7,
    actif: true,
    compte_verrouille: false,
    created_at: '2024-02-01',
    updated_at: '2024-05-20',
  },
  EMAIL_FOUND: {
    id: 'eu-email-1',
    user_id: null,
    etablissement_id: 'et-2',
    nom: 'Bernard',
    prenom: 'Luc',
    email: 'user@example.com',
    telephone: '0700000000',
    fonction: 'Medecin',
    service: 'Cardio',
    specialite: 'Cardiologie',
    statut_formation: 'non_forme' as const,
    date_premiere_formation: undefined,
    date_derniere_formation: undefined,
    nombre_sessions_suivies: 0,
    derniere_utilisation: undefined,
    nombre_connexions: 0,
    actif: true,
    compte_verrouille: true,
    created_at: '2024-03-01',
    updated_at: '2024-03-01',
  },
  UPDATED_LINKED_USER: {
    id: 'eu-email-1',
    user_id: 'u1',
    etablissement_id: 'et-2',
    nom: 'Bernard',
    prenom: 'Luc',
    email: 'user@example.com',
    telephone: '0700000000',
    fonction: 'Medecin',
    service: 'Cardio',
    specialite: 'Cardiologie',
    statut_formation: 'non_forme' as const,
    date_premiere_formation: undefined,
    date_derniere_formation: undefined,
    nombre_sessions_suivies: 0,
    derniere_utilisation: undefined,
    nombre_connexions: 0,
    actif: true,
    compte_verrouille: false,
    created_at: '2024-03-01',
    updated_at: '2024-06-01',
  },
  mockFrom: vi.fn(),
  debugLog: vi.fn(),
  debugError: vi.fn(),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: debugLog,
    error: debugError,
  },
}))

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

type ResponseShape = {
  data: unknown
  error: null | { message: string; code?: string }
}

function createBuilder(responses: ResponseShape[]) {
  let responseIndex = 0

  const nextResponse = () => {
    const response = responses[Math.min(responseIndex, responses.length - 1)]
    responseIndex += 1
    return Promise.resolve(response)
  }

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
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() => nextResponse()),
    single: vi.fn(() => nextResponse()),
    then: (
      onFulfilled?: (value: ResponseShape) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => nextResponse().then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => nextResponse().catch(onRejected),
  }

  return builder
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper(props: { children?: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children)
  }
}

describe('useEtablissementUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    AUTH_STATE.user = { id: 'u1', email: 'user@example.com' }
  })

  it('charge puis retourne le profil trouvé par user_id', async () => {
    const builder = createBuilder([{ data: USER_BY_AUTH_FOUND, error: null }])
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useEtablissementUser(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.etablissementUser).toBeUndefined()
    expect(result.current.isEtablissementUser).toBe(false)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissement_users')
    expect(builder.select).toHaveBeenCalledWith(
      'id, user_id, etablissement_id, email, nom, prenom, fonction, service, specialite, telephone, actif, statut_formation, compte_verrouille, nombre_connexions, nombre_sessions_suivies, derniere_utilisation, date_premiere_formation, date_derniere_formation, created_by, created_at, updated_at'
    )
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(builder.eq).toHaveBeenCalledWith('actif', true)
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1)

    expect(result.current.etablissementUser).toEqual(USER_BY_AUTH_FOUND)
    expect(result.current.etablissementUser?.nom).toBe('Martin')
    expect(result.current.etablissementUser?.prenom).toBe('Jeanne')
    expect(result.current.etablissementUser?.fonction).toBe('Cadre')
    expect(result.current.etablissementUser?.statut_formation).toBe('en_cours')
    expect(result.current.isEtablissementUser).toBe(true)
    expect(debugLog).not.toHaveBeenCalled()
    expect(debugError).not.toHaveBeenCalled()
  })

  it('fait la liaison automatique quand trouvé par email avec user_id null', async () => {
    const builder = createBuilder([
      { data: null, error: null },
      { data: EMAIL_FOUND, error: null },
      { data: UPDATED_LINKED_USER, error: null },
    ])
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useEtablissementUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissement_users')
    expect(builder.eq).toHaveBeenCalledWith('email', 'user@example.com')
    expect(builder.is).toHaveBeenCalledWith('user_id', null)
    expect(builder.update).toHaveBeenCalledWith({
      user_id: 'u1',
      compte_verrouille: false,
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'eu-email-1')
    expect(builder.single).toHaveBeenCalledTimes(1)

    expect(result.current.etablissementUser).toEqual(UPDATED_LINKED_USER)
    expect(result.current.etablissementUser?.id).toBe('eu-email-1')
    expect(result.current.etablissementUser?.user_id).toBe('u1')
    expect(result.current.etablissementUser?.compte_verrouille).toBe(false)
    expect(result.current.etablissementUser?.fonction).toBe('Medecin')
    expect(result.current.isEtablissementUser).toBe(true)
  })

  it('retourne null quand aucune correspondance n est trouvée', async () => {
    const builder = createBuilder([
      { data: null, error: null },
      { data: null, error: null },
    ])
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useEtablissementUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.etablissementUser).toBeNull()
    expect(result.current.isEtablissementUser).toBe(false)
    expect(builder.maybeSingle).toHaveBeenCalledTimes(2)
  })

  it('retourne le profil email trouvé si la liaison automatique échoue', async () => {
    const builder = createBuilder([
      { data: null, error: null },
      { data: EMAIL_FOUND, error: null },
      { data: null, error: { message: 'update failed' } },
    ])
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useEtablissementUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(debugError).toHaveBeenCalled()
    expect(result.current.etablissementUser).toEqual(EMAIL_FOUND)
    expect(result.current.etablissementUser?.id).toBe('eu-email-1')
    expect(result.current.etablissementUser?.compte_verrouille).toBe(true)
    expect(result.current.isEtablissementUser).toBe(true)
  })

  it('désactive la query quand il n y a pas d utilisateur authentifié', async () => {
    AUTH_STATE.user = null

    const { result } = renderHook(() => useEtablissementUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.etablissementUser).toBeUndefined()
    expect(result.current.isEtablissementUser).toBe(false)
  })
})

describe('useEtablissementUserById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('charge puis retourne l utilisateur établissement par id avec son établissement', async () => {
    const builder = createBuilder([{ data: USER_BY_ID_FOUND, error: null }])
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useEtablissementUserById('eu-by-id-1'), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(mockFrom).toHaveBeenCalledWith('etablissement_users')
    expect(builder.select).toHaveBeenCalledWith('*, etablissements(nom, ville)')
    expect(builder.eq).toHaveBeenCalledWith('id', 'eu-by-id-1')
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1)

    expect(result.current.data).toEqual(USER_BY_ID_FOUND)
    expect(result.current.data.nom).toBe('Durand')
    expect(result.current.data.prenom).toBe('Alice')
    expect(result.current.data.etablissements.nom).toBe('Clinique du Centre')
    expect(result.current.data.etablissements.ville).toBe('Lyon')
  })

  it('passe en erreur quand la requête supabase échoue', async () => {
    const builder = createBuilder([{ data: null, error: { message: 'x' } }])
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useEtablissementUserById('eu-missing'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeInstanceOf(Object)
    expect(result.current.error?.message).toBe('x')
  })

  it('passe en erreur quand aucun utilisateur établissement n est trouvé', async () => {
    const builder = createBuilder([{ data: null, error: null }])
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useEtablissementUserById('eu-missing'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error?.message).toBe('Utilisateur établissement introuvable')
  })

  it('désactive la query quand aucun id n est fourni', async () => {
    const { result } = renderHook(() => useEtablissementUserById(''), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(result.current.data).toBeUndefined()
    expect(result.current.isSuccess).toBe(false)
  })
})