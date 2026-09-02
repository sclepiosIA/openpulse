/* @vitest-environment jsdom */
/**
 * Tests DrivePermissionsPanel — panneau « Accès » (P1 gouvernance)
 * dans le bloc Gestion Drive de /documents.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DrivePermissionsPanel } from './DrivePermissionsPanel'
import { DriveApiError } from '@/lib/drive/types'

const {
  useDrivePermissionsMock,
  useDrivePermissionMutationsMock,
  createMutateMock,
  updateMutateMock,
  removeMutateMock,
  PERMISSIONS,
} = vi.hoisted(() => {
  const PERMISSIONS = [
    {
      id: 'perm-1',
      space_id: 'space-1',
      folder_id: null,
      file_id: null,
      subject_type: 'user' as const,
      subject_id: 'alice@gsi.fr',
      permission: 'editor' as const,
      created_by: null,
      created_at: '2026-07-07T00:00:00Z',
    },
    {
      id: 'perm-2',
      space_id: 'space-1',
      folder_id: null,
      file_id: null,
      subject_type: 'team' as const,
      subject_id: 'dpo-team',
      permission: 'viewer' as const,
      created_by: null,
      created_at: '2026-07-07T00:00:00Z',
    },
  ]
  return {
    useDrivePermissionsMock: vi.fn(),
    useDrivePermissionMutationsMock: vi.fn(),
    createMutateMock: vi.fn(),
    updateMutateMock: vi.fn(),
    removeMutateMock: vi.fn(),
    PERMISSIONS,
  }
})

vi.mock('@/hooks/drive/useDrivePermissions', () => ({
  useDrivePermissions: (...args: unknown[]) => useDrivePermissionsMock(...args),
  useDrivePermissionMutations: (...args: unknown[]) => useDrivePermissionMutationsMock(...args),
}))

function renderPanel(scope = { spaceId: 'space-1', fileId: null as string | null }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <DrivePermissionsPanel scope={scope} scopeLabel="OpenPulse" />
    </QueryClientProvider>
  )
}

describe('DrivePermissionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDrivePermissionsMock.mockReturnValue({
      data: { space_id: 'space-1', folder_id: null, file_id: null, permissions: PERMISSIONS },
      isLoading: false,
      isError: false,
    })
    useDrivePermissionMutationsMock.mockReturnValue({
      create: { mutate: createMutateMock, isPending: false, error: null },
      updateRole: { mutate: updateMutateMock, isPending: false, error: null },
      remove: { mutate: removeMutateMock, isPending: false, error: null },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('affiche la liste des accès avec sujet, type et rôle', () => {
    renderPanel()

    const perm1 = screen.getByTestId('drive-permission-perm-1')
    expect(perm1).toHaveTextContent('alice@gsi.fr')
    expect(perm1).toHaveTextContent('Utilisateur')
    expect(screen.getByTestId('drive-permission-role-perm-1')).toHaveValue('editor')

    const perm2 = screen.getByTestId('drive-permission-perm-2')
    expect(perm2).toHaveTextContent('dpo-team')
    expect(perm2).toHaveTextContent('Équipe')
  })

  it('badge de portée : Espace sans fileId, Fichier avec fileId', () => {
    renderPanel({ spaceId: 'space-1', fileId: null })
    expect(screen.getByTestId('drive-permissions-scope')).toHaveTextContent('Espace')
    cleanup()
    renderPanel({ spaceId: 'space-1', fileId: 'file-1' })
    expect(screen.getByTestId('drive-permissions-scope')).toHaveTextContent('Fichier')
  })

  it('changement de rôle inline → updateRole.mutate', () => {
    renderPanel()

    fireEvent.change(screen.getByTestId('drive-permission-role-perm-1'), {
      target: { value: 'admin' },
    })

    expect(updateMutateMock).toHaveBeenCalledWith({
      permissionId: 'perm-1',
      permission: 'admin',
    })
  })

  it('retrait → remove.mutate avec id de la permission', () => {
    renderPanel()

    fireEvent.click(screen.getByTestId('drive-permission-remove-perm-2'))

    expect(removeMutateMock).toHaveBeenCalledWith('perm-2')
  })

  it("ajout d'un accès → create.mutate avec la portée et le formulaire", () => {
    renderPanel({ spaceId: 'space-1', fileId: 'file-9' })

    fireEvent.change(screen.getByTestId('drive-permission-add-subject-type'), {
      target: { value: 'team' },
    })
    fireEvent.change(screen.getByTestId('drive-permission-add-subject-id'), {
      target: { value: '  rssi-team ' },
    })
    fireEvent.change(screen.getByTestId('drive-permission-add-role'), {
      target: { value: 'uploader' },
    })
    fireEvent.click(screen.getByTestId('drive-permission-add-submit'))

    expect(createMutateMock).toHaveBeenCalledWith(
      {
        space_id: 'space-1',
        folder_id: null,
        file_id: 'file-9',
        subject_type: 'team',
        subject_id: 'rssi-team',
        permission: 'uploader',
      },
      expect.anything()
    )
  })

  it('ajout sans identifiant → erreur de formulaire, pas de mutation', () => {
    renderPanel()

    fireEvent.click(screen.getByTestId('drive-permission-add-submit'))

    expect(createMutateMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('drive-permission-add-error')).toHaveTextContent(
      /identifiant du sujet requis/i
    )
  })

  it('état vide : message accès hérités', () => {
    useDrivePermissionsMock.mockReturnValue({
      data: { space_id: 'space-1', folder_id: null, file_id: null, permissions: [] },
      isLoading: false,
      isError: false,
    })

    renderPanel()

    expect(screen.getByTestId('drive-permissions-empty')).toHaveTextContent(/hérités/i)
  })

  it('skeleton pendant le chargement', () => {
    useDrivePermissionsMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })

    renderPanel()

    expect(screen.getByTestId('drive-permissions-loading')).toBeInTheDocument()
  })

  it("message d'erreur si l'API échoue", () => {
    const refetchMock = vi.fn()
    useDrivePermissionsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new DriveApiError('Drive API → HTTP 500', '/api/drive/permissions', 500),
      refetch: refetchMock,
    })

    renderPanel()

    expect(screen.getByTestId('drive-permissions-error')).toBeInTheDocument()
    expect(screen.getByTestId('drive-permissions-error-detail')).toHaveTextContent(/incident/i)

    fireEvent.click(screen.getByTestId('drive-permissions-retry'))
    expect(refetchMock).toHaveBeenCalledTimes(1)
  })

  it('ajout en double (DriveApiError 409) → message dédié permission existante', () => {
    createMutateMock.mockImplementation(
      (_request: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new DriveApiError('Drive API → HTTP 409', '/api/drive/permissions', 409))
      }
    )

    renderPanel()
    fireEvent.change(screen.getByTestId('drive-permission-add-subject-id'), {
      target: { value: 'alice@gsi.fr' },
    })
    fireEvent.click(screen.getByTestId('drive-permission-add-submit'))

    expect(screen.getByTestId('drive-permission-add-error')).toHaveTextContent(
      /déjà une permission/i
    )
  })

  it('ajout refusé (403) → message user-friendly, pas de HTTP brut', () => {
    createMutateMock.mockImplementation(
      (_request: unknown, options?: { onError?: (error: unknown) => void }) => {
        options?.onError?.(new DriveApiError('Drive API → HTTP 403', '/api/drive/permissions', 403))
      }
    )

    renderPanel()
    fireEvent.change(screen.getByTestId('drive-permission-add-subject-id'), {
      target: { value: 'bob@gsi.fr' },
    })
    fireEvent.click(screen.getByTestId('drive-permission-add-submit'))

    const error = screen.getByTestId('drive-permission-add-error')
    expect(error).toHaveTextContent(/droits nécessaires/i)
    expect(error).not.toHaveTextContent(/HTTP 403/)
  })

  it("erreur d'une mutation inline (changement de rôle) → message visible", () => {
    useDrivePermissionMutationsMock.mockReturnValue({
      create: { mutate: createMutateMock, isPending: false, error: null },
      updateRole: {
        mutate: updateMutateMock,
        isPending: false,
        error: new DriveApiError('Drive API → HTTP 403', '/api/drive/permissions/perm-1', 403),
      },
      remove: { mutate: removeMutateMock, isPending: false, error: null },
    })

    renderPanel()

    expect(screen.getByTestId('drive-permissions-mutation-error')).toHaveTextContent(
      /droits nécessaires/i
    )
  })
})
