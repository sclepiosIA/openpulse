import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCsmContactsMutations } from './useCsmContactsMutations'

type SupabaseErrorShape = { message: string }
type SupabaseResult = { data: unknown; error: SupabaseErrorShape | null }
type Builder = {
  select: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  gte: ReturnType<typeof vi.fn>
  lte: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  then: ReturnType<typeof vi.fn>
  catch: ReturnType<typeof vi.fn>
}

const {
  state,
  mockFrom,
  mockInvalidateQueries,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  builder,
} = vi.hoisted(() => {
  const state = {
    result: { data: null, error: null } as SupabaseResult,
  }

  const builder = {} as Builder

  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.gte = vi.fn(() => builder)
  builder.lte = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(state.result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(state.result))
  builder.then = vi.fn(
    (onFulfilled?: (value: SupabaseResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.result).then(onFulfilled, onRejected)
  )
  builder.catch = vi.fn((onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve(state.result).catch(onRejected)
  )

  return {
    state,
    builder,
    mockFrom: vi.fn(() => builder),
    mockInvalidateQueries: vi.fn(() => Promise.resolve()),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockSanitizeSupabaseError: vi.fn(
      (error: Error | SupabaseErrorShape) => `sanitized:${error.message}`
    ),
  }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(mockInvalidateQueries)

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  return { queryClient, wrapper }
}

describe('useCsmContactsMutations', () => {
  beforeEach(() => {
    state.result = { data: null, error: null }
    mockFrom.mockClear()
    mockInvalidateQueries.mockClear()
    mockToastSuccess.mockClear()
    mockToastError.mockClear()
    mockSanitizeSupabaseError.mockClear()

    builder.select.mockClear()
    builder.eq.mockClear()
    builder.gte.mockClear()
    builder.lte.mockClear()
    builder.in.mockClear()
    builder.order.mockClear()
    builder.limit.mockClear()
    builder.insert.mockClear()
    builder.update.mockClear()
    builder.delete.mockClear()
    builder.single.mockClear()
    builder.maybeSingle.mockClear()
    builder.then.mockClear()
    builder.catch.mockClear()
  })

  it('met à jour un contact puis invalide la liste sans toast', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper })

    await act(async () => {
      result.current.handleUpdate('contact-1', 'email', 'new@mail.test')
    })

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contacts')
      expect(builder.update).toHaveBeenCalledWith({ email: 'new@mail.test' })
      expect(builder.eq).toHaveBeenCalledWith('id', 'contact-1')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['csm-contacts-all'] })
    })

    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('ajoute un contact avec les champs métier attendus, invalide et affiche un succès', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper })

    await act(async () => {
      result.current.handleAdd('eta-42')
    })

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contacts')
      expect(builder.insert).toHaveBeenCalledWith({
        etablissement_id: 'eta-42',
        nom: '',
        prenom: '',
      })
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['csm-contacts-all'] })
      expect(mockToastSuccess).toHaveBeenCalledWith('Contact ajouté')
    })

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('supprime un contact, invalide et affiche un succès', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper })

    await act(async () => {
      result.current.handleDelete('contact-9')
    })

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contacts')
      expect(builder.delete).toHaveBeenCalledTimes(1)
      expect(builder.eq).toHaveBeenCalledWith('id', 'contact-9')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['csm-contacts-all'] })
      expect(mockToastSuccess).toHaveBeenCalledWith('Contact supprimé')
    })

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('gère une erreur de mise à jour avec sanitizer puis toast.error', async () => {
    state.result = { data: null, error: { message: 'x' } }

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper })

    await act(async () => {
      result.current.handleUpdate('contact-2', 'nom', 'Dupont')
    })

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contacts')
      expect(builder.update).toHaveBeenCalledWith({ nom: 'Dupont' })
      expect(builder.eq).toHaveBeenCalledWith('id', 'contact-2')
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
      expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
    })

    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('gère une erreur d ajout avec sanitizer puis toast.error', async () => {
    state.result = { data: null, error: { message: 'x' } }

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper })

    await act(async () => {
      result.current.handleAdd('eta-99')
    })

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contacts')
      expect(builder.insert).toHaveBeenCalledWith({
        etablissement_id: 'eta-99',
        nom: '',
        prenom: '',
      })
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
      expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
    })

    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })

  it('gère une erreur de suppression avec sanitizer puis toast.error', async () => {
    state.result = { data: null, error: { message: 'x' } }

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCsmContactsMutations(), { wrapper })

    await act(async () => {
      result.current.handleDelete('contact-7')
    })

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contacts')
      expect(builder.delete).toHaveBeenCalledTimes(1)
      expect(builder.eq).toHaveBeenCalledWith('id', 'contact-7')
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
      expect(mockToastError).toHaveBeenCalledWith('sanitized:x')
    })

    expect(mockInvalidateQueries).not.toHaveBeenCalled()
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
