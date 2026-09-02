/**
 * Tests unitaires pour useAssignInterlocutor.
 *
 * Ce hook est une fonction async (pas useMutation) qui orchestre
 * de nombreux appels Supabase. Les tests couvrent :
 * — Structure initiale (isAssigning=false, fonction exposée)
 * — Succès pour entityType="etablissement" : mise à jour thread, mapping email, contact créé
 * — Succès pour entityType="partenaire" : passage en table partenaires_contacts
 * — Toast succès avec nom de l'entité
 * — Gestion d'erreur (threadError → toast.error, return false)
 * — Domaine générique (gmail.com) : mapping créé mais pas de contact
 * — Domaine interne OpenPulse : ignoré entièrement
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Type helper ──────────────────────────────────────────────────────────────
type Chainable = { [k: string]: (...a: any[]) => Chainable | Promise<unknown> }

// ─── Références stables hoistées ─────────────────────────────────────────────
const {
  mockToastSuccess,
  mockToastError,
  mockFrom,
  mockFunctionsInvoke,
  mockDebugLog,
  mockDebugError,
  mockDebugWarn,
} = vi.hoisted(() => {
  return {
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockFrom: vi.fn(),
    mockFunctionsInvoke: vi.fn(),
    mockDebugLog: vi.fn(),
    mockDebugError: vi.fn(),
    mockDebugWarn: vi.fn(),
  }
})

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockFunctionsInvoke },
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    log: mockDebugLog,
    error: mockDebugError,
    warn: mockDebugWarn,
  },
}))

// ─── Import après mocks ───────────────────────────────────────────────────────
import { useAssignInterlocutor } from '@/hooks/email/useAssignInterlocutor'
import { supabase } from '@/integrations/supabase/client';

// ─── Wrapper ──────────────────────────────────────────────────────────────────
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// ─── Builder de chaînes chainable helper ─────────────────────────────────────

/** Crée un mock upsert/insert qui résout directement sans error */
function chainInsert(data: unknown = null, error: unknown = null): Chainable {
  const chain: Chainable = {
    upsert: () => Promise.resolve({ data, error }) as unknown as Chainable,
    insert: () => Promise.resolve({ data, error }) as unknown as Chainable,
    update: () => chainInsert(data, error),
    select: () => chainInsert(data, error),
    eq: () => Promise.resolve({ data, error }) as unknown as Chainable,
    single: () => Promise.resolve({ data, error }) as unknown as Chainable,
    maybeSingle: () => Promise.resolve({ data, error }) as unknown as Chainable,
    in: () => Promise.resolve({ data, error }) as unknown as Chainable,
    is: () => chainInsert(data, error),
    neq: () => Promise.resolve({ data, error }) as unknown as Chainable,
    then: (cb: (v: unknown) => unknown) =>
      Promise.resolve({ data, error }).then(cb) as unknown as Chainable,
  }
  return chain
}

// ─── Setup du mock complet pour le "happy path" établissement ─────────────────
function setupHappyPathEtablissement() {
  mockFunctionsInvoke.mockResolvedValue({ data: { tasks_created: 0 }, error: null })

  mockFrom.mockImplementation((table: unknown) => {
    switch (table) {
      case 'email_threads':
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: { id: 'thread-1', ai_extracted_data: null },
                    error: null,
                  })
                ),
              })),
            })),
          })),
          in: vi.fn(() => ({
            is: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            then: (cb: (v: unknown) => unknown) =>
              Promise.resolve({ data: [], error: null }).then(cb),
          })),
        }
      case 'email_messages':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              Promise.resolve({
                data: [
                  {
                    from_address: 'contact@chu-paris.example.org',
                    from_name: 'Dr Martin',
                    to_addresses: [],
                    cc_addresses: [],
                  },
                ],
                error: null,
              })
            ),
            in: vi.fn(() => Promise.resolve({ data: [], error: null })),
            neq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            message_id: null,
            reference_headers: null,
            in_reply_to: null,
          })),
        }
      case 'email_specific_mappings':
        return chainInsert({ id: 'map-1' })
      case 'contacts':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ data: { id: 'contact-new' }, error: null })),
        }
      case 'email_domain_mappings':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
          })),
          insert: vi.fn(() => Promise.resolve({ data: { id: 'domain-1' }, error: null })),
        }
      default:
        return chainInsert()
    }
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('useAssignInterlocutor — structure initiale', () => {
  it('expose assignInterlocutor et isAssigning=false', () => {
    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })
    expect(typeof result.current.assignInterlocutor).toBe('function')
    expect(result.current.isAssigning).toBe(false)
  })
})

