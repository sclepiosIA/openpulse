import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOfflineStatus } from '../useOfflineStatus'

describe('useOfflineStatus', () => {
  it('returns isOnline true by default in jsdom', () => {
    const { result } = renderHook(() => useOfflineStatus())
    expect(result.current.isOnline).toBe(true)
    expect(result.current.isOffline).toBe(false)
    expect(result.current.wasOffline).toBe(false)
  })

  it('reacts to offline event', () => {
    const { result } = renderHook(() => useOfflineStatus())
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.isOnline).toBe(false)
    expect(result.current.isOffline).toBe(true)
    expect(result.current.wasOffline).toBe(true)
  })

  it('reacts to online event after offline (clears wasOffline)', () => {
    const { result } = renderHook(() => useOfflineStatus())
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current.isOnline).toBe(true)
    expect(result.current.isOffline).toBe(false)
  })
})
