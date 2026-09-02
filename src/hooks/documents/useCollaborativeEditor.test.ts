// @vitest-environment jsdom
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCollaborativeEditor } from './useCollaborativeEditor';

const {
  AUTH_STATE,
  PROFILE_STATE,
  SAVE_STATE,
  TOAST_SUCCESS,
  TOAST_ERROR,
  editorSetContentMock,
  editorGetHTMLMock,
  useEditorMock,
  providerInstances,
  ydocInstances,
  blobParts,
  BlobMock,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const PROFILE_STATE = {
    data: {
      prenom: 'Jean',
      nom: 'Dupont',
      avatar_url: 'avatar.png',
    },
  };

  const SAVE_STATE = {
    isSaving: false,
    save: vi.fn().mockResolvedValue(undefined),
  };

  const TOAST_SUCCESS = vi.fn();
  const TOAST_ERROR = vi.fn();

  const editorSetContentMock = vi.fn();
  const editorGetHTMLMock = vi.fn(() => '<p>saved html</p>');
  const useEditorMock = vi.fn(() => ({
    commands: {
      setContent: editorSetContentMock,
    },
    getHTML: editorGetHTMLMock,
  }));

  const providerInstances: Array<{
    documentId: string;
    user: { id: string; name: string; avatar?: string; color: string };
    connect: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    onConnectionChange: (cb: (connected: boolean) => void) => void;
    onSynced: (cb: () => void) => void;
    getConnectedUsers: () => Array<{
      user_id: string;
      user_name: string;
      user_avatar?: string;
      user_color: string;
    }>;
    __emitConnectionChange: (value: boolean) => void;
    __emitSynced: () => void;
    __setConnectedUsers: (users: Array<{
      user_id: string;
      user_name: string;
      user_avatar?: string;
      user_color: string;
    }>) => void;
  }> = [];

  const ydocInstances: Array<{
    getXmlFragment: (name: string) => { length: number };
    on: (event: string, cb: () => void) => void;
    off: (event: string, cb: () => void) => void;
    destroy: ReturnType<typeof vi.fn>;
    __emitUpdate: () => void;
    __setXmlLength: (value: number) => void;
  }> = [];

  const blobParts = new Map<object, string>();

  class BlobMock {
    type: string;
    size: number;
    constructor(parts: unknown[] = [], options?: { type?: string }) {
      const text = parts.map((part) => String(part)).join('');
      this.type = options?.type ?? '';
      this.size = text.length;
      blobParts.set(this, text);
    }
    text() {
      return Promise.resolve(blobParts.get(this) ?? '');
    }
  }

  return {
    AUTH_STATE,
    PROFILE_STATE,
    SAVE_STATE,
    TOAST_SUCCESS,
    TOAST_ERROR,
    editorSetContentMock,
    editorGetHTMLMock,
    useEditorMock,
    providerInstances,
    ydocInstances,
    blobParts,
    BlobMock,
  };
});

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => PROFILE_STATE,
}));

vi.mock('@/hooks/documents/useNativeDocumentSave', () => ({
  useNativeDocumentSave: () => SAVE_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: TOAST_SUCCESS,
    error: TOAST_ERROR,
  },
}));

vi.mock('@tiptap/react', () => ({
  useEditor: useEditorMock,
}));

vi.mock('yjs', () => {
  class Doc {
    private handlers: Record<string, Set<() => void>>;
    private xmlLength: number;

    constructor() {
      this.handlers = {};
      this.xmlLength = 0;
      ydocInstances.push(this as unknown as {
        getXmlFragment: (name: string) => { length: number };
        on: (event: string, cb: () => void) => void;
        off: (event: string, cb: () => void) => void;
        destroy: ReturnType<typeof vi.fn>;
        __emitUpdate: () => void;
        __setXmlLength: (value: number) => void;
      });
    }

    getXmlFragment() {
      return { length: this.xmlLength };
    }

    on(event: string, cb: () => void) {
      if (!this.handlers[event]) {
        this.handlers[event] = new Set();
      }
      this.handlers[event].add(cb);
    }

    off(event: string, cb: () => void) {
      this.handlers[event]?.delete(cb);
    }

    destroy = vi.fn();

    __emitUpdate() {
      this.handlers.update?.forEach((cb) => cb());
    }

    __setXmlLength(value: number) {
      this.xmlLength = value;
    }
  }

  return { Doc };
});

