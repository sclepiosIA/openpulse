import { createElement, type ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useSidePeek } from './useSidePeek'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper(initialEntries: string[] = ['/']) {
  const queryClient = createTestQueryClient()

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries }, children),
    )
  }
}

function usePeekWithLocation(paramKey?: string) {
  const peek = useSidePeek(paramKey)
  const location = useLocation()

  return { peek, location }
}

describe('useSidePeek', () => {
  it('starts closed when the configured URL parameter is absent', () => {
    const { result } = renderHook(() => usePeekWithLocation(), {
      wrapper: createWrapper(['/accounts?status=open&page=2']),
    })

    expect(result.current.peek.openId).toBeNull()
    expect(result.current.peek.isOpen).toBe(false)
    expect(result.current.location.pathname).toBe('/accounts')
    expect(new URLSearchParams(result.current.location.search).get('status')).toBe('open')
  })

  it('opens the side peek with the default peek parameter and preserves existing parameters', async () => {
    const { result } = renderHook(() => usePeekWithLocation(), {
      wrapper: createWrapper(['/accounts?status=open&page=2']),
    })

    await act(async () => {
      result.current.peek.open('row-42')
    })

    const params = new URLSearchParams(result.current.location.search)

    expect(result.current.peek.openId).toBe('row-42')
    expect(result.current.peek.isOpen).toBe(true)
    expect(params.get('peek')).toBe('row-42')
    expect(params.get('status')).toBe('open')
    expect(params.get('page')).toBe('2')
  })

  it('closes the side peek by removing only the default peek parameter', async () => {
    const { result } = renderHook(() => usePeekWithLocation(), {
      wrapper: createWrapper(['/accounts?peek=row-42&status=open&page=2']),
    })

    expect(result.current.peek.openId).toBe('row-42')
    expect(result.current.peek.isOpen).toBe(true)

    await act(async () => {
      result.current.peek.close()
    })

    const params = new URLSearchParams(result.current.location.search)

    expect(result.current.peek.openId).toBeNull()
    expect(result.current.peek.isOpen).toBe(false)
    expect(params.get('peek')).toBeNull()
    expect(params.get('status')).toBe('open')
    expect(params.get('page')).toBe('2')
  })

  it('closes the active side peek when Escape is pressed', async () => {
    const { result } = renderHook(() => usePeekWithLocation(), {
      wrapper: createWrapper(['/accounts?peek=row-42&status=open']),
    })

    expect(result.current.peek.openId).toBe('row-42')
    expect(result.current.peek.isOpen).toBe(true)

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    const params = new URLSearchParams(result.current.location.search)

    expect(result.current.peek.openId).toBeNull()
    expect(result.current.peek.isOpen).toBe(false)
    expect(params.get('peek')).toBeNull()
    expect(params.get('status')).toBe('open')
  })

  it('does not close the side peek for non-Escape key presses', async () => {
    const { result } = renderHook(() => usePeekWithLocation(), {
      wrapper: createWrapper(['/accounts?peek=row-42&status=open']),
    })

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })

    const params = new URLSearchParams(result.current.location.search)

    expect(result.current.peek.openId).toBe('row-42')
    expect(result.current.peek.isOpen).toBe(true)
    expect(params.get('peek')).toBe('row-42')
    expect(params.get('status')).toBe('open')
  })

  it('uses a custom parameter key without changing another side-peek scope', async () => {
    const { result } = renderHook(() => usePeekWithLocation('peek-prospect'), {
      wrapper: createWrapper(['/accounts?peek=main-1&peek-prospect=prospect-7&status=open']),
    })

    expect(result.current.peek.openId).toBe('prospect-7')
    expect(result.current.peek.isOpen).toBe(true)

    await act(async () => {
      result.current.peek.open('prospect-8')
    })

    let params = new URLSearchParams(result.current.location.search)

    expect(result.current.peek.openId).toBe('prospect-8')
    expect(result.current.peek.isOpen).toBe(true)
    expect(params.get('peek')).toBe('main-1')
    expect(params.get('peek-prospect')).toBe('prospect-8')
    expect(params.get('status')).toBe('open')

    await act(async () => {
      result.current.peek.close()
    })

    params = new URLSearchParams(result.current.location.search)

    expect(result.current.peek.openId).toBeNull()
    expect(result.current.peek.isOpen).toBe(false)
    expect(params.get('peek')).toBe('main-1')
    expect(params.get('peek-prospect')).toBeNull()
    expect(params.get('status')).toBe('open')
  })
})