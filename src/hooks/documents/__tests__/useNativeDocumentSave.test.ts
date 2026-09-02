import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNativeDocumentSave } from '../useNativeDocumentSave';
import { supabase } from '@/integrations/supabase/client';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    from: (...args: any[]) => mockFrom(...args),
    auth: { getUser: () => mockGetUser() },
  },
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

// AuthProvider mock — useNativeDocumentSave calls useAuth() to get user.
// Tests can override the user via `mockAuthUser` between tests.
let mockAuthUser: { id: string; email: string } | null = { id: 'user-1', email: 'test@test.com' };
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({
    user: mockAuthUser,
    session: mockAuthUser ? { access_token: 'mock-token' } : null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  useAuthSafe: () => ({
    user: mockAuthUser,
    session: mockAuthUser ? { access_token: 'mock-token' } : null,
    loading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe('useNativeDocumentSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockAuthUser = { id: 'user-1', email: 'test@test.com' };
  });

  it('returns save function and initial state', () => {
    const { result } = renderHook(() =>
      useNativeDocumentSave({
        documentName: 'test.md',
        mimeType: 'text/markdown',
        extension: 'md',
      })
    );
    expect(typeof result.current.save).toBe('function');
    expect(result.current.isSaving).toBe(false);
    expect(result.current.documentId).toBeNull();
    expect(result.current.storagePath).toBeNull();
  });

  it('uses existingDocumentId when provided', () => {
    const { result } = renderHook(() =>
      useNativeDocumentSave({
        documentName: 'test.md',
        mimeType: 'text/markdown',
        extension: 'md',
        existingDocumentId: 'doc-123',
      })
    );
    expect(result.current.documentId).toBe('doc-123');
  });

  it('écrit le contenu en base, sans chemin de stockage, et ne contacte aucun service externe', async () => {
    // Ce test portait sur l'envoi à Nextcloud. Ce service n'existe dans aucune
    // composition de la distribution : l'enregistrement échouait sur toute
    // installation, et le test le validait quand même — il vérifiait qu'on
    // appelait une fonction absente.
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-doc-id' }, error: null }),
      }),
    });
    mockFrom.mockReturnValue({ insert: insertSpy });

    const { result } = renderHook(() =>
      useNativeDocumentSave({
        documentName: 'test.md',
        mimeType: 'text/markdown',
        extension: 'md',
      })
    );

    await act(async () => {
      await result.current.save(new Blob(['bonjour'], { type: 'text/markdown' }));
    });

    const ligne = insertSpy.mock.calls[0][0];
    expect(ligne.content).toBe('bonjour');
    expect(ligne.name).toBe('test.md');
    expect(ligne.source_type).toBe('native_editor');
    // La contrainte `documents_fichier_ou_page` refuse une ligne qui porte à la
    // fois un contenu et un chemin. Renseigner storage_path ici ferait échouer
    // l'insertion en base, ce qu'un test à mocks ne montrerait jamais.
    expect(ligne.storage_path).toBeUndefined();
    expect(result.current.documentId).toBe('new-doc-id');
    expect(result.current.isSaving).toBe(false);
    // Garde-fou : plus aucune fonction edge n'est appelée pour enregistrer.
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('remonte la cause quand la base refuse l’écriture', async () => {
    // « Erreur lors de la sauvegarde », seul, a masqué l'absence de Nextcloud
    // pendant toute la vie de ce code. Le message doit porter la cause.
    const { toast } = await import('sonner');
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('violates check constraint "documents_fichier_ou_page"'),
          }),
        }),
      }),
    });

    const { result } = renderHook(() =>
      useNativeDocumentSave({ documentName: 't.md', mimeType: 'text/markdown', extension: 'md' })
    );
    await act(async () => {
      await result.current.save(new Blob(['x']));
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('documents_fichier_ou_page')
    );
    expect(result.current.documentId).toBeNull();
  });

  it('returns false for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockAuthUser = null;

    const { result } = renderHook(() =>
      useNativeDocumentSave({
        documentName: 'test.md',
        mimeType: 'text/markdown',
        extension: 'md',
      })
    );

    const blob = new Blob(['hello']);
    await act(async () => {
      await result.current.save(blob);
    });

    expect(result.current.documentId).toBeNull();
    expect(result.current.isSaving).toBe(false);
  });
});
