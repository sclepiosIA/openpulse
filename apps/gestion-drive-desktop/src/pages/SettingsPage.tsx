// Écran 5 — Paramètres (lecture seule pour l'instant) + déconnexion.

import { logout } from '../api/driveClient'
import { useAppStore } from '../state/store'

export default function SettingsPage() {
  const config = useAppStore((s) => s.config)
  const session = useAppStore((s) => s.session)
  const setScreen = useAppStore((s) => s.setScreen)
  const reset = useAppStore((s) => s.reset)

  async function onLogout() {
    await logout()
    reset()
  }

  return (
    <section className="card">
      <h1>Paramètres</h1>
      <dl className="settings-list">
        <div>
          <dt>Compte</dt>
          <dd>{session?.user_email ?? '—'}</dd>
        </div>
        <div>
          <dt>Appareil</dt>
          <dd>{config?.device_name ?? '—'}</dd>
        </div>
        <div>
          <dt>Dossier synchronisé</dt>
          <dd>
            <code>{config?.sync_root ?? 'non défini'}</code>
          </dd>
        </div>
        <div>
          <dt>API</dt>
          <dd>
            <code>{config?.api_base_url ?? '—'}</code>
          </dd>
        </div>
        <div>
          <dt>Intervalle de synchronisation</dt>
          <dd>{config ? `${config.poll_interval_secs} s` : '—'}</dd>
        </div>
      </dl>
      <div className="actions">
        <button className="secondary" onClick={() => setScreen('files')}>
          Fichiers locaux
        </button>
        <button onClick={() => setScreen('status')}>Retour</button>
        <button className="danger" onClick={onLogout}>
          Se déconnecter
        </button>
      </div>
    </section>
  )
}
