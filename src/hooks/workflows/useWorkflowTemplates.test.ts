import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { templates, mockFrom, mockCreateWorkflow } = vi.hoisted(() => ({
  templates: [
    {
      id: 'tpl-1',
      slug: 'relance-prospect',
      name: 'Relance prospect',
      description: 'Automatise les relances',
      category: 'vente',
      icon: '💼',
      graph: { nodes: [], edges: [] },
      trigger_type: 'manual',
      is_published: true,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'tpl-2',
      slug: 'onboarding-client',
      name: 'Onboarding client',
      description: null,
      category: 'onboarding',
      icon: '🚀',
      graph: { nodes: [], edges: [] },
      trigger_type: 'webhook',
      is_published: true,
      created_at: '2024-01-02T00:00:00Z',
    },
  ],
  mockFrom: vi.fn(),
  mockCreateWorkflow: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}))

// useInstantiateTemplate dépend de useCreateWorkflow
vi.mock('./useWorkflows', () => ({
  useCreateWorkflow: () => ({
    mutateAsync: mockCreateWorkflow,
    isPending: false,
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

function createBuilder(response: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  ;(builder as unknown as { then: (cb: (v: unknown) => unknown) => Promise<unknown> }).then = (
    cb
  ) => Promise.resolve(response).then(cb)
  ;(builder as unknown as { catch: (cb: (e: unknown) => unknown) => Promise<unknown> }).catch = (
    cb
  ) => Promise.resolve(response).catch(cb)
  return builder
}

describe('useWorkflowTemplates', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('passe de isLoading à succès et retourne les templates publiés', async () => {
    const { useWorkflowTemplates } = await import('./useWorkflowTemplates')
    const builder = createBuilder({ data: templates, error: null })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowTemplates(), { wrapper: createWrapper() })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].slug).toBe('relance-prospect')
    expect(result.current.data?.[1].category).toBe('onboarding')
    expect(mockFrom).toHaveBeenCalledWith('workflow_templates')
    expect(builder.eq).toHaveBeenCalledWith('is_published', true)
  })

  it('expose isError quand la requête échoue', async () => {
    const { useWorkflowTemplates } = await import('./useWorkflowTemplates')
    const err = new Error('table inexistante')
    const builder = createBuilder({ data: null, error: err })
    mockFrom.mockReturnValue(builder)

    const { result } = renderHook(() => useWorkflowTemplates(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(err)
  })
})

describe('TEMPLATE_CATEGORIES', () => {
  it('contient les catégories attendues (vente, support, onboarding, ia)', async () => {
    const { TEMPLATE_CATEGORIES } = await import('./useWorkflowTemplates')

    expect(TEMPLATE_CATEGORIES).toHaveProperty('vente')
    expect(TEMPLATE_CATEGORIES).toHaveProperty('support')
    expect(TEMPLATE_CATEGORIES).toHaveProperty('onboarding')
    expect(TEMPLATE_CATEGORIES).toHaveProperty('ia')
    expect(TEMPLATE_CATEGORIES.vente.label).toContain('Vente')
    expect(TEMPLATE_CATEGORIES.ia.label).toContain('IA')
  })
})
