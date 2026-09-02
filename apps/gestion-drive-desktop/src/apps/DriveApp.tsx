// Module Drive : encapsule l'onboarding et le suivi de synchronisation
// existants (login → dossier → espaces → statut → paramètres).
// La logique des pages est inchangée ; seul le montage a été déplacé
// depuis l'ancienne racine App.tsx vers ce module du shell.

import { useAppStore } from '../state/store'
import LoginPage from '../pages/LoginPage'
import FolderPickerPage from '../pages/FolderPickerPage'
import SpacesPage from '../pages/SpacesPage'
import SyncStatusPage from '../pages/SyncStatusPage'
import SettingsPage from '../pages/SettingsPage'
import FilesPage from '../pages/FilesPage'

interface DriveAppProps {
  onUseGestionSession?: () => Promise<void>
}

export default function DriveApp({ onUseGestionSession }: DriveAppProps) {
  const screen = useAppStore((s) => s.screen)
  const reconnectWithGestionSession: () => Promise<void> =
    onUseGestionSession ??
    (async () => {
      throw new Error('La session Gestion embarquée n’est pas disponible ici.')
    })

  return (
    <div className="module module-drive">
      {screen === 'login' && <LoginPage onUseGestionSession={reconnectWithGestionSession} />}
      {screen === 'folder' && <FolderPickerPage />}
      {screen === 'spaces' && <SpacesPage />}
      {screen === 'status' && <SyncStatusPage />}
      {screen === 'files' && <FilesPage />}
      {screen === 'settings' && <SettingsPage />}
    </div>
  )
}
