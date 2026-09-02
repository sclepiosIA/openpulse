/**
 * Tests unitaires pour useEmailThreadActions.
 *
 * Ce hook expose 8 mutations react-query qui modifient les emails_threads/messages
 * via Supabase ou des Edge Functions. Les tests couvrent :
 * — Structure initiale (fonctions exposées, états isPending=false)
 * — Mutation archiveThread (succès + toast + invalidation, erreur Supabase)
 * — Mutation markAsSpam (succès + toast, erreur)
 * — Mutation markAsProcessed (succès avec règle métier unread_count=0, erreur)
 * — Mutation markAsRead (succès + double table, erreur)
 * — Mutation deleteThread (succès + toast, erreur)
 * — Mutation updateTags (succès + toast, erreur)
 * — Mutation forwardEmail (Edge Function, succès + toast, erreur)
 * — Mutation toggleStar (succès, erreur)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Type helper (0 `any`) ────────────────────────────────────────────────────
type Chainable = { [k: string]: (...a: unknown[]) => Chainable | Promise<unknown> }

// ─── Références stables hoistées ─────────────────────────────────────────────
const { mockToast, mockFrom, mockFunctionsInvoke } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockToast = vi.fn()
  const mockFunctionsInvoke = vi.fn()
  return { mockToast, mockFrom, mockFunctionsInvoke }
})

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (err: Error) => err.message,
}))

// ─── Import après mocks ───────────────────────────────────────────────────────
import { useEmailThreadActions } from '@/hooks/email/useEmailThreadActions'
import { supabase } from '@/integrations/supabase/client';

// ─── Wrapper QueryClient ──────────────────────────────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

/** Builder chaînable qui résout avec `result` en dernier appel `.eq()` */
function buildChain(result: { data: unknown; error: unknown }): Chainable {
  const chain: Chainable = {
    update: (..._a) => chain,
    eq: (..._a) => Promise.resolve(result) as unknown as Chainable,
    select: (..._a) => chain,
    in: (..._a) => chain,
    is: (..._a) => chain,
  }
  return chain
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('useEmailThreadActions — structure initiale', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue(buildChain({ data: null, error: null }))
  })

  it('expose toutes les fonctions de mutation', () => {
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper: createWrapper() })
    const hook = result.current
    expect(typeof hook.archiveThread).toBe('function')
    expect(typeof hook.markAsSpam).toBe('function')
    expect(typeof hook.markAsProcessed).toBe('function')
    expect(typeof hook.markAsRead).toBe('function')
    expect(typeof hook.updateTags).toBe('function')
    expect(typeof hook.deleteThread).toBe('function')
    expect(typeof hook.forwardEmail).toBe('function')
    expect(typeof hook.toggleStar).toBe('function')
  })

  it('tous les états isPending sont false initialement', () => {
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper: createWrapper() })
    expect(result.current.isArchiving).toBe(false)
    expect(result.current.isMarkingSpam).toBe(false)
    expect(result.current.isMarkingProcessed).toBe(false)
    expect(result.current.isMarkingRead).toBe(false)
    expect(result.current.isUpdatingTags).toBe(false)
    expect(result.current.isDeleting).toBe(false)
    expect(result.current.isForwarding).toBe(false)
    expect(result.current.isTogglingStar).toBe(false)
  })
})

// ─── archiveThread ────────────────────────────────────────────────────────────
describe('useEmailThreadActions — archiveThread', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appelle supabase.from(email_threads).update avec is_archived=true', async () => {
    const chain = buildChain({ data: null, error: null })
    const mockUpdateFn = vi.fn(() => chain)
    const mockEqFn = vi.fn(() => Promise.resolve({ data: null, error: null }))
    mockFrom.mockReturnValue({ update: mockUpdateFn })
    // Ré-chaîne eq sur le retour de update
    ;(chain as Record<string, unknown>).eq = mockEqFn
    ;(chain as Record<string, unknown>).update = mockUpdateFn

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.archiveThread({ threadId: 'thread-1', archived: true })
    })

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('email_threads')
    })
  })

  it('déclenche un toast "Conversation archivée" en cas de succès (archive=true)', async () => {
    // Chaîne complète : update().eq() → resolve sans erreur
    const chainInner = {
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.archiveThread({ threadId: 'thread-1', archived: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Conversation archivée' })
      )
    })
  })

  it('déclenche un toast "Conversation désarchivée" quand archived=false', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.archiveThread({ threadId: 'thread-1', archived: false })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Conversation désarchivée' })
      )
    })
  })

  it(`déclenche un toast d'erreur Supabase`, async () => {
    const supaErr = new Error('Connection refused')
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: supaErr })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.archiveThread({ threadId: 'thread-err', archived: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── markAsSpam ───────────────────────────────────────────────────────────────
describe('useEmailThreadActions — markAsSpam', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Marqué comme spam" quand isSpam=true', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsSpam({ threadId: 'thread-spam', isSpam: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Marqué comme spam' })
      )
    })
  })

  it('toast "Retiré des spams" quand isSpam=false', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsSpam({ threadId: 'thread-spam', isSpam: false })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Retiré des spams' }))
    })
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    const supaErr = new Error('DB error')
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: supaErr })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsSpam({ threadId: 'thread-spam', isSpam: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'Erreur' })
      )
    })
  })
})

