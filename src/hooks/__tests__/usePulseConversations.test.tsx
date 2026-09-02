/**
 * Tests unitaires pour usePulseConversations et hooks associés.
 *
 * Couvre :
 * — usePulseConversations : fetch + tri last_message + désactivation si erreur
 * — usePulseConversation (id) : fetch détail, enabled si id défini
 * — useCreatePulseConversation : mutation success + invalidation
 * — useUpdatePulseConversation : mutation success + invalidation
 * — useArchivePulseConversation : mutation success + invalidation
 * — useAddPulseConversationMember / useRemovePulseConversationMember
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Type chaînable stable ────────────────────────────────────────────────────
type Chainable = { [k: string]: (...a: unknown[]) => Chainable | Promise<unknown> }

// ─── Mocks hoistés ────────────────────────────────────────────────────────────
const { mockFromSupa, mockFromExtended, mockCurrentProfileData } = vi.hoisted(() => ({
  mockFromSupa: vi.fn(),
  mockFromExtended: vi.fn(),
  mockCurrentProfileData: {
    id: 'profile-abc',
    prenom: 'Camille',
    nom: 'Durand',
    email: 'membre.equipe@example.invalid',
  },
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFromSupa, rpc: vi.fn() },
}))

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: mockCurrentProfileData }),
}))

vi.mock('@/lib/debug', () => ({
  debug: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/queryPresets', () => ({
  queryPresets: {
    standard: { staleTime: 0, gcTime: 0 },
  },
}))

// ─── Imports APRÈS les mocks ─────────────────────────────────────────────────
import {
  usePulseConversations,
  usePulseConversation,
  useCreatePulseConversation,
  useUpdatePulseConversation,
  useArchivePulseConversation,
  useAddPulseConversationMember,
  useRemovePulseConversationMember,
} from '@/hooks/pulse/usePulseConversations'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'

// ─── Wrapper QueryClient ──────────────────────────────────────────────────────
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

// ─── Proxy chaînable ─────────────────────────────────────────────────────────
function chainProxy(resolved: unknown): Chainable {
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'then')
        return (cb: (v: unknown) => unknown) => Promise.resolve(resolved).then(cb)
      return vi.fn((..._args: unknown[]) => new Proxy({}, handler))
    },
  }
  return new Proxy({}, handler) as Chainable
}

// ─── Données de test ─────────────────────────────────────────────────────────
const MOCK_CONVERSATION = {
  id: 'conv-1',
  name: 'Équipe Dev',
  description: 'Conversation dev',
  visibility: 'private' as const,
  created_by: 'profile-abc',
  is_archived: false,
  archived_at: null,
  archived_by: null,
  etablissement_id: null,
  metadata: {},
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
  etablissement: null,
  creator: {
    id: 'profile-abc',
    nom: 'Durand',
    prenom: 'Camille',
    email: 'membre.equipe@example.invalid',
    avatar_url: null,
  },
  members: [],
  last_message: [
    {
      id: 'msg-1',
      content: 'Bonjour',
      created_at: '2026-01-10T10:00:00Z',
      user: { nom: 'Durand', prenom: 'Camille', avatar_url: null },
    },
    {
      id: 'msg-2',
      content: 'Dernier message',
      created_at: '2026-01-15T15:00:00Z',
      user: { nom: 'Durand', prenom: 'Camille', avatar_url: null },
    },
  ],
}

describe('usePulseConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromSupa.mockImplementation((_table: string) =>
      chainProxy({ data: [MOCK_CONVERSATION], error: null })
    )
  })

  it('retourne les conversations', async () => {
    const { result } = renderHook(() => usePulseConversations(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.length).toBe(1)
    expect(result.current.data?.[0].name).toBe('Équipe Dev')
  })

  it('trie last_message pour ne garder que le plus récent', async () => {
    const { result } = renderHook(() => usePulseConversations(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

    const conv = result.current.data?.[0]
    expect(conv).toBeDefined()
    // Le hook doit avoir sélectionné le message le plus récent (2026-01-15)
    // last_message est désormais un objet unique (pas un tableau)
    const lm = conv?.last_message as { id: string; created_at: string } | null
    expect(lm).not.toBeNull()
    expect(lm?.id).toBe('msg-2')
    expect(lm?.created_at).toBe('2026-01-15T15:00:00Z')
  })

  it('retourne last_message=null quand pas de messages', async () => {
    mockFromSupa.mockImplementation((_table: string) =>
      chainProxy({
        data: [{ ...MOCK_CONVERSATION, last_message: [] }],
        error: null,
      })
    )

    const { result } = renderHook(() => usePulseConversations(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

    const conv = result.current.data?.[0]
    expect(conv?.last_message).toBeNull()
  })

  it('lance une erreur si Supabase renvoie une erreur', async () => {
    mockFromSupa.mockImplementation((_table: string) =>
      chainProxy({ data: null, error: { message: 'Accès refusé', code: '403' } })
    )

    const { result } = renderHook(() => usePulseConversations(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 })
    expect(result.current.data).toBeUndefined()
  })

  it('retourne une liste vide si data est null sans erreur', async () => {
    mockFromSupa.mockImplementation((_table: string) => chainProxy({ data: null, error: null }))

    const { result } = renderHook(() => usePulseConversations(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

    expect(result.current.data).toEqual([])
  })
})

describe('usePulseConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromSupa.mockImplementation((_table: string) =>
      chainProxy({ data: { ...MOCK_CONVERSATION, last_message: [] }, error: null })
    )
  })

  it("n'est pas activé si id est undefined", () => {
    const { result } = renderHook(() => usePulseConversation(undefined), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
  })

  it('charge la conversation si id est défini', async () => {
    const { result } = renderHook(() => usePulseConversation('conv-1'), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

    expect(result.current.data).toBeDefined()
    expect(result.current.data?.id).toBe('conv-1')
    expect(result.current.data?.name).toBe('Équipe Dev')
  })

  it('retourne null si maybeSingle retourne null', async () => {
    mockFromSupa.mockImplementation((_table: string) => chainProxy({ data: null, error: null }))

    const { result } = renderHook(() => usePulseConversation('conv-inexistant'), {
      wrapper: makeWrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 })

    expect(result.current.data).toBeNull()
  })
})

describe('useCreatePulseConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { id: 'new-conv-1', name: 'Nouvelle Conv' },
      error: null,
    } as never)
    mockFromSupa.mockImplementation((_table: string) => chainProxy({ data: [], error: null }))
  })

  it('crée une conversation et appelle toast.success', async () => {
    const { result } = renderHook(() => useCreatePulseConversation(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Nouvelle Conv',
        visibility: 'private',
        description: undefined,
      })
    })

    expect(supabase.rpc).toHaveBeenCalledWith('create_pulse_conversation', {
      p_name: 'Nouvelle Conv',
      p_description: null,
      p_visibility: 'private',
      p_etablissement_id: null,
      p_metadata: {},
      p_member_ids: [],
    })
    expect(toast.success).toHaveBeenCalledWith('Conversation créée')
  })

  it('appelle toast.error en cas de mutation échouée', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Insert failed' },
    } as never)

    const { result } = renderHook(() => useCreatePulseConversation(), { wrapper: makeWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({
          name: 'Test',
          visibility: 'private',
          description: undefined,
        })
      } catch {
        // attendu
      }
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 3000 })
  })
})

describe('useUpdatePulseConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromSupa.mockImplementation((_table: string) =>
      chainProxy({ data: { id: 'conv-1', name: 'Conv modifiée' }, error: null })
    )
  })

  it('met à jour une conversation et appelle toast.success', async () => {
    const { result } = renderHook(() => useUpdatePulseConversation(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'conv-1', name: 'Conv modifiée' })
    })

    expect(mockFromSupa).toHaveBeenCalledWith('pulse_conversations')
    expect(toast.success).toHaveBeenCalledWith('Conversation mise à jour')
  })

  it('appelle toast.error si la mise à jour échoue', async () => {
    mockFromSupa.mockImplementation((_table: string) =>
      chainProxy({ data: null, error: { message: 'Update failed' } })
    )

    const { result } = renderHook(() => useUpdatePulseConversation(), { wrapper: makeWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'conv-1', name: 'Test' })
      } catch {
        // attendu
      }
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 3000 })
  })
})

describe('useArchivePulseConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromSupa.mockImplementation((_table: string) => chainProxy({ data: null, error: null }))
  })

  it('archive une conversation et appelle toast.success', async () => {
    const { result } = renderHook(() => useArchivePulseConversation(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync('conv-1')
    })

    expect(mockFromSupa).toHaveBeenCalledWith('pulse_conversations')
    expect(toast.success).toHaveBeenCalledWith('Conversation archivée')
  })

  it('appelle toast.error si archivage échoue', async () => {
    mockFromSupa.mockImplementation((_table: string) =>
      chainProxy({ data: null, error: { message: 'Archive failed' } })
    )

    const { result } = renderHook(() => useArchivePulseConversation(), { wrapper: makeWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync('conv-1')
      } catch {
        // attendu
      }
    })

    await waitFor(() => expect(toast.error).toHaveBeenCalled(), { timeout: 3000 })
  })
})

describe('useAddPulseConversationMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromSupa.mockImplementation((_table: string) => chainProxy({ data: null, error: null }))
  })

  it('ajoute un membre et appelle toast.success', async () => {
    const { result } = renderHook(() => useAddPulseConversationMember(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({
        conversationId: 'conv-1',
        userId: 'user-2',
        role: 'member',
      })
    })

    expect(mockFromSupa).toHaveBeenCalledWith('pulse_conversation_members')
    expect(toast.success).toHaveBeenCalledWith('Membre ajouté')
  })
})

describe('useRemovePulseConversationMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromSupa.mockImplementation((_table: string) => chainProxy({ data: null, error: null }))
  })

  it('retire un membre et appelle toast.success', async () => {
    const { result } = renderHook(() => useRemovePulseConversationMember(), {
      wrapper: makeWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({
        conversationId: 'conv-1',
        userId: 'user-2',
      })
    })

    expect(mockFromSupa).toHaveBeenCalledWith('pulse_conversation_members')
    expect(toast.success).toHaveBeenCalledWith('Membre retiré')
  })
})