vi.mock('@/lib/collab/SupabaseProvider', () => {
  class SupabaseProvider {
    documentId: string;
    doc: unknown;
    user: { id: string; name: string; avatar?: string; color: string };
    private connectionCb?: (connected: boolean) => void;
    private syncedCb?: () => void;
    private users: Array<{
      user_id: string;
      user_name: string;
      user_avatar?: string;
      user_color: string;
    }>;

    connect = vi.fn();
    destroy = vi.fn();

    constructor(
      documentId: string,
      doc: unknown,
      user: { id: string; name: string; avatar?: string; color: string },
    ) {
      this.documentId = documentId;
      this.doc = doc;
      this.user = user;
      this.users = [];
      providerInstances.push(this as unknown as {
        documentId: string;
        user: { id: string; name: string; avatar?: string; color: string };
        connect: ReturnType<typeof vi.fn>;
        destroy: ReturnType<typeof vi.fn>;
        onConnectionChange: (cb: (connected: boolean) => void) => void;
        onSynced: (cb: () => void) => void;
        getConnectedUsers: () => Array<{
          user_id: string;
          user_name: string;
          user_avatar?: string;
          user_color: string;
        }>;
        __emitConnectionChange: (value: boolean) => void;
        __emitSynced: () => void;
        __setConnectedUsers: (users: Array<{
          user_id: string;
          user_name: string;
          user_avatar?: string;
          user_color: string;
        }>) => void;
      });
    }

    onConnectionChange(cb: (connected: boolean) => void) {
      this.connectionCb = cb;
    }

    onSynced(cb: () => void) {
      this.syncedCb = cb;
    }

    getConnectedUsers() {
      return this.users;
    }

    __emitConnectionChange(value: boolean) {
      this.connectionCb?.(value);
    }

    __emitSynced() {
      this.syncedCb?.();
    }

    __setConnectedUsers(
      users: Array<{
        user_id: string;
        user_name: string;
        user_avatar?: string;
        user_color: string;
      }>,
    ) {
      this.users = users;
    }
  }

  return { SupabaseProvider };
});

