// @vitest-environment jsdom

import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOnlineStatus } from './useOnlineStatus'

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

describe('useOnlineStatus', () => {
  it('returns the initial online status from navigator.onLine when true', () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })

    const { result } = renderHook(() => useOnlineStatus(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBe(true)

    if (original) {
      Object.defineProperty(window.navigator, 'onLine', original)
    }
  })

  it('returns the initial online status from navigator.onLine when false', () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })

    const { result } = renderHook(() => useOnlineStatus(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBe(false)

    if (original) {
      Object.defineProperty(window.navigator, 'onLine', original)
    }
  })

  it('updates to true when the online event is dispatched', async () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => false,
    })

    const { result } = renderHook(() => useOnlineStatus(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBe(false)

    await act(async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => true,
      })
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })

    if (original) {
      Object.defineProperty(window.navigator, 'onLine', original)
    }
  })

  it('updates to false when the offline event is dispatched', async () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })

    const { result } = renderHook(() => useOnlineStatus(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBe(true)

    await act(async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      })
      window.dispatchEvent(new Event('offline'))
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })

    if (original) {
      Object.defineProperty(window.navigator, 'onLine', original)
    }
  })

  it('registers and unregisters online/offline event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOnlineStatus(), {
      wrapper: createWrapper(),
    })

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    const onlineHandlerCall = addEventListenerSpy.mock.calls.find((call) => call[0] === 'online')
    const offlineHandlerCall = addEventListenerSpy.mock.calls.find((call) => call[0] === 'offline')

    expect(onlineHandlerCall?.[1]).toEqual(expect.any(Function))
    expect(offlineHandlerCall?.[1]).toEqual(expect.any(Function))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', onlineHandlerCall?.[1])
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', offlineHandlerCall?.[1])

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('stops reacting to events after unmount', async () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    })

    const { result, unmount } = renderHook(() => useOnlineStatus(), {
      wrapper: createWrapper(),
    })

    expect(result.current).toBe(true)

    unmount()

    await act(async () => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      })
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(true)

    if (original) {
      Object.defineProperty(window.navigator, 'onLine', original)
    }
  })
})
