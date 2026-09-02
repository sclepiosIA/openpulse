import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const tauriEvents = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload: unknown }) => void>(),
  listen: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({ listen: tauriEvents.listen }))

import GestionPwaApp, {
  DRIVE_AUTH_RESPONSE_TIMEOUT_MS,
  pwaTargetOrigin,
} from './GestionPwaApp'
import { useAppStore } from '../state/store'
import * as notificationsClientApi from '../api/notificationsClient'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  cleanup()
  tauriEvents.listeners.clear()
  tauriEvents.listen.mockReset()
  tauriEvents.listen.mockImplementation(
    async (name: string, listener: (event: { payload: unknown }) => void) => {
      tauriEvents.listeners.set(name, listener)
      return () => tauriEvents.listeners.delete(name)
    }
  )
  useAppStore.setState({
    activeApp: 'drive',
    screen: 'login',
    panelOpen: false,
    session: null,
    config: null,
    spaces: [],
    selectedSpaceIds: [],
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
})

it('annule le timeout de handoff au démontage', async () => {
  vi.useFakeTimers()
  const timeoutSpy = vi.spyOn(window, 'setTimeout')
  const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')
  const preferences = await notificationsClientApi.getPreferences()
  vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
    ...preferences,
    drive_auto_connect: true,
  })
  const { unmount } = render(<GestionPwaApp />)
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  const frame = screen.getByTitle('Gestion') as HTMLIFrameElement
  const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
  fireEvent.load(frame)
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: pwaTargetOrigin(frame.src),
      source: frame.contentWindow,
      data: { type: 'gestion-desktop-drive-auth-status', status: 'authenticated' },
    })
  )
  expect(
    postMessage.mock.calls.filter(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )
  ).toHaveLength(1)
  const authTimerIndex = timeoutSpy.mock.calls.findIndex(
    ([, delay]) => delay === DRIVE_AUTH_RESPONSE_TIMEOUT_MS
  )
  expect(authTimerIndex).toBeGreaterThanOrEqual(0)
  const authTimer = timeoutSpy.mock.results[authTimerIndex].value

  unmount()

  expect(clearTimeoutSpy).toHaveBeenCalledWith(authTimer)
})

it('annule le handoff avant de remplacer l’iframe via la commande native de reload', async () => {
  vi.useFakeTimers()
  const preferences = await notificationsClientApi.getPreferences()
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })
  vi.spyOn(notificationsClientApi, 'getPreferences').mockResolvedValue({
    ...preferences,
    drive_auto_connect: true,
  })
  render(<GestionPwaApp />)
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  const reload = tauriEvents.listeners.get('gestion://reload')
  expect(reload).toBeDefined()
  const frame = screen.getByTitle('Gestion') as HTMLIFrameElement
  const firstPostMessage = vi.spyOn(frame.contentWindow!, 'postMessage')
  fireEvent.load(frame)
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: pwaTargetOrigin(frame.src),
      source: frame.contentWindow,
      data: { type: 'gestion-desktop-drive-auth-status', status: 'authenticated' },
    })
  )
  expect(
    firstPostMessage.mock.calls.filter(
      ([payload]) => (payload as { type?: string }).type === 'gestion-desktop-drive-auth-request'
    )
  ).toHaveLength(1)

  act(() => reload?.({ payload: undefined }))
  const replacementFrame = screen.getByTitle('Gestion') as HTMLIFrameElement
  expect(replacementFrame).not.toBe(frame)
  const replacementPostMessage = vi.spyOn(replacementFrame.contentWindow!, 'postMessage')
  await act(async () => {
    vi.advanceTimersByTime(DRIVE_AUTH_RESPONSE_TIMEOUT_MS + 1)
  })

  expect(replacementPostMessage).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'gestion-desktop-drive-auth-request' }),
    expect.any(String)
  )
})
