import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  profileRef,
  invalidate,
  mockUsePulseUnreadCount,
  isPulseSoundEnabledMock,
  isPulseDesktopEnabledMock,
  playNotificationSoundMock,
  mockChannel,
  channelInstance,
  mockRemoveChannel,
  triggerInsert,
  NotificationInstances,
  MockNotification,
  setSoundEnabled,
  setDesktopEnabled,
} = vi.hoisted(() => {
  const profileRef = { current: { id: 'p1' } }

  const invalidate = vi.fn()

  const mockUsePulseUnreadCount = () => ({ invalidate })

  let soundEnabled = false
  let desktopEnabled = false
  const setSoundEnabled = (v: boolean) => {
    soundEnabled = v
  }
  const setDesktopEnabled = (v: boolean) => {
    desktopEnabled = v
  }

  const isPulseSoundEnabledMock = vi.fn(() => soundEnabled)
  const isPulseDesktopEnabledMock = vi.fn(() => desktopEnabled)

  const playNotificationSoundMock = vi.fn()

  let insertCb: ((payload: any) => void) | null = null
  const channelInstance = {
    on: vi.fn((event: string, _filter: any, cb: (payload: any) => void) => {
      if (event === 'postgres_changes') insertCb = cb
      return channelInstance
    }),
    subscribe: vi.fn(() => channelInstance),
  }
  const mockChannel = vi.fn((_name: string) => channelInstance)
  const mockRemoveChannel = vi.fn((_ch: any) => {})

  const triggerInsert = (newRec: any) => {
    if (insertCb) insertCb({ new: newRec })
  }

  const NotificationInstances: Array<{ title: string; options: any; instance: any }> = []
  function MockNotification(this: any, title: string, options: any) {
    this.title = title
    this.options = options
    this.onclick = null
    NotificationInstances.push({ title, options, instance: this })
    return this
  }
  ;(MockNotification as any).permission = 'granted'
  ;(MockNotification as any).requestPermission = vi.fn(() => Promise.resolve('granted'))

  return {
    profileRef,
    invalidate,
    mockUsePulseUnreadCount,
    isPulseSoundEnabledMock,
    isPulseDesktopEnabledMock,
    playNotificationSoundMock,
    mockChannel,
    channelInstance,
    mockRemoveChannel,
    triggerInsert,
    NotificationInstances,
    MockNotification: MockNotification as unknown as Notification,
    setSoundEnabled,
    setDesktopEnabled,
  }
})

vi.mock('@/integrations/supabase/client', () => {
  const fromBuilder = () => {
    const builder: any = {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: vi.fn(function (resolve: any) {
        resolve({ data: null, error: null })
        return Promise.resolve()
      }),
      catch: vi.fn(() => Promise.resolve()),
    }
    return builder
  }
  return {
    supabase: {
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
      from: vi.fn(fromBuilder),
    },
  }
})

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: vi.fn(() => ({ data: profileRef.current })),
}))

vi.mock('@/hooks/pulse/usePulseUnreadCount', () => ({
  usePulseUnreadCount: vi.fn(() => mockUsePulseUnreadCount()),
}))

vi.mock('@/lib/notificationSound', () => ({
  playNotificationSound: playNotificationSoundMock,
}))

vi.mock('@/lib/pulsePreferences', () => ({
  isPulseSoundEnabled: isPulseSoundEnabledMock,
  isPulseDesktopEnabled: isPulseDesktopEnabledMock,
}))

import { usePulseNewMessageNotifier } from './usePulseNewMessageNotifier'

