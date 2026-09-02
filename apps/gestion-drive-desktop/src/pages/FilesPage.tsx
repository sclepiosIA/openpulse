// Écran Drive — fichiers locaux indexés + actions contextuelles OneDrive-like.

import { useEffect, useMemo, useState } from 'react'
import {
  copyDriveLink,
  downloadFile,
  evictFile,
  getLocalFiles,
  openInGestion,
  pinFile,
  revealInFileManager,
  runPullSync,
  unpinFile,
} from '../api/driveClient'
import type { FileAction, FileEntry, PinState, SyncState } from '../api/types'
import { useAppStore } from '../state/store'

const ACTION_LABELS: Record<FileAction, string> = {
  copy_link: 'Copier le lien',
  open_in_gestion: 'Ouvrir dans Gestion',
  reveal_in_file_manager: 'Révéler',
  download: 'Télécharger',
  keep_local: 'Toujours garder local',
  unpin: "Retirer l'épinglage",
  free_space: "Libérer l'espace",
}

const SYNC_LABELS: Record<SyncState, string> = {
  idle: 'Synchronisé',
  pending_upload: 'À envoyer',
  pending_download: 'À recevoir',
  uploading: 'Envoi…',
  downloading: 'Réception…',
  conflict: 'Conflit',
  error: 'Erreur',
  ignored: 'Ignoré',
}

const PIN_LABELS: Record<PinState, string> = {
  pinned: 'Gardé localement',
  unpinned: 'Local évictable',
  evicted: 'Cloud-only',
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyPath, setBusyPath] = useState<string | null>(null)
  const setScreen = useAppStore((s) => s.setScreen)

  const totals = useMemo(
    () => ({
      cloudOnly: files.filter((f) => f.pin_state === 'evicted').length,
      conflicts: files.filter((f) => f.sync_state === 'conflict').length,
      pending: files.filter((f) => f.sync_state.startsWith('pending_')).length,
    }),
    [files]
  )

  async function refresh() {
    setLoading(true)
    setActionError(null)
    try {
      setFiles(await getLocalFiles(200))
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function runAction(file: FileEntry, action: FileAction) {
    setActionError(null)
    setActionMessage(null)
    setBusyPath(file.local_path)
    try {
      if (action === 'copy_link') {
        const url = await copyDriveLink(file.local_path)
        setActionMessage(`Lien copié : ${url}`)
      } else if (action === 'open_in_gestion') {
        await openInGestion(file.local_path)
        setActionMessage('Ouverture Gestion demandée.')
      } else if (action === 'reveal_in_file_manager') {
        await revealInFileManager(file.local_path)
        setActionMessage('Ouverture du gestionnaire de fichiers demandée.')
      } else if (action === 'keep_local') {
        const result = await pinFile(file.local_path)
        if (result.needs_download) {
          await runPullSync()
          setActionMessage('Fichier épinglé : téléchargement relancé en arrière-plan.')
        } else {
          setActionMessage('Fichier marqué “toujours garder local”.')
        }
        await refresh()
      } else if (action === 'download') {
        await downloadFile(file.local_path)
        await runPullSync()
        setActionMessage('Téléchargement relancé : le fichier restera évictable.')
        await refresh()
      } else if (action === 'unpin') {
        await unpinFile(file.local_path)
        setActionMessage('Épinglage retiré : le fichier redevient évictable.')
        await refresh()
      } else if (action === 'free_space') {
        const result = await evictFile(file.local_path)
        setActionMessage(`${formatBytes(result.freed_bytes)} libérés localement.`)
        await refresh()
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyPath(null)
    }
  }

  return (
    <section className="card files-card">
      <div className="section-heading">
        <div>
          <h1>Fichiers Drive locaux</h1>
          <p className="muted">
            Actions contextuelles dans l’app : lien, ouverture Gestion, révélation, garder
            localement et libérer l’espace.
          </p>
        </div>
        <button type="button" className="secondary" onClick={() => setScreen('status')}>
          Diagnostic sync
        </button>
      </div>

      <dl className="stats compact-stats" aria-label="Résumé fichiers locaux">
        <div>
          <dt>Fichiers</dt>
          <dd>{files.length}</dd>
        </div>
        <div>
          <dt>Cloud-only</dt>
          <dd>{totals.cloudOnly}</dd>
        </div>
        <div>
          <dt>À traiter</dt>
          <dd>{totals.pending}</dd>
        </div>
        <div>
          <dt>Conflits</dt>
          <dd>{totals.conflicts}</dd>
        </div>
      </dl>

      {actionMessage && (
        <p className="success" role="status">
          {actionMessage}
        </p>
      )}
      {actionError && (
        <div className="error" role="alert">
          {actionError}
        </div>
      )}

      <div className="actions compact-actions">
        <button type="button" onClick={refresh} disabled={loading}>
          {loading ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {loading ? (
        <p className="muted">Lecture de l’index local…</p>
      ) : files.length === 0 ? (
        <p className="muted">
          Aucun fichier indexé. Lancez une synchronisation ou envoyez un fichier local depuis le
          dossier Gestion Drive.
        </p>
      ) : (
        <ul className="files-list" aria-label="Fichiers Drive locaux">
          {files.map((file) => (
            <li key={file.local_path} className="file-row">
              <div className="file-main">
                <strong>{fileName(file.local_path)}</strong>
                <code>{file.local_path}</code>
              </div>
              <div className="file-meta">
                <span>{formatBytes(file.size_bytes)}</span>
                <span className={`pill sync-${file.sync_state}`}>
                  {SYNC_LABELS[file.sync_state]}
                </span>
                <span className={`pill pin-${file.pin_state}`}>{PIN_LABELS[file.pin_state]}</span>
              </div>
              <div className="file-actions" aria-label={`Actions ${fileName(file.local_path)}`}>
                {file.actions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="secondary"
                    onClick={() => runAction(file, action)}
                    disabled={busyPath === file.local_path}
                  >
                    {ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