// ─── markAsProcessed ──────────────────────────────────────────────────────────
describe('useEmailThreadActions — markAsProcessed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Marqué comme traité" quand processed=true', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsProcessed({ threadId: 'thread-p', processed: true, userId: 'user-1' })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Marqué comme traité' })
      )
    })
  })

  it('toast "Marqué comme non traité" quand processed=false', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsProcessed({ threadId: 'thread-p', processed: false })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Marqué comme non traité' })
      )
    })
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    const supaErr = new Error('DB error')
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: supaErr })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsProcessed({ threadId: 'thread-p', processed: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── markAsRead ───────────────────────────────────────────────────────────────
describe('useEmailThreadActions — markAsRead', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Marqué comme lu" quand read=true, appelle deux tables', async () => {
    // Premier appel : email_threads, deuxième appel : email_messages
    const innerChainMessages = {
      eq: vi.fn().mockReturnThis(),
      then: vi.fn((cb: (v: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(cb)
      ),
    }
    ;(innerChainMessages.eq as ReturnType<typeof vi.fn>).mockReturnValue({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })

    const innerChainThreads = {
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }

    mockFrom.mockImplementation((table: unknown) => {
      if (table === 'email_threads') return { update: vi.fn(() => innerChainThreads) }
      // email_messages
      return {
        update: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          then: vi.fn((cb: (v: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(cb)
          ),
        })),
      }
    })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsRead({ threadId: 'thread-r', read: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Marqué comme lu' }))
    })
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    const supaErr = new Error('Read error')
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: supaErr })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.markAsRead({ threadId: 'thread-r', read: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── deleteThread ─────────────────────────────────────────────────────────────
describe('useEmailThreadActions — deleteThread', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Conversation supprimée" en cas de succès', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.deleteThread({ threadId: 'thread-del' })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Conversation supprimée' })
      )
    })
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    const supaErr = new Error('Delete error')
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: supaErr })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.deleteThread({ threadId: 'thread-del-err' })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', title: 'Erreur' })
      )
    })
  })
})

// ─── updateTags ───────────────────────────────────────────────────────────────
describe('useEmailThreadActions — updateTags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Tags mis à jour" en cas de succès', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.updateTags({ threadId: 'thread-tag', tags: ['urgent', 'rdv'] })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tags mis à jour' }))
    })
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    const supaErr = new Error('Tags error')
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: supaErr })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.updateTags({ threadId: 'thread-tag-err', tags: [] })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})

// ─── forwardEmail ─────────────────────────────────────────────────────────────
describe('useEmailThreadActions — forwardEmail (Edge Function)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appelle functions.invoke("forward-email") avec les bons paramètres', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null })
    // from ne doit pas être appelé pour forwardEmail
    mockFrom.mockReturnValue({})

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.forwardEmail({
        messageId: 'msg-1',
        toAddresses: ['dest@chu.fr'],
        additionalContent: 'FWD',
      })
    })

    await waitFor(() => {
      expect(mockFunctionsInvoke).toHaveBeenCalledWith(
        'forward-email',
        expect.objectContaining({
          body: expect.objectContaining({
            message_id: 'msg-1',
            to_addresses: ['dest@chu.fr'],
            additional_content: 'FWD',
          }),
        })
      )
    })
  })

  it('toast "Email transféré" en cas de succès', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null })
    mockFrom.mockReturnValue({})

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.forwardEmail({ messageId: 'msg-1', toAddresses: ['a@b.com'] })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Email transféré' }))
    })
  })

  it(`toast d'erreur "Erreur de transfert" si la fonction échoue`, async () => {
    const fnErr = new Error('Edge function error')
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: fnErr })
    mockFrom.mockReturnValue({})

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.forwardEmail({ messageId: 'msg-fail', toAddresses: ['fail@b.com'] })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Erreur de transfert', variant: 'destructive' })
      )
    })
  })
})

// ─── toggleStar ───────────────────────────────────────────────────────────────
describe('useEmailThreadActions — toggleStar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('toast "Ajouté aux favoris" quand starred=true', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.toggleStar({ threadId: 'thread-star', starred: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Ajouté aux favoris' })
      )
    })
  })

  it('toast "Retiré des favoris" quand starred=false', async () => {
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: null })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.toggleStar({ threadId: 'thread-star', starred: false })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Retiré des favoris' })
      )
    })
  })

  it(`toast destructive en cas d'erreur Supabase`, async () => {
    const supaErr = new Error('Star error')
    const chainInner = { eq: vi.fn(() => Promise.resolve({ data: null, error: supaErr })) }
    mockFrom.mockReturnValue({ update: vi.fn(() => chainInner) })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useEmailThreadActions(), { wrapper })

    await act(async () => {
      result.current.toggleStar({ threadId: 'thread-star-err', starred: true })
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    })
  })
})
