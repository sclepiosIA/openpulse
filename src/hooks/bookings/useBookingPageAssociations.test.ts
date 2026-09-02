// @ts-nocheck
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// @vitest-environment jsdom

import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useBookingPageTypes,
  useUpdateBookingPageTypes,
  useAddBookingTypeToPage,
  useBookingPageHosts,
  useUpdateBookingPageHosts,
} from './useBookingPageAssociations'

const {
  PAGE_ID,
  TYPE_ROWS,
  TYPE_INSERTED_ROW,
  HOST_ROWS_WITH_PROFILE,
  HOST_ROWS_SIMPLE,
  mockFrom,
  mockToastSuccess,
  queueThenResult,
  queueSingleResult,
  resetQueues,
} = vi.hoisted(() => {
  const PAGE_ID_VALUE = 'page-1'

  const TYPE_ROWS_VALUE = [
    {
      id: 'bpt-1',
      booking_page_id: PAGE_ID_VALUE,
      booking_type_id: 'type-1',
      order_index: 0,
      is_visible: true,
    },
    {
      id: 'bpt-2',
      booking_page_id: PAGE_ID_VALUE,
      booking_type_id: 'type-2',
      order_index: 1,
      is_visible: false,
    },
  ]

  const TYPE_INSERTED_ROW_VALUE = {
    id: 'bpt-3',
    booking_page_id: PAGE_ID_VALUE,
    booking_type_id: 'type-3',
    order_index: 2,
    is_visible: true,
  }

  const HOST_ROWS_WITH_PROFILE_VALUE = [
    {
      id: 'bph-1',
      booking_page_id: PAGE_ID_VALUE,
      user_id: 'user-1',
      is_required: true,
      role: 'host',
      created_at: '2024-01-01',
      profile: {
        id: 'user-1',
        nom: 'Doe',
        prenom: 'Jane',
        avatar_url: null,
        email: 'jane@ex.test',
      },
    },
    {
      id: 'bph-2',
      booking_page_id: PAGE_ID_VALUE,
      user_id: 'user-2',
      is_required: false,
      role: 'co-host',
      created_at: '2024-01-02',
      profile: {
        id: 'user-2',
        nom: 'Smith',
        prenom: 'John',
        avatar_url: 'avatar-2',
        email: 'john@ex.test',
      },
    },
  ]

  const HOST_ROWS_SIMPLE_VALUE = [
    {
      id: 'bph-1',
      booking_page_id: PAGE_ID_VALUE,
      user_id: 'user-1',
      is_required: true,
      role: 'host',
    },
  ]

  const thenQueue: Array<{ data: unknown; error: { message: string } | null }> = []
  const singleQueue: Array<{ data: unknown; error: { message: string } | null }> = []

  const queueThenResultValue = (result: { data: unknown; error: { message: string } | null }) => {
    thenQueue.push(result)
  }

  const queueSingleResultValue = (result: { data: unknown; error: { message: string } | null }) => {
    singleQueue.push(result)
  }

  const resetQueuesValue = () => {
    thenQueue.length = 0
    singleQueue.length = 0
  }

  const createBuilder = () => {
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
      single: vi.fn(() =>
        Promise.resolve(singleQueue.length > 0 ? singleQueue.shift() : { data: null, error: null })
      ),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      then: (
        onFulfilled?: (value: { data: unknown; error: { message: string } | null }) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) =>
        Promise.resolve(
          thenQueue.length > 0 ? thenQueue.shift() : { data: null, error: null }
        ).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(
          thenQueue.length > 0 ? thenQueue.shift() : { data: null, error: null }
        ).catch(onRejected),
    }

    return builder
  }

  const mockFromValue = vi.fn(() => createBuilder())
  const mockToastSuccessValue = vi.fn()

  return {
    PAGE_ID: PAGE_ID_VALUE,
    TYPE_ROWS: TYPE_ROWS_VALUE,
    TYPE_INSERTED_ROW: TYPE_INSERTED_ROW_VALUE,
    HOST_ROWS_WITH_PROFILE: HOST_ROWS_WITH_PROFILE_VALUE,
    HOST_ROWS_SIMPLE: HOST_ROWS_SIMPLE_VALUE,
    mockFrom: mockFromValue,
    mockToastSuccess: mockToastSuccessValue,
    queueThenResult: queueThenResultValue,
    queueSingleResult: queueSingleResultValue,
    resetQueues: resetQueuesValue,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useBookingPageAssociations', () => {
  beforeEach(() => {
    mockFrom.mockClear()
    mockToastSuccess.mockClear()
    resetQueues()
  })

  describe('useBookingPageTypes', () => {
    it('passe de loading à succès et retourne les types triés par order_index', async () => {
      queueThenResult({ data: TYPE_ROWS, error: null })

      const { result } = renderHook(() => useBookingPageTypes(PAGE_ID), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockFrom).toHaveBeenCalledWith('booking_page_types')
      expect(result.current.data).toEqual(TYPE_ROWS)
      expect(result.current.data?.[0]).toMatchObject({
        booking_type_id: 'type-1',
        order_index: 0,
        is_visible: true,
      })
      expect(result.current.data?.[1]).toMatchObject({
        booking_type_id: 'type-2',
        order_index: 1,
        is_visible: false,
      })
    })

    it('passe en erreur si la requête supabase échoue', async () => {
      queueThenResult({ data: null, error: { message: 'x' } })

      const { result } = renderHook(() => useBookingPageTypes(PAGE_ID), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toMatchObject({ message: 'x' })
    })
  })

  describe('useUpdateBookingPageTypes', () => {
    it('supprime puis recrée les associations avec order_index et is_visible', async () => {
      queueThenResult({ data: null, error: null })
      queueThenResult({ data: null, error: null })

      const { result } = renderHook(() => useUpdateBookingPageTypes(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          pageId: PAGE_ID,
          typeIds: ['type-10', 'type-20'],
        })
      })

      expect(mockFrom).toHaveBeenNthCalledWith(1, 'booking_page_types')
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'booking_page_types')

      const deleteBuilder = mockFrom.mock.results[0]?.value
      const insertBuilder = mockFrom.mock.results[1]?.value

      expect(deleteBuilder.delete).toHaveBeenCalledWith()
      expect(deleteBuilder.eq).toHaveBeenCalledWith('booking_page_id', PAGE_ID)
      expect(insertBuilder.insert).toHaveBeenCalledWith([
        {
          booking_page_id: PAGE_ID,
          booking_type_id: 'type-10',
          order_index: 0,
          is_visible: true,
        },
        {
          booking_page_id: PAGE_ID,
          booking_type_id: 'type-20',
          order_index: 1,
          is_visible: true,
        },
      ])
    })

    it('passe en erreur si la suppression échoue', async () => {
      queueThenResult({ data: null, error: { message: 'x' } })

      const { result } = renderHook(() => useUpdateBookingPageTypes(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            pageId: PAGE_ID,
            typeIds: ['type-10'],
          })
        ).rejects.toMatchObject({ message: 'x' })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useAddBookingTypeToPage', () => {
    it('ajoute un type à la page, sélectionne la ligne créée et affiche un toast', async () => {
      queueSingleResult({ data: TYPE_INSERTED_ROW, error: null })

      const { result } = renderHook(() => useAddBookingTypeToPage(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          pageId: PAGE_ID,
          typeId: 'type-3',
        })
      })

      const insertBuilder = mockFrom.mock.results[0]?.value

      expect(mockFrom).toHaveBeenCalledWith('booking_page_types')
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        booking_page_id: PAGE_ID,
        booking_type_id: 'type-3',
      })
      expect(insertBuilder.select).toHaveBeenCalledWith(
        'id, booking_page_id, booking_type_id, order_index, is_visible'
      )
      expect(insertBuilder.single).toHaveBeenCalledWith()
      expect(mockToastSuccess).toHaveBeenCalledWith('Type de RDV ajouté à la page')
    })

    it('passe en erreur si l’insertion échoue', async () => {
      queueSingleResult({ data: null, error: { message: 'x' } })

      const { result } = renderHook(() => useAddBookingTypeToPage(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            pageId: PAGE_ID,
            typeId: 'type-3',
          })
        ).rejects.toMatchObject({ message: 'x' })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useBookingPageHosts', () => {
    it('passe de loading à succès et retourne les hosts enrichis avec profil', async () => {
      queueThenResult({ data: HOST_ROWS_WITH_PROFILE, error: null })

      const { result } = renderHook(() => useBookingPageHosts(PAGE_ID), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockFrom).toHaveBeenCalledWith('booking_page_hosts')
      expect(result.current.data).toEqual(HOST_ROWS_WITH_PROFILE)
      expect(result.current.data?.[0]).toMatchObject({
        user_id: 'user-1',
        role: 'host',
        is_required: true,
      })
      expect(result.current.data?.[0].profile).toMatchObject({
        prenom: 'Jane',
        nom: 'Doe',
      })
      expect(result.current.data?.[1]).toMatchObject({
        user_id: 'user-2',
        role: 'co-host',
        is_required: false,
      })
    })

    it('utilise la requête simple si la jointure profil échoue', async () => {
      queueThenResult({ data: null, error: { message: 'join failed' } })
      queueThenResult({ data: HOST_ROWS_SIMPLE, error: null })

      const { result } = renderHook(() => useBookingPageHosts(PAGE_ID), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockFrom).toHaveBeenCalledTimes(2)
      expect(result.current.data).toEqual(HOST_ROWS_SIMPLE)
      expect(result.current.data?.[0]).toMatchObject({
        user_id: 'user-1',
        role: 'host',
        is_required: true,
      })
    })

    it('passe en erreur si la requête enrichie et le fallback échouent', async () => {
      queueThenResult({ data: null, error: { message: 'join failed' } })
      queueThenResult({ data: null, error: { message: 'x' } })

      const { result } = renderHook(() => useBookingPageHosts(PAGE_ID), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toMatchObject({ message: 'x' })
    })
  })

  describe('useUpdateBookingPageHosts', () => {
    it('supprime puis recrée les hosts avec host/co-host et is_required', async () => {
      queueThenResult({ data: null, error: null })
      queueThenResult({ data: null, error: null })

      const { result } = renderHook(() => useUpdateBookingPageHosts(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          pageId: PAGE_ID,
          userIds: ['user-1', 'user-2'],
        })
      })

      expect(mockFrom).toHaveBeenNthCalledWith(1, 'booking_page_hosts')
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'booking_page_hosts')

      const deleteBuilder = mockFrom.mock.results[0]?.value
      const insertBuilder = mockFrom.mock.results[1]?.value

      expect(deleteBuilder.delete).toHaveBeenCalledWith()
      expect(deleteBuilder.eq).toHaveBeenCalledWith('booking_page_id', PAGE_ID)
      expect(insertBuilder.insert).toHaveBeenCalledWith([
        {
          booking_page_id: PAGE_ID,
          user_id: 'user-1',
          is_required: true,
          role: 'host',
        },
        {
          booking_page_id: PAGE_ID,
          user_id: 'user-2',
          is_required: false,
          role: 'co-host',
        },
      ])
    })

    it('passe en erreur si la suppression échoue', async () => {
      queueThenResult({ data: null, error: { message: 'x' } })

      const { result } = renderHook(() => useUpdateBookingPageHosts(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            pageId: PAGE_ID,
            userIds: ['user-1'],
          })
        ).rejects.toMatchObject({ message: 'x' })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })
})