describe('usePulseNewMessageNotifier', () => {
  const createWrapper = () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    })
    const Wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children as any)
    return Wrapper
  }

  beforeEach(() => {
    vi.useFakeTimers()
    ;(global as any).Notification = MockNotification
    ;(MockNotification as any).permission = 'granted'
    ;(MockNotification as any).requestPermission.mockClear?.()
    NotificationInstances.splice(0, NotificationInstances.length)

    setSoundEnabled(false)
    setDesktopEnabled(false)
    isPulseSoundEnabledMock.mockClear()
    isPulseDesktopEnabledMock.mockClear()
    playNotificationSoundMock.mockClear()

    mockChannel.mockClear()
    mockRemoveChannel.mockClear()
    channelInstance.on.mockClear()
    channelInstance.subscribe.mockClear()

    invalidate.mockClear()
    profileRef.current = { id: 'p1' }

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    })
  })

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers()
    })
    vi.useRealTimers()
  })

  it('does not subscribe when no profile id', () => {
    profileRef.current = null as any
    const wrapper = createWrapper()
    const { result, unmount } = renderHook(() => usePulseNewMessageNotifier(), { wrapper })

    expect(mockChannel).not.toHaveBeenCalled()
    expect(result.current.hasNewMessage).toBe(false)

    unmount()
    expect(mockRemoveChannel).not.toHaveBeenCalled()
  })

  it('subscribes with profile id and ignores self-message unless external', () => {
    const wrapper = createWrapper()
    const { result, unmount } = renderHook(() => usePulseNewMessageNotifier(), { wrapper })

    expect(mockChannel).toHaveBeenCalledWith(expect.stringMatching(/^pulse-new-msg-notifier-p1-/))
    expect(channelInstance.on).toHaveBeenCalled()

    act(() => {
      triggerInsert({ user_id: 'p1', metadata: {} })
    })
    expect(result.current.hasNewMessage).toBe(false)
    expect(invalidate).not.toHaveBeenCalled()
    expect(playNotificationSoundMock).not.toHaveBeenCalled()
    expect(NotificationInstances.length).toBe(0)

    act(() => {
      triggerInsert({ user_id: 'p1', metadata: { is_external_message: true } })
    })
    expect(result.current.hasNewMessage).toBe(true)
    expect(invalidate).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(result.current.hasNewMessage).toBe(true)
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(result.current.hasNewMessage).toBe(false)

    unmount()
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelInstance)
  })

  it('plays sound when preference enabled on external/new message', async () => {
    setSoundEnabled(true)
    const wrapper = createWrapper()
    const { result } = renderHook(() => usePulseNewMessageNotifier(), { wrapper })

    await act(async () => {
      triggerInsert({ user_id: 'u2', metadata: {} })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.hasNewMessage).toBe(true)
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(isPulseSoundEnabledMock).toHaveBeenCalled()
    expect(playNotificationSoundMock).toHaveBeenCalledTimes(1)
  })

  it('shows desktop notification when tab hidden and preference enabled with granted permission', async () => {
    setDesktopEnabled(true)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    ;(MockNotification as any).permission = 'granted'

    const wrapper = createWrapper()
    const { result } = renderHook(() => usePulseNewMessageNotifier(), { wrapper })

    await act(async () => {
      triggerInsert({ user_id: 'u2', metadata: {} })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.hasNewMessage).toBe(true)
    expect(NotificationInstances).toHaveLength(1)
    expect(isPulseDesktopEnabledMock).toHaveBeenCalled()
    expect(NotificationInstances[0]).toMatchObject({
      title: 'Nouveau message',
      options: {
        body: 'Nouveau message',
        icon: '/placeholder.svg',
        badge: '/placeholder.svg',
        tag: 'pulse-message',
      },
    })
  })

  it('requests desktop permission and shows notification when granted', async () => {
    setDesktopEnabled(true)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    ;(MockNotification as any).permission = 'default'
    ;(MockNotification as any).requestPermission.mockResolvedValueOnce('granted')

    const wrapper = createWrapper()
    const { result } = renderHook(() => usePulseNewMessageNotifier(), { wrapper })

    await act(async () => {
      triggerInsert({ user_id: 'u2', metadata: {} })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.hasNewMessage).toBe(true)
    expect((MockNotification as any).requestPermission).toHaveBeenCalledTimes(1)
    expect(NotificationInstances).toHaveLength(1)
  })

  it('clearPulse resets state and cancels pending auto-reset', () => {
    const wrapper = createWrapper()
    const { result } = renderHook(() => usePulseNewMessageNotifier(), { wrapper })

    act(() => {
      triggerInsert({ user_id: 'u2', metadata: {} })
    })
    expect(result.current.hasNewMessage).toBe(true)

    act(() => {
      result.current.clearPulse()
    })
    expect(result.current.hasNewMessage).toBe(false)

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(result.current.hasNewMessage).toBe(false)
  })
})
