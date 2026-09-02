/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useRescheduleBooking,
  useCancelBooking,
  useUpdateBookingGuestInfo,
} from './useBookingMutations'

const {
  CURRENT_BOOKING,
  RESCHEDULED_BOOKING,
  CANCELLED_BOOKING,
  UPDATED_BOOKING,
  SANITIZED_MESSAGE,
  mockFrom,
  mockToastSuccess,
  mockToastError,
  mockSanitizeSupabaseError,
  mockNotifyBooking,
} = vi.hoisted(() => ({
  CURRENT_BOOKING: {
    start_time: '2025-05-01T09:00:00.000Z',
    end_time: '2025-05-01T10:00:00.000Z',
  },
  RESCHEDULED_BOOKING: {
    id: 'booking-1',
    start_time: '2025-05-02T11:00:00.000Z',
    end_time: '2025-05-02T12:00:00.000Z',
  },
  CANCELLED_BOOKING: {
    id: 'booking-2',
  },
  UPDATED_BOOKING: {
    id: 'booking-3',
  },
  SANITIZED_MESSAGE: 'Erreur propre',
  mockFrom: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
  mockNotifyBooking: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
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

vi.mock('./notifyBooking', () => ({
  notifyBooking: mockNotifyBooking,
}))

type QueryResult<T> = {
  data: T | null
  error: { message: string } | null
}

type BuilderConfig = {
  maybeSingleResult?: QueryResult<unknown>
  singleResult?: QueryResult<unknown>
}

type ChainableBuilder = {
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
  maybeSingle: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  then: Promise<QueryResult<unknown>>['then']
  catch: Promise<QueryResult<unknown>>['catch']
}

function createBuilder(config: BuilderConfig): ChainableBuilder {
  const builder = {} as ChainableBuilder
  const resolvedSingle = config.singleResult ?? { data: null, error: null }
  const resolvedMaybeSingle = config.maybeSingleResult ?? { data: null, error: null }

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
  builder.maybeSingle = vi.fn(() => Promise.resolve(resolvedMaybeSingle))
  builder.single = vi.fn(() => Promise.resolve(resolvedSingle))
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(resolvedSingle).then(onFulfilled, onRejected)
  builder.catch = (onRejected) => Promise.resolve(resolvedSingle).catch(onRejected)

  return builder
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(client: QueryClient) {
  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, props.children)
  }
}

describe('useBookingMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSanitizeSupabaseError.mockReturnValue(SANITIZED_MESSAGE)
  })

  describe('useRescheduleBooking', () => {
    it('gère le chargement puis le succès, reprogramme le booking et déclenche invalidations, notification et toast', async () => {
      const currentBuilder = createBuilder({
        maybeSingleResult: { data: CURRENT_BOOKING, error: null },
      })
      const updateBuilder = createBuilder({
        singleResult: { data: RESCHEDULED_BOOKING, error: null },
      })

      mockFrom.mockReturnValueOnce(currentBuilder).mockReturnValueOnce(updateBuilder)

      const client = createTestQueryClient()
      const invalidateQueriesSpy = vi
        .spyOn(client, 'invalidateQueries')
        .mockResolvedValue(undefined)

      const { result } = renderHook(() => useRescheduleBooking(), {
        wrapper: createWrapper(client),
      })

      expect(result.current.isIdle).toBe(true)

      const payload = {
        id: 'booking-1',
        start_time: '2025-05-02T11:00:00.000Z',
        end_time: '2025-05-02T12:00:00.000Z',
      }

      act(() => {
        result.current.mutate(payload)
      })

      await waitFor(() => {
        expect(result.current.isPending || result.current.isSuccess).toBe(true)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFrom).toHaveBeenNthCalledWith(1, 'bookings')
      expect(mockFrom).toHaveBeenNthCalledWith(2, 'bookings')

      expect(currentBuilder.select).toHaveBeenCalledWith('start_time, end_time')
      expect(currentBuilder.eq).toHaveBeenCalledWith('id', 'booking-1')
      expect(currentBuilder.maybeSingle).toHaveBeenCalledTimes(1)

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          start_time: '2025-05-02T11:00:00.000Z',
          end_time: '2025-05-02T12:00:00.000Z',
          status: 'confirmed',
          confirmed_at: expect.any(String),
        })
      )
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'booking-1')
      expect(updateBuilder.select).toHaveBeenCalledWith('id, start_time, end_time')
      expect(updateBuilder.single).toHaveBeenCalledTimes(1)

      expect(result.current.data).toEqual({
        booking: RESCHEDULED_BOOKING,
        oldStartTime: '2025-05-01T09:00:00.000Z',
        oldEndTime: '2025-05-01T10:00:00.000Z',
      })

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['upcoming-bookings'] })
      expect(mockNotifyBooking).toHaveBeenCalledWith('booking-1', 'rescheduled', {
        oldStartTime: '2025-05-01T09:00:00.000Z',
        oldEndTime: '2025-05-01T10:00:00.000Z',
      })
      expect(mockToastSuccess).toHaveBeenCalledWith('RDV reprogrammé — email envoyé au client')
      expect(mockToastError).not.toHaveBeenCalled()
    })

    it('passe en erreur si la mise à jour échoue et affiche le message nettoyé', async () => {
      const currentBuilder = createBuilder({
        maybeSingleResult: { data: CURRENT_BOOKING, error: null },
      })
      const updateBuilder = createBuilder({
        singleResult: { data: null, error: { message: 'x' } },
      })

      mockFrom.mockReturnValueOnce(currentBuilder).mockReturnValueOnce(updateBuilder)

      const client = createTestQueryClient()

      const { result } = renderHook(() => useRescheduleBooking(), {
        wrapper: createWrapper(client),
      })

      await act(async () => {
        await result.current
          .mutateAsync({
            id: 'booking-1',
            start_time: '2025-05-02T11:00:00.000Z',
            end_time: '2025-05-02T12:00:00.000Z',
          })
          .catch(() => undefined)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
      expect(mockToastError).toHaveBeenCalledWith(SANITIZED_MESSAGE)
      expect(mockNotifyBooking).not.toHaveBeenCalled()
      expect(mockToastSuccess).not.toHaveBeenCalled()
    })
  })

  describe('useCancelBooking', () => {
    it('gère le chargement puis le succès, annule le booking avec raison et déclenche invalidations, notification et toast', async () => {
      const updateBuilder = createBuilder({
        singleResult: { data: CANCELLED_BOOKING, error: null },
      })

      mockFrom.mockReturnValueOnce(updateBuilder)

      const client = createTestQueryClient()
      const invalidateQueriesSpy = vi
        .spyOn(client, 'invalidateQueries')
        .mockResolvedValue(undefined)

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(client),
      })

      act(() => {
        result.current.mutate({ id: 'booking-2', reason: 'Client indisponible' })
      })

      await waitFor(() => {
        expect(result.current.isPending || result.current.isSuccess).toBe(true)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFrom).toHaveBeenCalledWith('bookings')
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'cancelled',
          cancelled_by: 'host',
          cancellation_reason: 'Client indisponible',
          cancelled_at: expect.any(String),
        })
      )
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'booking-2')
      expect(updateBuilder.select).toHaveBeenCalledWith('id')
      expect(updateBuilder.single).toHaveBeenCalledTimes(1)

      expect(result.current.data).toEqual({
        id: 'booking-2',
        reason: 'Client indisponible',
      })

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['upcoming-bookings'] })
      expect(mockNotifyBooking).toHaveBeenCalledWith('booking-2', 'cancelled', {
        reason: 'Client indisponible',
      })
      expect(mockToastSuccess).toHaveBeenCalledWith('RDV annulé — email envoyé au client')
      expect(mockToastError).not.toHaveBeenCalled()
    })

    it('passe en erreur si l’annulation échoue et affiche le message nettoyé', async () => {
      const updateBuilder = createBuilder({
        singleResult: { data: null, error: { message: 'x' } },
      })

      mockFrom.mockReturnValueOnce(updateBuilder)

      const client = createTestQueryClient()

      const { result } = renderHook(() => useCancelBooking(), {
        wrapper: createWrapper(client),
      })

      await act(async () => {
        await result.current
          .mutateAsync({ id: 'booking-2', reason: 'Client indisponible' })
          .catch(() => undefined)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
      expect(mockToastError).toHaveBeenCalledWith(SANITIZED_MESSAGE)
      expect(mockNotifyBooking).not.toHaveBeenCalled()
      expect(mockToastSuccess).not.toHaveBeenCalled()
    })
  })

  describe('useUpdateBookingGuestInfo', () => {
    it('gère le chargement puis le succès, n’envoie que les champs définis et déclenche invalidations, notification et toast', async () => {
      const updateBuilder = createBuilder({
        singleResult: { data: UPDATED_BOOKING, error: null },
      })

      mockFrom.mockReturnValueOnce(updateBuilder)

      const client = createTestQueryClient()
      const invalidateQueriesSpy = vi
        .spyOn(client, 'invalidateQueries')
        .mockResolvedValue(undefined)

      const { result } = renderHook(() => useUpdateBookingGuestInfo(), {
        wrapper: createWrapper(client),
      })

      const payload = {
        id: 'booking-3',
        guest_name: 'Alice Martin',
        guest_phone: null,
        guest_notes: 'Arriver 10 min avant',
      }

      await act(async () => {
        await result.current.mutateAsync(payload)
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFrom).toHaveBeenCalledWith('bookings')
      expect(updateBuilder.update).toHaveBeenCalledWith({
        guest_name: 'Alice Martin',
        guest_phone: null,
        guest_notes: 'Arriver 10 min avant',
      })
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'booking-3')
      expect(updateBuilder.select).toHaveBeenCalledWith('id')
      expect(updateBuilder.single).toHaveBeenCalledTimes(1)

      expect(result.current.data).toEqual(UPDATED_BOOKING)

      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] })
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['upcoming-bookings'] })
      expect(mockNotifyBooking).toHaveBeenCalledWith('booking-3', 'updated')
      expect(mockToastSuccess).toHaveBeenCalledWith('Infos mises à jour — email envoyé au client')
      expect(mockToastError).not.toHaveBeenCalled()
    })

    it('passe en erreur si la mise à jour des infos échoue et affiche le message nettoyé', async () => {
      const updateBuilder = createBuilder({
        singleResult: { data: null, error: { message: 'x' } },
      })

      mockFrom.mockReturnValueOnce(updateBuilder)

      const client = createTestQueryClient()

      const { result } = renderHook(() => useUpdateBookingGuestInfo(), {
        wrapper: createWrapper(client),
      })

      await act(async () => {
        await result.current
          .mutateAsync({
            id: 'booking-3',
            guest_email: 'a@b.c',
          })
          .catch(() => undefined)
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith({ message: 'x' })
      expect(mockToastError).toHaveBeenCalledWith(SANITIZED_MESSAGE)
      expect(mockNotifyBooking).not.toHaveBeenCalled()
      expect(mockToastSuccess).not.toHaveBeenCalled()
    })
  })
})
