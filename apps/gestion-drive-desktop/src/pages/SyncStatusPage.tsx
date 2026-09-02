// Écran 4 — État de synchronisation (statut agrégé + progression pull/push).

import { useEffect, useState } from 'react'
import {
  clearSyncLogs,
  exportSyncLogs,
  getPullProgress,
  getPushProgress,
  getSyncLogs,
  getSyncStatus,
  logout,
  runPullSync,
  runPushSync,
} from '../api/driveClient'
import type { PullProgress, PushProgress, SyncLogEntry, SyncStatus } from '../api/types'
import { useAppStore } from '../state/store'

const STATE_LABELS: Record<SyncStatus['state'], string> = {
  idle: 'Synchronisé ✓',
  syncing: 'Synchronisation…',
  paused: 'En pause',
  error: 'Erreurs de synchronisation',
  offline: 'Hors ligne',
}

const PHASE_LABELS: Record<PullProgress['phase'], string> = {
  idle: 'En attente',
  listing: 'Lecture des espaces…',
  downloading: 'Téléchargement…',
  done: 'Terminé ✓',
  error: 'Erreur',
}

const PUSH_PHASE_LABELS: Record<PushProgress['phase'], string> = {
  idle: 'En attente',
  scanning: 'Analyse du dossier local…',
  uploading: 'Envoi vers Gestion Drive…',
  done: 'Terminé ✓',
  error: 'Erreur',
}

const LOG_LEVEL_LABELS: Record<SyncLogEntry['level'], string> = {
  info: 'Info',
  warn: 'Alerte',
  error: 'Erreur',
}

function formatLogTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '—'
  return new Date(ts * 1000).toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

