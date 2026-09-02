import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useRHOnboardingDocuments,
  useUploadRHOnboardingDocument,
  useDeleteRHOnboardingDocument,
  downloadRHOnboardingDocument,
} from './useRHOnboardingDocuments';

const {
  ROWS,
  INSERTED_DOC,
  AUTH,
  mockFrom,
  mockStorageFrom,
  makeBuilder,
  toastSuccess,
  toastError,
  debugError,
} = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'doc-1',
      onboarding_id: 'onb-1',
      profile_id: 'p1',
      document_type: 'cv',
      document_label: 'CV',
      nom_fichier: 'cv.pdf',
      chemin_fichier: 'p1/cv/123_cv.pdf',
      taille_octets: 1024,
      mime_type: 'application/pdf',
      uploaded_by: 'prof-1',
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'doc-2',
      onboarding_id: null,
      profile_id: 'p1',
      document_type: 'contrat',
      document_label: null,
      nom_fichier: 'contrat.pdf',
      chemin_fichier: 'p1/contrat/456_contrat.pdf',
      taille_octets: 2048,
      mime_type: 'application/pdf',
      uploaded_by: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  const INSERTED_DOC = {
    id: 'doc-new',
    onboarding_id: 'onb-9',
    profile_id: 'p1',
    document_type: 'cv',
    document_label: 'Mon CV',
    nom_fichier: 'cv test.pdf',
    chemin_fichier: 'p1/cv/999_cv_test.pdf',
    taille_octets: 3,
    mime_type: 'application/pdf',
    uploaded_by: 'prof-1',
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  };

  const AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  interface BuilderResult {
    data: unknown;
    error: { message: string } | null;
  }

  const makeBuilder = (result: BuilderResult) => {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'eq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
      'upsert',
      'neq',
      'is',
    ];
    for (const m of chainMethods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (
      onFulfilled?: (v: BuilderResult) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected);
    return builder;
  };

  return {
    ROWS,
    INSERTED_DOC,
    AUTH,
    makeBuilder,
    mockFrom: vi.fn(),
    mockStorageFrom: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    debugError: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    storage: { from: mockStorageFrom },
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH,
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: debugError, log: vi.fn(), warn: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRHOnboardingDocuments', () => {
  it('retourne les documents du profil après chargement', async () => {
    mockFrom.mockImplementation(() => makeBuilder({ data: ROWS, error: null }));

    const { result } = renderHook(() => useRHOnboardingDocuments('p1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].id).toBe('doc-1');
    expect(result.current.data?.[0].nom_fichier).toBe('cv.pdf');
    expect(result.current.data?.[1].document_type).toBe('contrat');
    expect(mockFrom).toHaveBeenCalledWith('rh_onboarding_documents');
  });

  it('est désactivé sans profileId et ne déclenche aucune requête', async () => {
    const { result } = renderHook(() => useRHOnboardingDocuments(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passe en erreur quand supabase retourne une erreur', async () => {
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: null, error: { message: 'x' } })
    );

    const { result } = renderHook(() => useRHOnboardingDocuments('p1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual({ message: 'x' });
  });
});

describe('useUploadRHOnboardingDocument', () => {
  it('upload le fichier, insère la ligne et notifie le succès', async () => {
    const upload = vi.fn(() => Promise.resolve({ data: { path: 'p' }, error: null }));
    const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'public-url' } }));
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl });

    const insertBuilder = makeBuilder({ data: INSERTED_DOC, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return makeBuilder({ data: { id: 'prof-1' }, error: null });
      }
      return insertBuilder;
    });

    const { result } = renderHook(() => useUploadRHOnboardingDocument(), {
      wrapper: createWrapper(),
    });

    const file = new File(['abc'], 'cv test.pdf', { type: 'application/pdf' });

    await act(async () => {
      const doc = await result.current.mutateAsync({
        file,
        profileId: 'p1',
        onboardingId: 'onb-9',
        documentType: 'cv',
        documentLabel: 'Mon CV',
      });
      expect(doc.id).toBe('doc-new');
    });

    expect(mockStorageFrom).toHaveBeenCalledWith('rh-onboarding-documents');
    expect(upload).toHaveBeenCalledTimes(1);
    const uploadedPath = upload.mock.calls[0][0] as unknown as string;
    expect(uploadedPath).toMatch(/^p1\/cv\/\d+_cv_test\.pdf$/);

    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        onboarding_id: 'onb-9',
        profile_id: 'p1',
        document_type: 'cv',
        document_label: 'Mon CV',
        nom_fichier: 'cv test.pdf',
        taille_octets: 3,
        mime_type: 'application/pdf',
        uploaded_by: 'prof-1',
      })
    );

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Document uploadé avec succès')
    );
  });

  it("notifie l'erreur si l'upload storage échoue", async () => {
    const upload = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: 'storage down' } })
    );
    mockStorageFrom.mockReturnValue({ upload, getPublicUrl: vi.fn() });

    const { result } = renderHook(() => useUploadRHOnboardingDocument(), {
      wrapper: createWrapper(),
    });

    const file = new File(['abc'], 'cv.pdf', { type: 'application/pdf' });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          file,
          profileId: 'p1',
          documentType: 'cv',
        })
      ).rejects.toEqual({ message: 'storage down' });
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erreur lors de l'upload du document")
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('useDeleteRHOnboardingDocument', () => {
  it('supprime du storage et de la table puis notifie', async () => {
    const remove = vi.fn(() => Promise.resolve({ data: [], error: null }));
    mockStorageFrom.mockReturnValue({ remove });

    const deleteBuilder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(deleteBuilder);

    const { result } = renderHook(() => useDeleteRHOnboardingDocument(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const profileId = await result.current.mutateAsync({
        id: 'doc-1',
        cheminFichier: 'p1/cv/123_cv.pdf',
        profileId: 'p1',
      });
      expect(profileId).toBe('p1');
    });

    expect(remove).toHaveBeenCalledWith(['p1/cv/123_cv.pdf']);
    expect(mockFrom).toHaveBeenCalledWith('rh_onboarding_documents');
    expect(deleteBuilder.delete).toHaveBeenCalled();
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'doc-1');
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Document supprimé')
    );
  });

  it("notifie l'erreur si la suppression en base échoue", async () => {
    const remove = vi.fn(() => Promise.resolve({ data: [], error: null }));
    mockStorageFrom.mockReturnValue({ remove });
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }));

    const { result } = renderHook(() => useDeleteRHOnboardingDocument(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          id: 'doc-1',
          cheminFichier: 'p1/cv/123_cv.pdf',
          profileId: 'p1',
        })
      ).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Erreur lors de la suppression')
    );
  });
});

describe('downloadRHOnboardingDocument', () => {
  it('télécharge le fichier et déclenche le toast de succès', async () => {
    const blob = new Blob(['contenu']);
    const download = vi.fn(() => Promise.resolve({ data: blob, error: null }));
    mockStorageFrom.mockReturnValue({ download });

    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;

    await downloadRHOnboardingDocument('p1/cv/123_cv.pdf', 'cv.pdf');

    expect(mockStorageFrom).toHaveBeenCalledWith('rh-onboarding-documents');
    expect(download).toHaveBeenCalledWith('p1/cv/123_cv.pdf');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(toastSuccess).toHaveBeenCalledWith('Document téléchargé');
    expect(toastError).not.toHaveBeenCalled();
  });

  it("affiche un toast d'erreur si le téléchargement échoue", async () => {
    const download = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: 'not found' } })
    );
    mockStorageFrom.mockReturnValue({ download });

    await downloadRHOnboardingDocument('p1/cv/inconnu.pdf', 'inconnu.pdf');

    expect(toastError).toHaveBeenCalledWith('Erreur lors du téléchargement');
    expect(debugError).toHaveBeenCalledWith({ message: 'not found' });
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});