import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSupportTicketsSelect } from './useSupportTicketsSelect'

// Données stables hoisted — ne seront jamais recréées
const { ticketsRaw, mockFrom } = vi.hoisted(() => ({
  ticketsRaw: [
    {
      id: 'ticket-1',
      numero_ticket: 'T-001',
      titre: 'Imprimante hors service',
      statut: 'nouveau',
      etablissement: { nom: 'CHU Lille' },
    },
    {
      id: 'ticket-2',
      numero_ticket: 'T-002',
      titre: 'Accès refusé module DPI',
      statut: 'en_cours',
      etablissement: null,
    },
  ],
  mockFrom: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// Crée un builder chaînable dont limit() résout la promesse
function createBuilder(limitResponse: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockResolvedValue(limitResponse)
  return builder
}

describe('useSupportTicketsSelect', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès, mappe etablissement_nom et vérifie numero_ticket/statut', async () => {
    const builder = createBuilder({ data: ticketsRaw, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSupportTicketsSelect(), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)

    const first = result.current.data?.[0]
    expect(first?.id).toBe('ticket-1')
    expect(first?.numero_ticket).toBe('T-001')
    expect(first?.titre).toBe('Imprimante hors service')
    expect(first?.statut).toBe('nouveau')
    expect(first?.etablissement_nom).toBe('CHU Lille')

    const second = result.current.data?.[1]
    expect(second?.statut).toBe('en_cours')
    expect(second?.etablissement_nom).toBeNull()

    expect(mockFrom).toHaveBeenCalledWith('support_tickets')
    expect(builder.in).toHaveBeenCalledWith('statut', ['nouveau', 'en_cours', 'en_attente'])
    expect(builder.order).toHaveBeenCalledWith('date_ouverture', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(100)
  })

  it('expose isError quand supabase retourne une erreur', async () => {
    const err = new Error('permission refusée')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSupportTicketsSelect(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })

  it('retourne [] si data est null sans erreur', async () => {
    const builder = createBuilder({ data: null, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useSupportTicketsSelect(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
