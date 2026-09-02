import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import FilesPage from './FilesPage'
import { useAppStore } from '../state/store'
import type { FileEntry } from '../api/types'

const {
  getLocalFilesMock,
  copyDriveLinkMock,
  openInGestionMock,
  revealInFileManagerMock,
  pinFileMock,
  unpinFileMock,
  evictFileMock,
  runPullSyncMock,
} = vi.hoisted(() => ({
  getLocalFilesMock: vi.fn(),
  copyDriveLinkMock: vi.fn(),
  openInGestionMock: vi.fn(),
  revealInFileManagerMock: vi.fn(),
  pinFileMock: vi.fn(),
  unpinFileMock: vi.fn(),
  evictFileMock: vi.fn(),
  runPullSyncMock: vi.fn(),
}))

vi.mock('../api/driveClient', () => ({
  getLocalFiles: (...args: unknown[]) => getLocalFilesMock(...args),
  copyDriveLink: (...args: unknown[]) => copyDriveLinkMock(...args),
  openInGestion: (...args: unknown[]) => openInGestionMock(...args),
  revealInFileManager: (...args: unknown[]) => revealInFileManagerMock(...args),
  pinFile: (...args: unknown[]) => pinFileMock(...args),
  unpinFile: (...args: unknown[]) => unpinFileMock(...args),
  evictFile: (...args: unknown[]) => evictFileMock(...args),
  runPullSync: (...args: unknown[]) => runPullSyncMock(...args),
}))

const FILES: FileEntry[] = [
  {
    local_path: 'openpulse-general/Contrats/contrat-hds.pdf',
    space_id: 'space-1',
    file_id: 'file-1',
    folder_id: 'folder-1',
    sha256: 'abc',
    etag: 'etag-1',
    version: 3,
    size_bytes: 2048,
    mtime: 1,
    sync_state: 'idle',
    pin_state: 'unpinned',
    last_error: null,
    updated_at: 1,
    actions: ['copy_link', 'open_in_gestion', 'reveal_in_file_manager', 'keep_local', 'free_space'],
  },
  {
    local_path: 'openpulse-general/cloud-only.docx',
    space_id: 'space-1',
    file_id: 'file-2',
    folder_id: null,
    sha256: 'def',
    etag: 'etag-2',
    version: 1,
    size_bytes: 0,
    mtime: 2,
    sync_state: 'pending_download',
    pin_state: 'evicted',
    last_error: null,
    updated_at: 2,
    actions: ['copy_link', 'open_in_gestion', 'keep_local'],
  },
]

describe('FilesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLocalFilesMock.mockResolvedValue(FILES)
    copyDriveLinkMock.mockResolvedValue(
      'https://gestion.exploitant.example.org/documents?space=space-1&file=file-1'
    )
    openInGestionMock.mockResolvedValue(
      'https://gestion.exploitant.example.org/documents?space=space-1&file=file-1'
    )
    revealInFileManagerMock.mockResolvedValue(undefined)
    pinFileMock.mockResolvedValue({
      local_path: FILES[0].local_path,
      pin_state: 'pinned',
      needs_download: false,
    })
    unpinFileMock.mockResolvedValue({
      local_path: FILES[0].local_path,
      pin_state: 'unpinned',
      needs_download: false,
    })
    evictFileMock.mockResolvedValue({ local_path: FILES[0].local_path, freed_bytes: 2048 })
    runPullSyncMock.mockResolvedValue(undefined)
    useAppStore.setState({ screen: 'files' })
  })

  it('liste les fichiers locaux indexés avec états sync/pin et actions', async () => {
    render(<FilesPage />)

    expect(await screen.findByText('contrat-hds.pdf')).toBeTruthy()
    expect(screen.getByText('cloud-only.docx')).toBeTruthy()
    expect(screen.getByText('Synchronisé')).toBeTruthy()
    expect(screen.getAllByText('Cloud-only').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: 'Copier le lien' })).toHaveLength(2)
    expect(getLocalFilesMock).toHaveBeenCalledWith(200)
  })

  it('exécute les actions contextuelles via IPC', async () => {
    render(<FilesPage />)
    await screen.findByText('contrat-hds.pdf')

    fireEvent.click(screen.getAllByRole('button', { name: 'Copier le lien' })[0])
    await waitFor(() => expect(copyDriveLinkMock).toHaveBeenCalledWith(FILES[0].local_path))
    expect(screen.getByText(/Lien copié/)).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: "Libérer l'espace" })[0])
    await waitFor(() => expect(evictFileMock).toHaveBeenCalledWith(FILES[0].local_path))
    expect(await screen.findByText(/2.0 Ko libérés/)).toBeTruthy()
  })

  it('épingler un fichier cloud-only relance le pull sync', async () => {
    pinFileMock.mockResolvedValueOnce({
      local_path: FILES[1].local_path,
      pin_state: 'pinned',
      needs_download: true,
    })

    render(<FilesPage />)
    await screen.findByText('cloud-only.docx')

    fireEvent.click(screen.getAllByRole('button', { name: 'Toujours garder local' })[1])

    await waitFor(() => expect(pinFileMock).toHaveBeenCalledWith(FILES[1].local_path))
    expect(runPullSyncMock).toHaveBeenCalled()
    expect(await screen.findByText(/téléchargement relancé/)).toBeTruthy()
  })

  it('renvoie vers le diagnostic sync', async () => {
    render(<FilesPage />)
    await screen.findByText('contrat-hds.pdf')

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostic sync' }))

    expect(useAppStore.getState().screen).toBe('status')
  })
})
