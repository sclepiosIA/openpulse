// @vitest-environment jsdom
import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useDocumentShares,
  useShareDocument,
  useUpdateDocumentShare,
  useUnshareDocument,
  useFolderPermissions,
  useSetFolderPermission,
  useRemoveFolderPermission,
} from './useDocumentPermissions'

const {
  AUTH_STATE,
  toastSuccess,
  toastError,
  mockFrom,
  mockInvoke,
  mockInvalidateQueries,
  DOCUMENT_SHARES_ROWS,
  PROFILE_ROWS_FOR_SHARED_WITH,
  PROFILE_ROWS_FOR_SHARED_BY,
  FOLDER_PERMISSIONS_ROWS,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u-auth', email: 'user@test.local' },
    session: { user: { id: 'u-auth' } },
    isLoading: false,
  },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  DOCUMENT_SHARES_ROWS: [
    {
      id: 'share-1',
      document_id: 'doc-1',
      shared_with_user_id: 'u-target',
      shared_with_group_id: null,
      permission_level: 'read',
      shared_by: 'u-auth',
      shared_at: '2024-01-01',
      expires_at: null,
      shared_with_group: null,
    },
    {
      id: 'share-2',
      document_id: 'doc-1',
      shared_with_user_id: null,
      shared_with_group_id: 'g-1',
      permission_level: 'write',
      shared_by: 'u-other',
      shared_at: '2024-01-02',
      expires_at: null,
      shared_with_group: [{ id: 'g-1', name: 'Equipe', description: 'Groupe', color: '#abc' }],
    },
  ],
  PROFILE_ROWS_FOR_SHARED_WITH: [
    {
      id: 'p-1',
      user_id: 'u-target',
      nom: 'Doe',
      prenom: 'Jane',
      email: 'jane@test.local',
      avatar_url: 'avatar-1',
    },
  ],
  PROFILE_ROWS_FOR_SHARED_BY: [
    { id: 'p-2', user_id: 'u-auth', nom: 'Admin', prenom: 'Alice' },
    { id: 'p-3', user_id: 'u-other', nom: 'User', prenom: 'Bob' },
  ],
  FOLDER_PERMISSIONS_ROWS: [
    {
      id: 'perm-1',
      folder_id: 'folder-1',
      user_id: 'u-target',
      group_id: null,
      access_level: 'admin',
      granted_by: 'u-auth',
      created_at: '2024-01-03',
      user: [
        {
          id: 'p-10',
          nom: 'Doe',
          prenom: 'Jane',
          email: 'jane@test.local',
          avatar_url: 'avatar-10',
        },
      ],
      group: null,
    },
    {
      id: 'perm-2',
      folder_id: 'folder-1',
      user_id: null,
      group_id: 'g-2',
      access_level: 'read',
      granted_by: 'u-auth',
      created_at: '2024-01-04',
      user: null,
      group: [{ id: 'g-2', name: 'Lecteurs', description: 'Read group', color: '#def' }],
    },
  ],
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

type QueryResult = { data: unknown; error: { message: string } | null }

function createBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  }
  return builder
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function createWrapper() {
  const queryClient = createQueryClient()
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useDocumentPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null })
  })

  describe('useDocumentShares', () => {
    it('returns transformed shares with user and shared_by profiles', async () => {
      const sharesBuilder = createBuilder({ data: DOCUMENT_SHARES_ROWS, error: null })
      const profilesUserBuilder = createBuilder({ data: PROFILE_ROWS_FOR_SHARED_WITH, error: null })
      const profilesByBuilder = createBuilder({ data: PROFILE_ROWS_FOR_SHARED_BY, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return sharesBuilder
        if (table === 'profiles') {
          if (mockFrom.mock.calls.filter(([name]) => name === 'profiles').length === 1) return profilesUserBuilder
          return profilesByBuilder
        }
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useDocumentShares('doc-1'), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockFrom).toHaveBeenCalledWith('document_shares')
      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(result.current.data).toHaveLength(2)
      expect(result.current.data?.[0]).toMatchObject({
        id: 'share-1',
        document_id: 'doc-1',
        permission_level: 'read',
        shared_with_user: {
          user_id: 'u-target',
          nom: 'Doe',
          prenom: 'Jane',
          email: 'jane@test.local',
        },
        shared_by_user: {
          user_id: 'u-auth',
          nom: 'Admin',
          prenom: 'Alice',
        },
      })
      expect(result.current.data?.[1]).toMatchObject({
        id: 'share-2',
        permission_level: 'write',
        shared_with_group: {
          id: 'g-1',
          name: 'Equipe',
          description: 'Groupe',
          color: '#abc',
        },
        shared_by_user: {
          user_id: 'u-other',
          nom: 'User',
          prenom: 'Bob',
        },
      })
    })

    it('sets isError when the shares query fails', async () => {
      const sharesBuilder = createBuilder({ data: null, error: { message: 'x' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return sharesBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useDocumentShares('doc-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error?.message).toBe('x')
    })
  })

  describe('useShareDocument', () => {
    it('inserts a share, invalidates query, shows toast and invokes notification', async () => {
      const insertBuilder = createBuilder({ data: null, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return insertBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useShareDocument(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          documentId: 'doc-1',
          documentName: 'Contrat',
          userId: 'u-target',
          permissionLevel: 'write',
        })
      })

      expect(insertBuilder.insert).toHaveBeenCalledWith({
        document_id: 'doc-1',
        shared_with_user_id: 'u-target',
        shared_with_group_id: null,
        permission_level: 'write',
        shared_by: 'u-auth',
      })
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['document-shares', 'doc-1'],
      })
      expect(toastSuccess).toHaveBeenCalledWith('Document partagé')
      expect(mockInvoke).toHaveBeenCalledWith('notify-document-shared', {
        body: {
          type: 'document',
          resourceName: 'Contrat',
          resourceId: 'doc-1',
          recipientUserIds: ['u-target'],
          recipientGroupId: undefined,
          permissionLevel: 'write',
          sharedByUserId: 'u-auth',
        },
      })
    })

    it('sets mutation error and shows error toast when insert fails', async () => {
      const insertBuilder = createBuilder({ data: null, error: { message: 'x' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return insertBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useShareDocument(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.mutateAsync({
            documentId: 'doc-1',
            groupId: 'g-1',
            permissionLevel: 'read',
          })
        } catch {}
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toastError).toHaveBeenCalledWith('Erreur lors du partage')
    })
  })

  describe('useUpdateDocumentShare', () => {
    it('updates permission level and invalidates document shares query', async () => {
      const updateBuilder = createBuilder({ data: null, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return updateBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useUpdateDocumentShare(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          shareId: 'share-1',
          permissionLevel: 'admin',
          documentId: 'doc-1',
        })
      })

      expect(updateBuilder.update).toHaveBeenCalledWith({ permission_level: 'admin' })
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'share-1')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['document-shares', 'doc-1'],
      })
      expect(toastSuccess).toHaveBeenCalledWith('Permission modifiée')
    })

    it('shows error toast when update fails', async () => {
      const updateBuilder = createBuilder({ data: null, error: { message: 'x' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return updateBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useUpdateDocumentShare(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.mutateAsync({
            shareId: 'share-1',
            permissionLevel: 'read',
            documentId: 'doc-1',
          })
        } catch {}
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toastError).toHaveBeenCalledWith('Erreur lors de la modification')
    })
  })

  describe('useUnshareDocument', () => {
    it('deletes a share and invalidates related query', async () => {
      const deleteBuilder = createBuilder({ data: null, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return deleteBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useUnshareDocument(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          shareId: 'share-2',
          documentId: 'doc-1',
        })
      })

      expect(deleteBuilder.delete).toHaveBeenCalled()
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'share-2')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['document-shares', 'doc-1'],
      })
      expect(toastSuccess).toHaveBeenCalledWith('Partage retiré')
    })

    it('shows error toast when delete fails', async () => {
      const deleteBuilder = createBuilder({ data: null, error: { message: 'x' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_shares') return deleteBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useUnshareDocument(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.mutateAsync({
            shareId: 'share-2',
            documentId: 'doc-1',
          })
        } catch {}
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toastError).toHaveBeenCalledWith('Erreur lors du retrait')
    })
  })

  describe('useFolderPermissions', () => {
    it('returns transformed folder permissions with flattened user/group', async () => {
      const folderBuilder = createBuilder({ data: FOLDER_PERMISSIONS_ROWS, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_folder_permissions') return folderBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useFolderPermissions('folder-1'), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data?.[0]).toMatchObject({
        id: 'perm-1',
        folder_id: 'folder-1',
        access_level: 'admin',
        user: {
          id: 'p-10',
          nom: 'Doe',
          prenom: 'Jane',
          email: 'jane@test.local',
          avatar_url: 'avatar-10',
        },
        group: null,
      })
      expect(result.current.data?.[1]).toMatchObject({
        id: 'perm-2',
        access_level: 'read',
        user: null,
        group: {
          id: 'g-2',
          name: 'Lecteurs',
          description: 'Read group',
          color: '#def',
        },
      })
    })

    it('sets isError when folder permissions query fails', async () => {
      const folderBuilder = createBuilder({ data: null, error: { message: 'x' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_folder_permissions') return folderBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useFolderPermissions('folder-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error?.message).toBe('x')
    })
  })

  describe('useSetFolderPermission', () => {
    it('inserts folder permission, invalidates query, shows toast and invokes notification', async () => {
      const insertBuilder = createBuilder({ data: null, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_folder_permissions') return insertBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useSetFolderPermission(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          folderId: 'folder-1',
          folderName: 'Dossier RH',
          groupId: 'g-2',
          accessLevel: 'read',
        })
      })

      expect(insertBuilder.insert).toHaveBeenCalledWith({
        folder_id: 'folder-1',
        user_id: null,
        group_id: 'g-2',
        access_level: 'read',
        granted_by: 'u-auth',
      })
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['folder-permissions', 'folder-1'],
      })
      expect(toastSuccess).toHaveBeenCalledWith('Permission ajoutée')
      expect(mockInvoke).toHaveBeenCalledWith('notify-document-shared', {
        body: {
          type: 'folder',
          resourceName: 'Dossier RH',
          resourceId: 'folder-1',
          recipientUserIds: undefined,
          recipientGroupId: 'g-2',
          permissionLevel: 'read',
          sharedByUserId: 'u-auth',
        },
      })
    })

    it('shows error toast when insert fails', async () => {
      const insertBuilder = createBuilder({ data: null, error: { message: 'x' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_folder_permissions') return insertBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useSetFolderPermission(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.mutateAsync({
            folderId: 'folder-1',
            userId: 'u-target',
            accessLevel: 'write',
          })
        } catch {}
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toastError).toHaveBeenCalledWith("Erreur lors de l'ajout de permission")
    })
  })

  describe('useRemoveFolderPermission', () => {
    it('deletes folder permission and invalidates query', async () => {
      const deleteBuilder = createBuilder({ data: null, error: null })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_folder_permissions') return deleteBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useRemoveFolderPermission(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({
          permissionId: 'perm-2',
          folderId: 'folder-1',
        })
      })

      expect(deleteBuilder.delete).toHaveBeenCalled()
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'perm-2')
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['folder-permissions', 'folder-1'],
      })
      expect(toastSuccess).toHaveBeenCalledWith('Permission retirée')
    })

    it('shows error toast when delete fails', async () => {
      const deleteBuilder = createBuilder({ data: null, error: { message: 'x' } })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'document_folder_permissions') return deleteBuilder
        return createBuilder({ data: [], error: null })
      })

      const { result } = renderHook(() => useRemoveFolderPermission(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        try {
          await result.current.mutateAsync({
            permissionId: 'perm-2',
            folderId: 'folder-1',
          })
        } catch {}
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(toastError).toHaveBeenCalledWith('Erreur lors du retrait')
    })
  })
})