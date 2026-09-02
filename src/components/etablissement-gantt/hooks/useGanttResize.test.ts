/* @vitest-environment jsdom */

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGanttResize } from './useGanttResize'

const {
  AUTH_STATE,
  TASKS,
  TIMELINE,
  toastMock,
  mutateAsyncMock,
  debugErrorMock,
  mockFrom,
} = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  }

  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.gte.mockReturnValue(builder)
  builder.lte.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
  builder.upsert.mockReturnValue(builder)
  builder.single.mockResolvedValue({ data: null, error: null })
  builder.maybeSingle.mockResolvedValue({ data: null, error: null })
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled),
  )
  builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected),
  )

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    TASKS: [
      {
        id: 'task-1',
        date_debut: '2024-01-10',
        echeance: '2024-01-15',
        created_at: '2024-01-01',
      },
    ],
    TIMELINE: {
      start: new Date('2024-01-01'),
      pixelsPerDay: 10,
    },
    toastMock: vi.fn(),
    mutateAsyncMock: vi.fn(),
    debugErrorMock: vi.fn(),
    mockFrom: vi.fn(() => builder),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugErrorMock,
  },
}))

vi.mock('@/hooks/tasks/useTaches', () => ({
  useUpdateTache: () => ({
    mutateAsync: mutateAsyncMock,
    isLoading: false,
    isError: false,
    error: null,
  }),
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
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

function createContainer() {
  const container = document.createElement('div')
  Object.defineProperty(container, 'scrollLeft', {
    value: 0,
    writable: true,
    configurable: true,
  })
  container.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    right: 300,
    top: 0,
    bottom: 100,
    width: 300,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }))
  return container
}

describe('useGanttResize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  it('initialise sans resize actif', () => {
    const { result } = renderHook(() => useGanttResize(TIMELINE, TASKS), {
      wrapper: createWrapper(),
    })

    expect(result.current.isResizing).toBe(false)
    expect(result.current.resizingTask).toBeNull()
    expect(result.current.resizeDelta).toBe(0)
    expect(result.current.getResizePreview('task-1')).toBeNull()
  })

  it('passe en état de chargement visuel puis succès lors d’un resize à droite et persiste la nouvelle échéance', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: { id: 'task-1' }, error: null })

    const container = createContainer()
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const { result } = renderHook(() => useGanttResize(TIMELINE, TASKS), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.handleResizeStart('task-1', 'right', container, 100)
    })

    expect(result.current.isResizing).toBe(true)
    expect(result.current.resizingTask).toEqual({ id: 'task-1', handle: 'right' })
    expect(result.current.resizeDelta).toBe(0)
    expect(document.body.style.cursor).toBe('ew-resize')
    expect(document.body.style.userSelect).toBe('none')
    expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(result.current.getResizePreview('task-1')).toEqual({ left: 90, width: 50 })

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 130 }))
    })

    expect(result.current.resizeDelta).toBe(3)
    expect(result.current.getResizePreview('task-1')).toEqual({ left: 90, width: 80 })

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        id: 'task-1',
        data: { echeance: '2024-01-18' },
      })
    })

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Durée modifiée',
      description: 'Nouvelle durée : 8 jour(s)',
    })
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
    expect(result.current.isResizing).toBe(false)
    expect(result.current.resizingTask).toBeNull()
    expect(result.current.resizeDelta).toBe(0)
    expect(document.body.style.cursor).toBe('')
    expect(document.body.style.userSelect).toBe('')
  })

  it('met à jour date_debut lors d’un resize à gauche et calcule le preview réel', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: { id: 'task-1' }, error: null })

    const container = createContainer()

    const { result } = renderHook(() => useGanttResize(TIMELINE, TASKS), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.handleResizeStart('task-1', 'left', container, 100)
    })

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 80 }))
    })

    expect(result.current.resizeDelta).toBe(-2)
    expect(result.current.getResizePreview('task-1')).toEqual({ left: 70, width: 70 })

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        id: 'task-1',
        data: {
          date_debut: '2024-01-08',
          echeance: '2024-01-15',
        },
      })
    })

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Durée modifiée',
      description: 'Nouvelle durée : 7 jour(s)',
    })
  })

  it('gère l’erreur de mutation via un toast destructif et debug.error', async () => {
    const mutationError = new Error('x')
    mutateAsyncMock.mockRejectedValueOnce(mutationError)

    const container = createContainer()

    const { result } = renderHook(() => useGanttResize(TIMELINE, TASKS), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.handleResizeStart('task-1', 'right', container, 100)
    })

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 120 }))
    })

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    await waitFor(() => {
      expect(debugErrorMock).toHaveBeenCalledWith('Error resizing task:', mutationError)
    })

    expect(toastMock).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Impossible de modifier la durée',
      variant: 'destructive',
    })
    expect(result.current.isResizing).toBe(false)
    expect(result.current.resizeDelta).toBe(0)
  })

  it('refuse une durée inférieure à 1 jour et n’appelle pas la mutation', async () => {
    const container = createContainer()

    const { result } = renderHook(() => useGanttResize(TIMELINE, TASKS), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.handleResizeStart('task-1', 'left', container, 100)
    })

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }))
    })

    expect(result.current.resizeDelta).toBe(5)
    expect(result.current.getResizePreview('task-1')).toEqual({ left: 140, width: 10 })

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup'))
    })

    expect(mutateAsyncMock).not.toHaveBeenCalled()
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Durée minimale',
      description: 'La tâche doit durer au moins 1 jour',
      variant: 'destructive',
    })
    expect(result.current.isResizing).toBe(false)
    expect(result.current.resizingTask).toBeNull()
    expect(result.current.resizeDelta).toBe(0)
  })

  it('auto-scroll le conteneur proche des bords pendant le resize', () => {
    const container = createContainer()

    const { result } = renderHook(() => useGanttResize(TIMELINE, TASKS), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.handleResizeStart('task-1', 'right', container, 100)
    })

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 295 }))
    })

    expect(container.scrollLeft).toBe(12)

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 5 }))
    })

    expect(container.scrollLeft).toBe(0)
  })
})