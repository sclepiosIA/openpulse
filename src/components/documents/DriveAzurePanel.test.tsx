/* @vitest-environment jsdom */
/**
 * Tests DriveAzurePanel — panneau Gestion Drive Azure rendu dans /documents
 * quand le backend résolu est azure|hybrid.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DriveAzurePanel } from './DriveAzurePanel'
import { DriveApiError } from '@/lib/drive/types'

const {
  useDriveSpacesMock,
  useDriveTreeMock,
  uploadMutateAsyncMock,
  requestDriveDownloadUrlMock,
  SPACES,
  TREE,
} = vi.hoisted(() => {
  const SPACES = [
    {
      id: 'space-1',
      name: 'OpenPulse',
      slug: 'gsi',
      type: 'gsi' as const,
      etablissement_id: null,
      sensitivity: 'standard' as const,
      sync_policy: 'allowed' as const,
      status: 'active' as const,
      created_at: '2026-07-07T00:00:00Z',
      updated_at: '2026-07-07T00:00:00Z',
    },
    {
      id: 'space-2',
      name: 'DPO CH Alpha',
      slug: 'dpo-ch-alpha',
      type: 'dpo' as const,
      etablissement_id: 'etab-1',
      sensitivity: 'dpo_restricted' as const,
      sync_policy: 'web_only' as const,
      status: 'active' as const,
      created_at: '2026-07-07T00:00:00Z',
      updated_at: '2026-07-07T00:00:00Z',
    },
  ]
  const TREE = {
    space_id: 'space-1',
    folders: [
      {
        id: 'folder-1',
        space_id: 'space-1',
        parent_id: null,
        name: 'Contrats',
        path: '/Contrats',
        status: 'active' as const,
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
      },
    ],
    files: [
      {
        id: 'file-1',
        space_id: 'space-1',
        folder_id: 'folder-1',
        name: 'contrat-hds.pdf',
        path: '/Contrats/contrat-hds.pdf',
        content_type: 'application/pdf',
        size_bytes: 2048,
        sha256: null,
        etag: null,
        current_version: 3,
        status: 'active' as const,
        reference_framework: 'hds' as const,
        evidence_status: 'current' as const,
        valid_from: null,
        valid_until: null,
        created_at: '2026-07-07T00:00:00Z',
        updated_at: '2026-07-07T00:00:00Z',
      },
    ],
  }
  return {
    useDriveSpacesMock: vi.fn(),
    useDriveTreeMock: vi.fn(),
    uploadMutateAsyncMock: vi.fn(),
    requestDriveDownloadUrlMock: vi.fn(),
    SPACES,
    TREE,
  }
})

vi.mock('@/hooks/drive/useDriveSpaces', () => ({
  useDriveSpaces: (...args: unknown[]) => useDriveSpacesMock(...args),
}))

vi.mock('@/hooks/drive/useDriveTree', () => ({
  useDriveTree: (...args: unknown[]) => useDriveTreeMock(...args),
}))

// Upload : on mocke la mutation React Query (la logique intent→PUT→complete
// est couverte par useDriveUpload.test.tsx) ; le message d'erreur réel
// (driveUploadErrorMessage) reste importé du vrai module.
vi.mock('@/hooks/drive/useDriveUpload', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/drive/useDriveUpload')>(
    '@/hooks/drive/useDriveUpload'
  )
  return {
    ...actual,
    useDriveUpload: () => ({
      mutateAsync: uploadMutateAsyncMock,
      isPending: false,
    }),
  }
})

vi.mock('@/lib/drive/driveClient', () => ({
  requestDriveDownloadUrl: (...args: unknown[]) => requestDriveDownloadUrlMock(...args),
}))

// Le panneau Accès a ses propres tests (DrivePermissionsPanel.test.tsx) ;
// ici on vérifie seulement la portée qui lui est transmise.
vi.mock('@/components/documents/DrivePermissionsPanel', () => ({
  DrivePermissionsPanel: ({
    scope,
    scopeLabel,
  }: {
    scope: { spaceId: string; fileId?: string | null }
    scopeLabel: string
  }) => (
    <div
      data-testid="drive-permissions-panel-mock"
      data-space-id={scope.spaceId}
      data-file-id={scope.fileId ?? ''}
      data-scope-label={scopeLabel}
    />
  ),
}))

function renderPanel(backend: 'azure' | 'hybrid' = 'azure') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DriveAzurePanel backend={backend} />
    </QueryClientProvider>
  )
}

describe('DriveAzurePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDriveSpacesMock.mockReturnValue({
      data: SPACES,
      isLoading: false,
      isError: false,
    })
    useDriveTreeMock.mockReturnValue({
      data: TREE,
      isLoading: false,
      isError: false,
    })
    uploadMutateAsyncMock.mockResolvedValue({
      fileId: 'file-1',
      version: 4,
      path: '/note.pdf',
      action: 'upload',
    })
    requestDriveDownloadUrlMock.mockResolvedValue({
      download_url: 'https://blob.azure.test/download?sig=abc',
      expires_at: '2026-07-08T00:00:00Z',
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('affiche le badge backend Azure ou Hybride', () => {
    renderPanel('azure')
    expect(screen.getByTestId('drive-backend-badge')).toHaveTextContent(/azure/i)
    cleanup()
    renderPanel('hybrid')
    expect(screen.getByTestId('drive-backend-badge')).toHaveTextContent(/hybride/i)
  })

  it('liste les espaces avec libellés de type et politique web-only', () => {
    renderPanel()

    expect(screen.getByTestId('drive-space-gsi')).toHaveTextContent('OpenPulse')
    const dpoSpace = screen.getByTestId('drive-space-dpo-ch-alpha')
    expect(dpoSpace).toHaveTextContent('DPO CH Alpha')
    expect(dpoSpace).toHaveTextContent('DPO/RSSI')
    expect(dpoSpace).toHaveTextContent('web uniquement')
  })

  it("affiche l'arborescence du premier espace par défaut (fichiers, version, taille, preuve)", () => {
    renderPanel()

    expect(useDriveTreeMock).toHaveBeenCalledWith('space-1')
    const file = screen.getByTestId('drive-file-file-1')
    expect(file).toHaveTextContent('/Contrats/contrat-hds.pdf')
    expect(file).toHaveTextContent('v3')
    expect(file).toHaveTextContent('2.0 Ko')
    expect(screen.getByTestId('evidence-file-1')).toHaveTextContent('Preuve à jour')
    expect(screen.getByTestId('drive-tree')).toHaveTextContent('1 dossier · 1 fichier')
  })

  it("change d'espace au clic", async () => {
    renderPanel()

    fireEvent.click(screen.getByTestId('drive-space-dpo-ch-alpha'))

    await waitFor(() => {
      expect(useDriveTreeMock).toHaveBeenLastCalledWith('space-2')
    })
  })

  it('affiche le skeleton pendant le chargement des espaces', () => {
    useDriveSpacesMock.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    useDriveTreeMock.mockReturnValue({ data: undefined, isLoading: false, isError: false })

    renderPanel()

    expect(screen.getByTestId('drive-spaces-loading')).toBeInTheDocument()
  })

  it("affiche un message d'indisponibilité rassurant si l'API échoue (legacy intact)", () => {
    useDriveSpacesMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    useDriveTreeMock.mockReturnValue({ data: undefined, isLoading: false, isError: false })

    renderPanel()

    expect(screen.getByTestId('drive-spaces-error')).toHaveTextContent(
      /mode documents classique reste pleinement fonctionnel/i
    )
  })

  it('affiche un état vide sans espace accessible', () => {
    useDriveSpacesMock.mockReturnValue({ data: [], isLoading: false, isError: false })
    useDriveTreeMock.mockReturnValue({ data: undefined, isLoading: false, isError: false })

    renderPanel()

    expect(screen.getByTestId('drive-spaces-empty')).toBeInTheDocument()
  })

  it("affiche une erreur d'arborescence ciblée", () => {
    useDriveTreeMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    renderPanel()

    expect(screen.getByTestId('drive-tree-error')).toHaveTextContent('OpenPulse')
  })

  describe('téléversement (upload)', () => {
    function selectFiles(files: File[]) {
      const input = screen.getByTestId('drive-upload-input')
      fireEvent.change(input, { target: { files } })
    }

    it('upload réussi → mutation appelée avec l’espace actif + notice de succès', async () => {
      renderPanel()

      const file = new File(['hello'], 'note.pdf', { type: 'application/pdf' })
      selectFiles([file])

      await waitFor(() => {
        expect(uploadMutateAsyncMock).toHaveBeenCalledWith({ spaceId: 'space-1', file })
      })
      expect(await screen.findByTestId('drive-upload-notice')).toHaveTextContent(
        /1 fichier téléversé.*OpenPulse/i
      )
      expect(screen.queryByTestId('drive-upload-error')).not.toBeInTheDocument()
    })

    it('plusieurs fichiers → notice avec le compte total', async () => {
      renderPanel()

      selectFiles([
        new File(['a'], 'a.pdf', { type: 'application/pdf' }),
        new File(['b'], 'b.pdf', { type: 'application/pdf' }),
      ])

      await waitFor(() => expect(uploadMutateAsyncMock).toHaveBeenCalledTimes(2))
      expect(await screen.findByTestId('drive-upload-notice')).toHaveTextContent(
        /2 fichiers téléversés/i
      )
    })

    it('action noop → notice « déjà à jour »', async () => {
      uploadMutateAsyncMock.mockResolvedValue({
        fileId: 'file-1',
        version: 3,
        path: '/note.pdf',
        action: 'noop',
      })
      renderPanel()

      selectFiles([new File(['same'], 'note.pdf', { type: 'application/pdf' })])

      expect(await screen.findByTestId('drive-upload-notice')).toHaveTextContent(/déjà à jour/i)
    })

    it('échec upload (403) → erreur user-friendly avec le nom du fichier', async () => {
      uploadMutateAsyncMock.mockRejectedValue(
        new DriveApiError('Drive API → HTTP 403', '/api/drive/upload-intent', 403)
      )
      renderPanel()

      selectFiles([new File(['x'], 'secret.pdf', { type: 'application/pdf' })])

      const error = await screen.findByTestId('drive-upload-error')
      expect(error).toHaveTextContent('secret.pdf')
      expect(error).toHaveTextContent(/droits nécessaires/i)
      expect(error).not.toHaveTextContent(/HTTP 403/)
      expect(screen.queryByTestId('drive-upload-notice')).not.toBeInTheDocument()
    })

    it('échec au milieu d’un lot → stop au premier échec', async () => {
      uploadMutateAsyncMock
        .mockResolvedValueOnce({ fileId: 'f1', version: 1, path: '/a.pdf', action: 'upload' })
        .mockRejectedValueOnce(new Error('Conflit de version : v2 déjà présente'))
      renderPanel()

      selectFiles([
        new File(['a'], 'a.pdf', { type: 'application/pdf' }),
        new File(['b'], 'b.pdf', { type: 'application/pdf' }),
        new File(['c'], 'c.pdf', { type: 'application/pdf' }),
      ])

      const error = await screen.findByTestId('drive-upload-error')
      expect(error).toHaveTextContent('b.pdf')
      expect(uploadMutateAsyncMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('téléchargement', () => {
    beforeEach(() => {
      // jsdom ne sait pas naviguer : on neutralise le clic sur l'ancre
      // créée par handleDownload (sinon warning « Not implemented »).
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('bouton Télécharger → URL signée demandée pour le fichier', async () => {
      renderPanel()

      fireEvent.click(screen.getByTestId('drive-file-download-file-1'))

      await waitFor(() => {
        expect(requestDriveDownloadUrlMock).toHaveBeenCalledWith('file-1')
      })
      expect(screen.queryByTestId('drive-download-error')).not.toBeInTheDocument()
    })

    it('échec de téléchargement → message avec le nom du fichier', async () => {
      requestDriveDownloadUrlMock.mockRejectedValue(
        new DriveApiError('Drive API → HTTP 404', '/api/drive/download-url', 404)
      )
      renderPanel()

      fireEvent.click(screen.getByTestId('drive-file-download-file-1'))

      const error = await screen.findByTestId('drive-download-error')
      expect(error).toHaveTextContent('contrat-hds.pdf')
      expect(error).toHaveTextContent(/introuvable/i)
    })
  })

  describe('panneau Accès (permissions)', () => {
    it("masqué par défaut, s'ouvre au scope espace via « Gérer les accès »", () => {
      renderPanel()

      expect(screen.queryByTestId('drive-permissions-panel-mock')).not.toBeInTheDocument()

      fireEvent.click(screen.getByTestId('drive-permissions-toggle'))

      const panel = screen.getByTestId('drive-permissions-panel-mock')
      expect(panel).toHaveAttribute('data-space-id', 'space-1')
      expect(panel).toHaveAttribute('data-file-id', '')
      expect(panel).toHaveAttribute('data-scope-label', 'OpenPulse')
    })

    it('bouton Accès sur un fichier → scope fichier avec son path', () => {
      renderPanel()

      fireEvent.click(screen.getByTestId('drive-file-permissions-file-1'))

      const panel = screen.getByTestId('drive-permissions-panel-mock')
      expect(panel).toHaveAttribute('data-space-id', 'space-1')
      expect(panel).toHaveAttribute('data-file-id', 'file-1')
      expect(panel).toHaveAttribute('data-scope-label', '/Contrats/contrat-hds.pdf')
    })

    it('re-clic sur le même fichier → retour au scope espace', () => {
      renderPanel()

      fireEvent.click(screen.getByTestId('drive-file-permissions-file-1'))
      fireEvent.click(screen.getByTestId('drive-file-permissions-file-1'))

      const panel = screen.getByTestId('drive-permissions-panel-mock')
      expect(panel).toHaveAttribute('data-file-id', '')
      expect(panel).toHaveAttribute('data-scope-label', 'OpenPulse')
    })

    it('« Masquer les accès » referme le panneau', () => {
      renderPanel()

      fireEvent.click(screen.getByTestId('drive-permissions-toggle'))
      expect(screen.getByTestId('drive-permissions-panel-mock')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('drive-permissions-toggle'))
      expect(screen.queryByTestId('drive-permissions-panel-mock')).not.toBeInTheDocument()
    })

    it("changement d'espace → réinitialise la portée fichier", async () => {
      renderPanel()

      fireEvent.click(screen.getByTestId('drive-file-permissions-file-1'))
      fireEvent.click(screen.getByTestId('drive-space-dpo-ch-alpha'))

      await waitFor(() => {
        const panel = screen.getByTestId('drive-permissions-panel-mock')
        expect(panel).toHaveAttribute('data-space-id', 'space-2')
        expect(panel).toHaveAttribute('data-file-id', '')
      })
    })
  })
})
