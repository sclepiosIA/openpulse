// Module Préférences du shell Gestion Desktop.
// Compte/appareil/dossier (lecture) + préférences locales de phase 2 :
// notifications par module (Pulse/Mail/Todo/Drive), mode ne pas déranger
// (manuel + plage horaire), démarrage au login, intervalle de polling.

import { useEffect, useState } from 'react'
import { logout, resetPwaSession } from '../api/driveClient'
import { checkForGestionDesktopUpdate, getGestionUpdateHistory } from '../api/updaterClient'
import type { UpdateHistory } from '../api/updaterClient'
import {
  getPreferences,
  setPreferences,
  sendNotification,
  minutesToTime,
  timeToMinutes,
  MODULE_LABELS,
} from '../api/notificationsClient'
import type { AppPreferences } from '../api/notificationsClient'
import { useAppStore } from '../state/store'

const MODULE_IDS = ['pulse', 'mail', 'todo', 'drive'] as const

export default function PreferencesApp() {
  const config = useAppStore((s) => s.config)
  const session = useAppStore((s) => s.session)
  const reset = useAppStore((s) => s.reset)
  const setActiveApp = useAppStore((s) => s.setActiveApp)

  const [prefs, setPrefs] = useState<AppPreferences | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testSent, setTestSent] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)
  const [updateHistory, setUpdateHistory] = useState<UpdateHistory | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  const loadPrefs = () => {
    setLoadError(null)
    getPreferences()
      .then(setPrefs)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }

  useEffect(() => {
    loadPrefs()
    void getGestionUpdateHistory().then(setUpdateHistory)
  }, [])

  /** Applique une mutation locale puis persiste (optimiste, avec rollback). */
  async function update(mutate: (draft: AppPreferences) => void) {
    if (!prefs) return
    const draft = structuredClone(prefs)
    mutate(draft)
    setPrefs(draft)
    setSaveError(null)
    try {
      const saved = await setPreferences(draft)
      setPrefs(saved)
    } catch (e) {
      setPrefs(prefs) // rollback
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onTestNotification() {
    setTestSent(false)
    try {
      await sendNotification(
        'system',
        'Notification de test',
        'Les notifications de Gestion Desktop fonctionnent.'
      )
      setTestSent(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onCheckUpdate() {
    setCheckingUpdate(true)
    setUpdateStatus('Recherche de mise à jour…')
    try {
      const result = await checkForGestionDesktopUpdate()
      if (result.status === 'up-to-date') setUpdateStatus('Gestion Desktop est déjà à jour.')
      else if (result.status === 'available')
        setUpdateStatus(`Mise à jour ${result.version} disponible.`)
      else if (result.status === 'installed')
        setUpdateStatus(`Mise à jour ${result.version} installée. Redémarrage…`)
      else if (result.status === 'unavailable')
        setUpdateStatus('Recherche disponible uniquement dans l’app installée.')
      else if (result.status === 'error')
        setUpdateStatus(`Erreur de mise à jour : ${result.message}`)
      setUpdateHistory(await getGestionUpdateHistory())
    } finally {
      setCheckingUpdate(false)
    }
  }

  async function onLogout() {
    setSaveError(null)
    try {
      await logout()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      // La purge native est best-effort mais le tombstone et l'état UI doivent
      // rester déconnectés même si l'écriture disque a signalé une erreur.
      reset()
      setActiveApp('drive')
    }
  }

  async function onResetPwaSession() {
    setSaveError(null)
    try {
      await resetPwaSession()
      reset()
      setActiveApp('drive')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <section className="card">
      <h1>Préférences</h1>

      <h2 className="prefs-section-title">Compte</h2>
      <dl className="settings-list">
        <div>
          <dt>Compte</dt>
          <dd>{session?.user_email ?? 'non connecté'}</dd>
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
      </dl>

      {saveError && (
        <div className="error" role="alert">
          {saveError}
        </div>
      )}

      {prefs ? (
        <>
          <h2 className="prefs-section-title">Notifications par module</h2>
          <div className="prefs-toggle-list">
            {MODULE_IDS.map((id) => (
              <label key={id} className="prefs-toggle">
                <input
                  type="checkbox"
                  checked={prefs.notifications[id]}
                  onChange={(e) =>
                    update((d) => {
                      d.notifications[id] = e.target.checked
                    })
                  }
                />
                <span>Notifications {MODULE_LABELS[id]}</span>
              </label>
            ))}
          </div>

          <h2 className="prefs-section-title">Ne pas déranger</h2>
          <div className="prefs-toggle-list">
            <label className="prefs-toggle">
              <input
                type="checkbox"
                checked={prefs.do_not_disturb.enabled}
                onChange={(e) =>
                  update((d) => {
                    d.do_not_disturb.enabled = e.target.checked
                  })
                }
              />
              <span>Activer le mode ne pas déranger</span>
            </label>
            <label className="prefs-toggle">
              <input
                type="checkbox"
                checked={prefs.do_not_disturb.schedule_enabled}
                onChange={(e) =>
                  update((d) => {
                    d.do_not_disturb.schedule_enabled = e.target.checked
                  })
                }
              />
              <span>Plage silencieuse programmée</span>
            </label>
            {prefs.do_not_disturb.schedule_enabled && (
              <div className="prefs-schedule">
                <label>
                  De
                  <input
                    type="time"
                    value={minutesToTime(prefs.do_not_disturb.start_minutes)}
                    onChange={(e) =>
                      update((d) => {
                        d.do_not_disturb.start_minutes = timeToMinutes(e.target.value)
                      })
                    }
                  />
                </label>
                <label>
                  à
                  <input
                    type="time"
                    value={minutesToTime(prefs.do_not_disturb.end_minutes)}
                    onChange={(e) =>
                      update((d) => {
                        d.do_not_disturb.end_minutes = timeToMinutes(e.target.value)
                      })
                    }
                  />
                </label>
              </div>
            )}
            <p className="muted">
              Pendant le mode ne pas déranger, les notifications restent visibles dans le centre de
              notifications mais ne s'affichent pas à l'écran.
            </p>
          </div>

          <h2 className="prefs-section-title">Application</h2>
          <dl className="settings-list update-history">
            <div>
              <dt>Version installée</dt>
              <dd>
                <strong>{updateHistory?.currentVersion ?? '—'}</strong>
              </dd>
            </div>
            <div>
              <dt>Dernière mise à jour réussie</dt>
              <dd>
                {updateHistory?.lastCompleted
                  ? `Version ${updateHistory.lastCompleted.version} · ${new Date(updateHistory.lastCompleted.completedAt).toLocaleString('fr-FR')}`
                  : 'Aucune mise à jour OTA enregistrée'}
              </dd>
            </div>
          </dl>
          <div className="prefs-toggle-list">
            <label className="prefs-toggle">
              <input
                type="checkbox"
                checked={prefs.launch_at_login}
                onChange={(e) =>
                  update((d) => {
                    d.launch_at_login = e.target.checked
                  })
                }
              />
              <span>Démarrer Gestion Desktop à l'ouverture de session</span>
            </label>
            <label className="prefs-toggle prefs-inline">
              <span>Synchroniser Drive toutes les</span>
              <input
                type="number"
                min={5}
                max={3600}
                value={prefs.poll_interval_secs}
                onChange={(e) =>
                  update((d) => {
                    d.poll_interval_secs = Number(e.target.value) || 60
                  })
                }
              />
              <span>secondes</span>
            </label>
          </div>

          <div className="actions">
            <button className="secondary" onClick={onTestNotification}>
              Envoyer une notification de test
            </button>
            <button
              className="secondary"
              type="button"
              disabled={checkingUpdate}
              onClick={() => void onCheckUpdate()}
            >
              {checkingUpdate ? 'Vérification…' : 'Rechercher une mise à jour'}
            </button>
            {testSent && <span className="muted">Notification envoyée ✓</span>}
            {updateStatus && <span className="muted">{updateStatus}</span>}
          </div>
        </>
      ) : loadError ? (
        <div className="error" role="alert">
          Impossible de charger les préférences : {loadError}
          <div className="actions" style={{ marginTop: '0.6rem' }}>
            <button className="secondary" type="button" onClick={loadPrefs}>
              Réessayer
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Chargement des préférences…</p>
      )}

      {session && (
        <div className="actions">
          <button className="danger" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      )}

      <h2 className="prefs-section-title">Session PWA</h2>
      <p className="muted">
        Réinitialise les cookies, le cache et le stockage local de Gestion web dans l'app desktop,
        sans supprimer les fichiers Drive locaux ni les préférences de sync.
      </p>
      <div className="actions">
        <button className="danger" type="button" onClick={onResetPwaSession}>
          Réinitialiser session PWA
        </button>
      </div>
    </section>
  )
}
