/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFolders, useFolderBreadcrumb, useMoveToFolder } from './useFolders';

const {
  AUTH_STATE,
  toastSpy,
  sanitizeSpy,
  mockFrom,
  FOLDERS_ROWS,
  CREATE_FOLDER_ROW,
  UPDATE_FOLDER_ROW,
  BREADCRUMB_ROOT,
  BREADCRUMB_CHILD,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  toastSpy: vi.fn(),
  sanitizeSpy: vi.fn(() => 'Sanitized error'),
  mockFrom: vi.fn(),
  FOLDERS_ROWS: [
    {
      id: 'f1',
      name: 'Alpha',
      parent_folder_id: null,
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: 'folder',
      color: '#111111',
      color_tags: null,
      position: 1,
      created_at: '2024-01-01',
      updated_at: '2024-01-02',
      is_restricted: false,
      document_folder_permissions: [
        {
          user_id: 'u2',
          group_id: null,
          access_level: 'read',
          user: { prenom: 'Jean', nom: 'Dupont', avatar_url: 'avatar-a' },
          group: null,
        },
        {
          user_id: null,
          group_id: 'g1',
          access_level: 'write',
          user: null,
          group: { name: 'Equipe A', color: '#22aa22' },
        },
      ],
    },
    {
      id: 'f2',
      name: 'Beta',
      parent_folder_id: null,
      owner_id: 'u1',
      folder_type: 'personal',
      related_etablissement_id: null,
      icon: null,
      color: null,
      color_tags: null,
      position: 2,
      created_at: '2024-01-03',
      updated_at: '2024-01-04',
      is_restricted: true,
      document_folder_permissions: [],
    },
  ],
  CREATE_FOLDER_ROW: {
    id: 'f3',
    name: 'Nouveau dossier',
    parent_folder_id: null,
    owner_id: 'u1',
    folder_type: 'personal',
    related_etablissement_id: null,
    icon: null,
    color: null,
  },
  UPDATE_FOLDER_ROW: {
    id: 'f1',
    name: 'Alpha renommé',
    parent_folder_id: null,
    owner_id: 'u1',
    folder_type: 'personal',
    related_etablissement_id: null,
    icon: 'folder',
    color: '#111111',
  },
  BREADCRUMB_ROOT: {
    id: 'root-folder',
    name: 'Racine',
    parent_folder_id: null,
  },
  BREADCRUMB_CHILD: {
    id: 'child-folder',
    name: 'Enfant',
    parent_folder_id: 'root-folder',
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: sanitizeSpy,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenableBuilder(config?: {
  data?: unknown;
  error?: { message: string } | null;
  singleData?: unknown;
  singleError?: { message: string } | null;
  maybeSingleData?: unknown;
  maybeSingleError?: { message: string } | null;
}) {
  const state = {
    data: config?.data ?? null,
    error: config?.error ?? null,
    singleData: config?.singleData ?? null,
    singleError: config?.singleError ?? null,
    maybeSingleData: config?.maybeSingleData ?? null,
    maybeSingleError: config?.maybeSingleError ?? null,
  };

  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: Promise<{ data: unknown; error: { message: string } | null }>['then'];
    catch: Promise<{ data: unknown; error: { message: string } | null }>['catch'];
  } = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    is: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(async () => ({ data: state.singleData, error: state.singleError })),
    maybeSingle: vi.fn(async () => ({ data: state.maybeSingleData, error: state.maybeSingleError })),
    then(onFulfilled, onRejected) {
      return Promise.resolve({ data: state.data, error: state.error }).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return Promise.resolve({ data: state.data, error: state.error }).catch(onRejected);
    },
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.is.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge les dossiers racine, mappe les partages et applique le filtre parent null', async () => {
    const builder = createThenableBuilder({ data: FOLDERS_ROWS, error: null });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useFolders(null), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.folders).toEqual([]);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('document_folders');
    expect(builder.select).toHaveBeenCalled();
    expect(builder.order).toHaveBeenNthCalledWith(1, 'position');
    expect(builder.order).toHaveBeenNthCalledWith(2, 'name');
    expect(builder.is).toHaveBeenCalledWith('parent_folder_id', null);

    expect(result.current.folders).toHaveLength(2);
    expect(result.current.folders[0]).toMatchObject({
      id: 'f1',
      name: 'Alpha',
      permissions_count: 2,
      shared_with: [
        {
          type: 'user',
          name: 'Jean Dupont',
          avatar_url: 'avatar-a',
          access_level: 'read',
        },
        {
          type: 'group',
          name: 'Equipe A',
          color: '#22aa22',
          access_level: 'write',
        },
      ],
    });
    expect(result.current.folders[1]).toMatchObject({
      id: 'f2',
      name: 'Beta',
      permissions_count: 0,
      shared_with: [],
    });
  });

  it('passe en erreur quand la requête dossiers échoue', async () => {
    const builder = createThenableBuilder({
      data: null,
      error: { message: 'boom' },
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useFolders('parent-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    expect(builder.eq).toHaveBeenCalledWith('parent_folder_id', 'parent-1');
    expect(result.current.error).toMatchObject({ message: 'boom' });
    expect(result.current.folders).toEqual([]);
  });

  it('crée un dossier puis invalide et affiche un toast de succès', async () => {
    const listBuilder = createThenableBuilder({ data: FOLDERS_ROWS, error: null });
    const insertBuilder = createThenableBuilder({
      singleData: CREATE_FOLDER_ROW,
      singleError: null,
    });

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) {
        return listBuilder;
      }
      return insertBuilder;
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const { result } = renderHook(() => useFolders(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.createFolder({
        name: 'Nouveau dossier',
        parent_folder_id: null,
        folder_type: 'personal',
        related_etablissement_id: null,
        icon: null,
        color: null,
      });
    });

    await waitFor(() => {
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        name: 'Nouveau dossier',
        parent_folder_id: null,
        owner_id: 'u1',
        folder_type: 'personal',
        related_etablissement_id: null,
        icon: null,
        color: null,
      });
    });

    expect(insertBuilder.select).toHaveBeenCalled();
    expect(insertBuilder.single).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['document-folders'] });
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Dossier créé',
      description: 'Le dossier a été créé avec succès',
    });

    invalidateSpy.mockRestore();
  });

  it('gère l’erreur de création avec message sanitizé', async () => {
    const listBuilder = createThenableBuilder({ data: FOLDERS_ROWS, error: null });
    const insertBuilder = createThenableBuilder({
      singleData: null,
      singleError: { message: 'insert failed' },
    });

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) {
        return listBuilder;
      }
      return insertBuilder;
    });

    const { result } = renderHook(() => useFolders(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.createFolder({
        name: 'Erreur dossier',
        parent_folder_id: null,
        folder_type: 'personal',
        related_etablissement_id: null,
        icon: null,
        color: null,
      });
    });

    await waitFor(() => {
      expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'insert failed' });
    });

    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Sanitized error',
      variant: 'destructive',
    });
  });

  it('met à jour un dossier avec les bonnes données', async () => {
    const listBuilder = createThenableBuilder({ data: FOLDERS_ROWS, error: null });
    const updateBuilder = createThenableBuilder({
      singleData: UPDATE_FOLDER_ROW,
      singleError: null,
    });

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) {
        return listBuilder;
      }
      return updateBuilder;
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const { result } = renderHook(() => useFolders(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.updateFolder({
        id: 'f1',
        data: { name: 'Alpha renommé', color: '#333333' },
      });
    });

    await waitFor(() => {
      expect(updateBuilder.update).toHaveBeenCalledWith({ name: 'Alpha renommé', color: '#333333' });
    });

    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'f1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['document-folders'] });
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Dossier modifié',
      description: 'Le dossier a été modifié avec succès',
    });

    invalidateSpy.mockRestore();
  });

  it('supprime un dossier puis invalide dossiers et documents', async () => {
    const listBuilder = createThenableBuilder({ data: FOLDERS_ROWS, error: null });
    const deleteBuilder = createThenableBuilder({ data: null, error: null });

    mockFrom.mockImplementation(() => {
      if (mockFrom.mock.calls.length === 1) {
        return listBuilder;
      }
      return deleteBuilder;
    });

    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const { result } = renderHook(() => useFolders(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.deleteFolder('f1');
    });

    await waitFor(() => {
      expect(deleteBuilder.delete).toHaveBeenCalled();
    });

    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'f1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['document-folders'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documents'] });
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Dossier supprimé',
      description: 'Le dossier et son contenu ont été supprimés',
    });

    invalidateSpy.mockRestore();
  });
});