export default function SyncStatusPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [pull, setPull] = useState<PullProgress | null>(null)
  const [push, setPush] = useState<PushProgress | null>(null)
  const [logs, setLogs] = useState<SyncLogEntry[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [exportedLogPath, setExportedLogPath] = useState<string | null>(null)
  const setScreen = useAppStore((s) => s.setScreen)
  const reset = useAppStore((s) => s.reset)
  const config = useAppStore((s) => s.config)

  const pullActive = pull?.running ?? false
  const pushActive = push?.running ?? false
  const anyActive = pullActive || pushActive

  useEffect(() => {
    let alive = true
    const tick = () => {
      getSyncStatus()
        .then((s) => alive && setStatus(s))
        .catch(console.error)
      getPullProgress()
        .then((p) => alive && setPull(p))
        .catch(console.error)
      getPushProgress()
        .then((p) => alive && setPush(p))
        .catch(console.error)
      getSyncLogs(6)
        .then((l) => alive && setLogs(l))
        .catch(console.error)
    }
    tick()
    // Poll rapide pendant une sync active, sinon toutes les 5 s.
    const id = setInterval(tick, anyActive ? 1000 : 5000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [anyActive])

  async function onSyncNow() {
    setActionError(null)
    setExportedLogPath(null)
    try {
      await runPullSync()
      setLogs(await getSyncLogs(6))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onSendNow() {
    setActionError(null)
    setExportedLogPath(null)
    try {
      await runPushSync()
      setLogs(await getSyncLogs(6))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onExportLogs() {
    setActionError(null)
    try {
      setExportedLogPath(await exportSyncLogs())
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onClearLogs() {
    setActionError(null)
    setExportedLogPath(null)
    try {
      await clearSyncLogs()
      setLogs([])
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    }
  }

  const globalState: SyncStatus['state'] = anyActive ? 'syncing' : (status?.state ?? 'idle')
  const pct =
    pull && pull.total_files > 0
      ? Math.min(100, Math.round((pull.processed_files / pull.total_files) * 100))
      : null
  const authExpired = [pull?.last_error, push?.last_error, actionError, ...logs.map((l) => l.message)]
    .filter(Boolean)
    .some((msg) => String(msg).includes('401') || String(msg).toLowerCase().includes('session expirée'))

  return (
    <section className="card">
      <h1>Synchronisation</h1>
      {status ? (
        <>
          <p className={`sync-state sync-${globalState}`}>{STATE_LABELS[globalState]}</p>
          {pull && (pullActive || pull.phase === 'done' || pull.phase === 'error') && (
            <div className="pull-progress">
              <p className="muted">
                Réception : {PHASE_LABELS[pull.phase]}
                {pull.current_space ? ` — ${pull.current_space}` : ''}
                {pct !== null ? ` (${pull.processed_files}/${pull.total_files} — ${pct} %)` : ''}
              </p>
              {pullActive && pull.current_file && (
                <p className="muted">
                  <code>{pull.current_file}</code>
                </p>
              )}
              {!pullActive && pull.phase === 'done' && (
                <p className="muted">
                  {pull.downloaded_files} téléchargé(s), {pull.skipped_files} déjà à jour
                  {pull.failed_files > 0 ? `, ${pull.failed_files} échec(s)` : ''}
                </p>
              )}
              {pull.last_error && (
                <div className="error" role="alert">
                  {pull.last_error}
                </div>
              )}
            </div>
          )}
          {push && (pushActive || push.phase === 'done' || push.phase === 'error') && (
            <div className="push-progress">
              <p className="muted">
                Envoi : {PUSH_PHASE_LABELS[push.phase]}
                {pushActive && push.phase === 'scanning'
                  ? ` (${push.scanned_files} fichier(s) analysé(s))`
                  : ''}
              </p>
              {!pushActive && (push.phase === 'done' || push.phase === 'error') && (
                <p className="muted">
                  {push.uploaded_files} envoyé(s), {push.noop_files} déjà connu(s)
                  {push.conflict_files > 0 ? `, ${push.conflict_files} conflit(s)` : ''}
                  {push.rescheduled_files > 0
                    ? `, ${push.rescheduled_files} nouvel essai planifié`
                    : ''}
                  {push.failed_files > 0 ? `, ${push.failed_files} échec(s)` : ''}
                  {push.pending_ops > 0 ? ` — ${push.pending_ops} en attente` : ''}
                </p>
              )}
              {push.last_error && (
                <div className="error" role="alert">
                  {push.last_error}
                </div>
              )}
            </div>
          )}
          {authExpired && (
            <div className="error" role="alert">
              Session Drive expirée. Reconnectez-vous pour relancer la synchronisation.
              <div className="actions compact-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    void logout()
                    reset()
                    setScreen('login')
                  }}
                >
                  Se reconnecter
                </button>
              </div>
            </div>
          )}
          {actionError && (
            <div className="error" role="alert">
              {actionError}
            </div>
          )}
          <dl className="stats">
            <div>
              <dt>À envoyer</dt>
              <dd>{status.pending_uploads}</dd>
            </div>
            <div>
              <dt>À recevoir</dt>
              <dd>{status.pending_downloads}</dd>
            </div>
            <div>
              <dt>Conflits</dt>
              <dd>{status.conflicts}</dd>
            </div>
            <div>
              <dt>Erreurs</dt>
              <dd>{status.errors}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p>Lecture de l'état…</p>
      )}
      {config?.sync_root && (
        <p className="muted">
          Dossier : <code>{config.sync_root}</code>
        </p>
      )}
      <section className="sync-diagnostics" aria-labelledby="sync-diagnostics-title">
        <div className="section-heading">
          <h2 id="sync-diagnostics-title">Diagnostic sync</h2>
          <span className="muted">Journal local exportable pour support</span>
        </div>
        {logs.length > 0 ? (
          <ol className="sync-log-list" aria-label="Derniers événements de synchronisation">
            {logs.map((entry, index) => (
              <li
                key={`${entry.ts}-${entry.scope}-${index}`}
                className={`sync-log sync-log-${entry.level}`}
              >
                <span className="sync-log-meta">
                  {formatLogTime(entry.ts)} · {LOG_LEVEL_LABELS[entry.level]} · {entry.scope}
                </span>
                <span>{entry.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">
            Aucun événement récent. Lancez une synchronisation pour alimenter le diagnostic.
          </p>
        )}
        {exportedLogPath && (
          <p className="success" role="status">
            Journal exporté : <code>{exportedLogPath}</code>
          </p>
        )}
        <div className="actions compact-actions">
          <button type="button" className="secondary" onClick={onExportLogs}>
            Exporter le journal
          </button>
          <button type="button" className="secondary" onClick={onClearLogs}>
            Vider
          </button>
        </div>
      </section>
      <div className="actions">
        <button onClick={onSyncNow} disabled={anyActive}>
          {pullActive ? 'Synchronisation…' : 'Synchroniser maintenant'}
        </button>
        <button onClick={onSendNow} disabled={anyActive}>
          {pushActive ? 'Envoi…' : 'Envoyer les modifications'}
        </button>
        <button className="secondary" onClick={() => setScreen('files')}>
          Fichiers locaux
        </button>
        <button className="secondary" onClick={() => setScreen('settings')}>
          Paramètres
        </button>
      </div>
    </section>
  )
}