vi.mock('@tiptap/starter-kit', () => ({
  default: { configure: vi.fn(() => ({ name: 'starter-kit' })) },
}));
vi.mock('@tiptap/extension-collaboration', () => ({
  default: { configure: vi.fn(() => ({ name: 'collaboration' })) },
}));
vi.mock('@tiptap/extension-collaboration-cursor', () => ({
  default: { configure: vi.fn(() => ({ name: 'collaboration-cursor' })) },
}));
vi.mock('@tiptap/extension-underline', () => ({
  default: { name: 'underline' },
}));
vi.mock('@tiptap/extension-link', () => ({
  default: { configure: vi.fn(() => ({ name: 'link' })) },
}));
vi.mock('@tiptap/extension-image', () => ({
  default: { configure: vi.fn(() => ({ name: 'image' })) },
}));
vi.mock('@tiptap/extension-placeholder', () => ({
  default: { configure: vi.fn(() => ({ name: 'placeholder' })) },
}));
vi.mock('@tiptap/extension-task-list', () => ({
  default: { name: 'task-list' },
}));
vi.mock('@tiptap/extension-task-item', () => ({
  default: { configure: vi.fn(() => ({ name: 'task-item' })) },
}));
vi.mock('@tiptap/extension-table', () => ({
  Table: { configure: vi.fn(() => ({ name: 'table' })) },
}));
vi.mock('@tiptap/extension-table-row', () => ({
  TableRow: { name: 'table-row' },
}));
vi.mock('@tiptap/extension-table-cell', () => ({
  TableCell: { name: 'table-cell' },
}));
vi.mock('@tiptap/extension-table-header', () => ({
  TableHeader: { name: 'table-header' },
}));
vi.mock('@tiptap/extension-text-align', () => ({
  default: { configure: vi.fn(() => ({ name: 'text-align' })) },
}));
vi.mock('@tiptap/extension-color', () => ({
  default: { name: 'color' },
}));
vi.mock('@tiptap/extension-text-style', () => ({
  TextStyle: { name: 'text-style' },
}));
vi.mock('@tiptap/extension-highlight', () => ({
  default: { configure: vi.fn(() => ({ name: 'highlight' })) },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useCollaborativeEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Blob', BlobMock);
    providerInstances.length = 0;
    ydocInstances.length = 0;
    blobParts.clear();
    SAVE_STATE.isSaving = false;
    SAVE_STATE.save.mockReset();
    SAVE_STATE.save.mockResolvedValue(undefined);
    TOAST_SUCCESS.mockReset();
    TOAST_ERROR.mockReset();
    editorSetContentMock.mockReset();
    editorGetHTMLMock.mockReset();
    editorGetHTMLMock.mockReturnValue('<p>saved html</p>');
    useEditorMock.mockClear();
    AUTH_STATE.user = { id: 'u1', email: 'user@test.co' };
    PROFILE_STATE.data = {
      prenom: 'Jean',
      nom: 'Dupont',
      avatar_url: 'avatar.png',
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('connecte le provider, synchronise le document, charge le contenu initial et met à jour les utilisateurs connectés', async () => {
    const { result } = renderHook(
      () =>
        useCollaborativeEditor({
          documentId: 'doc-1',
          documentName: 'Contrat',
          initialContent: '<p>Contenu initial</p>',
          folderId: 'folder-1',
        }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isSynced).toBe(false);
    expect(result.current.connectedUsers).toEqual([]);
    expect(result.current.isSaving).toBe(false);
    expect(providerInstances).toHaveLength(1);
    expect(ydocInstances).toHaveLength(1);

    const provider = providerInstances[0];
    const ydoc = ydocInstances[0];

    expect(provider.documentId).toBe('doc-1');
    expect(provider.user).toMatchObject({
      id: 'u1',
      name: 'Jean Dupont',
      avatar: 'avatar.png',
    });
    expect(typeof provider.user.color).toBe('string');
    expect(provider.user.color.startsWith('#')).toBe(true);
    expect(provider.connect).toHaveBeenCalledTimes(1);

    act(() => {
      provider.__emitConnectionChange(true);
    });

    expect(result.current.isConnected).toBe(true);

    act(() => {
      ydoc.__setXmlLength(0);
      provider.__emitSynced();
    });

    expect(result.current.isSynced).toBe(true);
    expect(editorSetContentMock).toHaveBeenCalledTimes(1);
    expect(editorSetContentMock).toHaveBeenCalledWith('<p>Contenu initial</p>');

    provider.__setConnectedUsers([
      {
        user_id: 'u2',
        user_name: 'Alice Martin',
        user_avatar: 'alice.png',
        user_color: '#3b82f6',
      },
      {
        user_id: 'u3',
        user_name: 'Bob Leroy',
        user_color: '#ef4444',
      },
    ]);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.connectedUsers).toEqual([
      {
        user_id: 'u2',
        user_name: 'Alice Martin',
        user_avatar: 'alice.png',
        user_color: '#3b82f6',
      },
      {
        user_id: 'u3',
        user_name: 'Bob Leroy',
        user_color: '#ef4444',
      },
    ]);
  });

  it('effectue une sauvegarde manuelle réussie avec un Blob HTML et affiche un toast de succès', async () => {
    const { result } = renderHook(
      () =>
        useCollaborativeEditor({
          documentId: 'doc-2',
          documentName: 'Note',
          initialContent: '<p>Init</p>',
          folderId: 'folder-2',
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(editorGetHTMLMock).toHaveBeenCalledTimes(1);
    expect(SAVE_STATE.save).toHaveBeenCalledTimes(1);

    const firstArg = SAVE_STATE.save.mock.calls[0][0] as InstanceType<typeof BlobMock>;
    expect(firstArg).toBeInstanceOf(BlobMock);
    expect(firstArg.type).toBe('text/html');
    await expect(firstArg.text()).resolves.toBe('<p>saved html</p>');

    expect(TOAST_SUCCESS).toHaveBeenCalledWith('Document enregistré');
    expect(TOAST_ERROR).not.toHaveBeenCalled();
  });

  it('passe en erreur de sauvegarde manuelle quand le service échoue et affiche le toast d’erreur', async () => {
    SAVE_STATE.save.mockRejectedValueOnce(new Error('save failed'));

    const { result } = renderHook(
      () =>
        useCollaborativeEditor({
          documentId: 'doc-3',
          documentName: 'Rapport',
          initialContent: '',
          folderId: null,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(editorGetHTMLMock).toHaveBeenCalledTimes(1);
    expect(SAVE_STATE.save).toHaveBeenCalledTimes(1);
    expect(TOAST_ERROR).toHaveBeenCalledWith('Erreur lors de la sauvegarde');
    expect(TOAST_SUCCESS).not.toHaveBeenCalled();
  });

  it('déclenche l’auto-save après une mise à jour Yjs et sauvegarde le HTML courant', async () => {
    renderHook(
      () =>
        useCollaborativeEditor({
          documentId: 'doc-4',
          documentName: 'AutoSave',
          initialContent: '',
          folderId: 'folder-4',
        }),
      { wrapper: createWrapper() },
    );

    const ydoc = ydocInstances[0];

    act(() => {
      ydoc.__emitUpdate();
    });

    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(editorGetHTMLMock).toHaveBeenCalledTimes(1);
    expect(SAVE_STATE.save).toHaveBeenCalledTimes(1);

    const blob = SAVE_STATE.save.mock.calls[0][0] as InstanceType<typeof BlobMock>;
    expect(blob).toBeInstanceOf(BlobMock);
    expect(blob.type).toBe('text/html');
    await expect(blob.text()).resolves.toBe('<p>saved html</p>');
  });

  it('ne charge pas le contenu initial si le document Yjs contient déjà du contenu', () => {
    renderHook(
      () =>
        useCollaborativeEditor({
          documentId: 'doc-5',
          documentName: 'Déjà rempli',
          initialContent: '<p>Initial</p>',
          folderId: 'folder-5',
        }),
      { wrapper: createWrapper() },
    );

    const provider = providerInstances[0];
    const ydoc = ydocInstances[0];

    act(() => {
      ydoc.__setXmlLength(2);
      provider.__emitSynced();
    });

    expect(editorSetContentMock).not.toHaveBeenCalled();
  });

  it('n’effectue pas de sauvegarde manuelle si une sauvegarde est déjà en cours', async () => {
    SAVE_STATE.isSaving = true;

    const { result } = renderHook(
      () =>
        useCollaborativeEditor({
          documentId: 'doc-6',
          documentName: 'Busy',
          initialContent: '',
          folderId: 'folder-6',
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleSave();
    });

    expect(editorGetHTMLMock).not.toHaveBeenCalled();
    expect(SAVE_STATE.save).not.toHaveBeenCalled();
    expect(TOAST_SUCCESS).not.toHaveBeenCalled();
    expect(TOAST_ERROR).not.toHaveBeenCalled();
  });
});