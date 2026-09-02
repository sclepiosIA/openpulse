// Racine UI : charge la config Drive puis monte la PWA Gestion en plein écran.
// L'UI métier reste celle de la PWA ; le desktop ajoute tray, notifications et
// sync Drive en arrière-plan.

import { useEffect } from 'react'
import { useAppStore } from './state/store'
import { getConfig, getSavedSession } from './api/driveClient'
import {
  checkForGestionDesktopUpdate,
  detectCompletedGestionDesktopUpdate,
} from './api/updaterClient'
import { sendNotification } from './api/notificationsClient'
import GestionPwaApp from './apps/GestionPwaApp'

export default function App() {
  const setConfig = useAppStore((s) => s.setConfig)
  const setSession = useAppStore((s) => s.setSession)
  const setScreen = useAppStore((s) => s.setScreen)

  useEffect(() => {
    getConfig()
      .then((config) => {
        setConfig(config)
        return getSavedSession().then((session) => {
          if (session) {
            setSession(session)
            setScreen(config.sync_root ? 'spaces' : 'folder')
          }
        })
      })
      .catch(console.error)
    let updateId: number | undefined
    const completionId = window.setTimeout(() => {
      void detectCompletedGestionDesktopUpdate().then((state) => {
        if (state?.stage === 'completed') {
          void sendNotification('system', 'Gestion Desktop mise à jour', state.message)
          return
        }
        updateId = window.setTimeout(
          () => void checkForGestionDesktopUpdate({ silent: true }),
          2_750
        )
      })
    }, 250)
    return () => {
      window.clearTimeout(completionId)
      window.clearTimeout(updateId)
    }
  }, [setConfig, setSession, setScreen])

  return <GestionPwaApp />
}