describe('useFolderBreadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne seulement la racine quand folderId est null', async () => {
    const { result } = renderHook(() => useFolderBreadcrumb(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([{ id: null, name: 'Mes documents' }]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('construit le fil d’Ariane complet depuis le dossier courant jusqu’à la racine', async () => {
    const childBuilder = createThenableBuilder({
      maybeSingleData: BREADCRUMB_CHILD,
      maybeSingleError: null,
    });
    const rootBuilder = createThenableBuilder({
      maybeSingleData: BREADCRUMB_ROOT,
      maybeSingleError: null,
    });

    mockFrom.mockReturnValueOnce(childBuilder).mockReturnValueOnce(rootBuilder);

    const { result } = renderHook(() => useFolderBreadcrumb('child-folder'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenNthCalledWith(1, 'document_folders');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'document_folders');
    expect(childBuilder.eq).toHaveBeenCalledWith('id', 'child-folder');
    expect(rootBuilder.eq).toHaveBeenCalledWith('id', 'root-folder');
    expect(result.current.data).toEqual([
      { id: null, name: 'Mes documents' },
      { id: 'root-folder', name: 'Racine' },
      { id: 'child-folder', name: 'Enfant' },
    ]);
  });

  it('s’arrête proprement en cas d’erreur supabase', async () => {
    const errorBuilder = createThenableBuilder({
      maybeSingleData: null,
      maybeSingleError: { message: 'missing' },
    });

    mockFrom.mockReturnValue(errorBuilder);

    const { result } = renderHook(() => useFolderBreadcrumb('unknown-folder'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([{ id: null, name: 'Mes documents' }]);
  });
});

describe('useMoveToFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('déplace un document vers un dossier et invalide les documents', async () => {
    const builder = createThenableBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const { result } = renderHook(() => useMoveToFolder(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ documentId: 'd1', folderId: 'f2' });
    });

    await waitFor(() => {
      expect(builder.update).toHaveBeenCalledWith({ folder_id: 'f2' });
    });

    expect(mockFrom).toHaveBeenCalledWith('documents');
    expect(builder.eq).toHaveBeenCalledWith('id', 'd1');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['documents'] });
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Document déplacé',
      description: 'Le document a été déplacé avec succès',
    });

    invalidateSpy.mockRestore();
  });

  it('gère l’erreur de déplacement avec toast destructif', async () => {
    const builder = createThenableBuilder({ data: null, error: { message: 'update failed' } });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useMoveToFolder(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.mutate({ documentId: 'd1', folderId: null });
    });

    await waitFor(() => {
      expect(sanitizeSpy).toHaveBeenCalledWith({ message: 'update failed' });
    });

    expect(builder.update).toHaveBeenCalledWith({ folder_id: null });
    expect(builder.eq).toHaveBeenCalledWith('id', 'd1');
    expect(toastSpy).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Sanitized error',
      variant: 'destructive',
    });
  });
});