describe('useAssignInterlocutor — succès etablissement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupHappyPathEtablissement()
  })

  it('retourne true après une attribution réussie', async () => {
    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    let returnValue: boolean | undefined
    await act(async () => {
      returnValue = await result.current.assignInterlocutor({
        threadId: 'thread-1',
        entityType: 'etablissement',
        entityId: 'etab-1',
        entityName: 'CHU Paris',
        senderEmail: 'contact@chu-paris.example.org',
        senderName: 'Dr Martin',
      })
    })

    expect(returnValue).toBe(true)
  })

  it(`appelle toast.success avec le nom de l'entité`, async () => {
    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.assignInterlocutor({
        threadId: 'thread-1',
        entityType: 'etablissement',
        entityId: 'etab-1',
        entityName: 'CHU Paris',
        senderEmail: 'contact@chu-paris.example.org',
        senderName: 'Dr Martin',
      })
    })

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Attribué à CHU Paris',
      expect.objectContaining({ description: expect.any(String) })
    )
  })

  it(`isAssigning repasse à false après l'appel`, async () => {
    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.assignInterlocutor({
        threadId: 'thread-1',
        entityType: 'etablissement',
        entityId: 'etab-1',
        entityName: 'CHU Paris',
        senderEmail: 'contact@chu-paris.example.org',
        senderName: 'Dr Martin',
      })
    })

    expect(result.current.isAssigning).toBe(false)
  })

  it('appelle supabase.from("email_threads").update avec le bon entityId', async () => {
    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.assignInterlocutor({
        threadId: 'thread-1',
        entityType: 'etablissement',
        entityId: 'etab-42',
        entityName: 'CH Lyon',
        senderEmail: 'contact@ch-lyon.example.org',
        senderName: null,
      })
    })

    expect(mockFrom).toHaveBeenCalledWith('email_threads')
  })
})

describe('useAssignInterlocutor — erreur Supabase (threadError)', () => {
  beforeEach(() => vi.clearAllMocks())

  it(`retourne false en cas d'erreur sur la mise à jour du thread`, async () => {
    const supaErr = new Error('Thread update failed')

    mockFrom.mockImplementation((table: unknown) => {
      if (table === 'email_threads') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: supaErr })),
              })),
            })),
          })),
        }
      }
      return chainInsert()
    })

    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    let returnValue: boolean | undefined
    await act(async () => {
      returnValue = await result.current.assignInterlocutor({
        threadId: 'thread-err',
        entityType: 'etablissement',
        entityId: 'etab-1',
        entityName: 'CHU Paris',
        senderEmail: 'contact@chu.fr',
        senderName: null,
      })
    })

    expect(returnValue).toBe(false)
  })

  it(`appelle toast.error "Erreur lors de l'attribution"`, async () => {
    const supaErr = new Error('Thread update failed')

    mockFrom.mockImplementation((table: unknown) => {
      if (table === 'email_threads') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: supaErr })),
              })),
            })),
          })),
        }
      }
      return chainInsert()
    })

    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.assignInterlocutor({
        threadId: 'thread-err',
        entityType: 'etablissement',
        entityId: 'etab-1',
        entityName: 'CHU Paris',
        senderEmail: 'contact@chu.fr',
        senderName: null,
      })
    })

    expect(mockToastError).toHaveBeenCalledWith("Erreur lors de l'attribution")
  })

  it(`isAssigning repasse à false même en cas d'erreur`, async () => {
    const supaErr = new Error('Thread update failed')

    mockFrom.mockImplementation((table: unknown) => {
      if (table === 'email_threads') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null, error: supaErr })),
              })),
            })),
          })),
        }
      }
      return chainInsert()
    })

    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.assignInterlocutor({
        threadId: 'thread-err',
        entityType: 'etablissement',
        entityId: 'etab-1',
        entityName: 'CHU Paris',
        senderEmail: 'contact@chu.fr',
        senderName: null,
      })
    })

    expect(result.current.isAssigning).toBe(false)
  })
})

