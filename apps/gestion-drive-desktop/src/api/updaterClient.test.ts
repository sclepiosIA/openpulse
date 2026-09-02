import { beforeEach, describe, expect, it, vi } from 'vitest'

const downloadAndInstall = vi.fn()
const relaunch = vi.fn()
const check = vi.fn()
const getVersion = vi.fn()

vi.mock('@tauri-apps/plugin-updater', () => ({ check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion }))

import {
  checkForGestionDesktopUpdate,
  detectCompletedGestionDesktopUpdate,
  getGestionUpdateHistory,
  subscribeToGestionUpdateStatus,
} from './updaterClient'

describe('updaterClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    getVersion.mockResolvedValue('0.1.8')
    check.mockResolvedValue({ version: '0.1.8', downloadAndInstall })
    downloadAndInstall.mockImplementation(async (listener?: (event: unknown) => void) => {
      listener?.({ event: 'Started', data: { contentLength: 100 } })
      listener?.({ event: 'Progress', data: { chunkLength: 40 } })
      listener?.({ event: 'Progress', data: { chunkLength: 60 } })
      listener?.({ event: 'Finished', data: {} })
    })
    relaunch.mockResolvedValue(undefined)
  })

  it('affiche la progression puis relance le processus natif', async () => {
    const states: Array<{ stage: string; percent?: number | null }> = []
    const unsubscribe = subscribeToGestionUpdateStatus((state) => states.push(state))
    const result = await checkForGestionDesktopUpdate()
    unsubscribe()

    expect(result).toEqual({ status: 'installed', version: '0.1.8' })
    expect(downloadAndInstall).toHaveBeenCalledTimes(1)
    expect(relaunch).toHaveBeenCalledTimes(1)
    expect(states).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'checking' }),
        expect.objectContaining({ stage: 'available' }),
        expect.objectContaining({ stage: 'downloading', percent: 40 }),
        expect.objectContaining({ stage: 'downloading', percent: 100 }),
        expect.objectContaining({ stage: 'restarting' }),
      ])
    )
  })

  it('confirme la réussite après le redémarrage et conserve l’historique', async () => {
    await checkForGestionDesktopUpdate()
    const completed = await detectCompletedGestionDesktopUpdate()
    const history = await getGestionUpdateHistory()

    expect(completed).toMatchObject({
      stage: 'completed',
      version: '0.1.8',
      message: expect.stringContaining('succès'),
    })
    expect(history.currentVersion).toBe('0.1.8')
    expect(history.lastCompleted).toMatchObject({ version: '0.1.8' })
  })

  it('affiche une confirmation unique au premier lancement de cette version', async () => {
    const first = await detectCompletedGestionDesktopUpdate()
    const second = await detectCompletedGestionDesktopUpdate()
    expect(first).toMatchObject({
      stage: 'completed',
      version: '0.1.8',
      message: expect.stringContaining('installé et prêt'),
    })
    expect(second).toBeNull()
  })

  it('ne confirme pas une mise à jour si la version courante ne correspond pas', async () => {
    await checkForGestionDesktopUpdate()
    getVersion.mockResolvedValue('0.1.7')
    await expect(detectCompletedGestionDesktopUpdate()).resolves.toBeNull()
  })
})