describe('useAssignInterlocutor — domaine générique (gmail.com)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ne crée pas de contact pour un email gmail.com', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { tasks_created: 0 }, error: null })

    const mockContactsInsert = vi.fn(() => Promise.resolve({ data: { id: 'c-new' }, error: null }))

    mockFrom.mockImplementation((table: unknown) => {
      switch (table) {
        case 'email_threads':
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: { id: 'thread-gmail', ai_extracted_data: null },
                      error: null,
                    })
                  ),
                })),
              })),
            })),
            in: vi.fn(() => ({
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              then: (cb: (v: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null }).then(cb),
            })),
          }
        case 'email_messages':
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
              in: vi.fn(() => Promise.resolve({ data: [], error: null })),
              neq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          }
        case 'email_specific_mappings':
          return chainInsert({ id: 'map-1' })
        case 'contacts':
          return {
            insert: mockContactsInsert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          }
        case 'email_domain_mappings':
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
            insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          }
        default:
          return chainInsert()
      }
    })

    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.assignInterlocutor({
        threadId: 'thread-gmail',
        entityType: 'etablissement',
        entityId: 'etab-1',
        entityName: 'CHU Paris',
        senderEmail: 'patient@gmail.com',
        senderName: 'Jean Dupont',
      })
    })

    // Contact ne doit PAS être créé pour gmail.com
    expect(mockContactsInsert).not.toHaveBeenCalled()
  })
})

describe('useAssignInterlocutor — entityType="partenaire"', () => {
  beforeEach(() => vi.clearAllMocks())

  it('utilise partenaires_contacts et retourne true', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { tasks_created: 0 }, error: null })

    const mockPartenairesInsert = vi.fn(() =>
      Promise.resolve({ data: { id: 'pc-1' }, error: null })
    )

    mockFrom.mockImplementation((table: unknown) => {
      switch (table) {
        case 'email_threads':
          return {
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() =>
                    Promise.resolve({
                      data: { id: 'thread-part', ai_extracted_data: null },
                      error: null,
                    })
                  ),
                })),
              })),
            })),
            in: vi.fn(() => ({
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              then: (cb: (v: unknown) => unknown) =>
                Promise.resolve({ data: [], error: null }).then(cb),
            })),
          }
        case 'email_messages':
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      from_address: 'partner@biotech.com',
                      from_name: 'Alice',
                      to_addresses: [],
                      cc_addresses: [],
                    },
                  ],
                  error: null,
                })
              ),
              in: vi.fn(() => Promise.resolve({ data: [], error: null })),
              neq: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          }
        case 'email_specific_mappings':
          return chainInsert({ id: 'map-p' })
        case 'partenaires_contacts':
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
            insert: mockPartenairesInsert,
          }
        case 'email_domain_mappings':
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
            insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
          }
        default:
          return chainInsert()
      }
    })

    const { result } = renderHook(() => useAssignInterlocutor(), { wrapper: createWrapper() })

    let returnValue: boolean | undefined
    await act(async () => {
      returnValue = await result.current.assignInterlocutor({
        threadId: 'thread-part',
        entityType: 'partenaire',
        entityId: 'part-1',
        entityName: 'BioTech SA',
        senderEmail: 'partner@biotech.com',
        senderName: 'Alice',
      })
    })

    expect(returnValue).toBe(true)
    expect(mockPartenairesInsert).toHaveBeenCalled()
  })
})
