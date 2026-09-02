import React from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  toastMock,
  toastApi,
  safeStorageSetItemMock,
  safeStorageRemoveItemMock,
  safeStorageApi,
  debugLogMock,
  debugErrorMock,
  debugApi,
} = vi.hoisted(() => {
  const toast = vi.fn();
  const safeStorage = {
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const debug = {
    log: vi.fn(),
    error: vi.fn(),
  };

  return {
    toastMock: toast,
    toastApi: { toast },
    safeStorageSetItemMock: safeStorage.setItem,
    safeStorageRemoveItemMock: safeStorage.removeItem,
    safeStorageApi: safeStorage,
    debugLogMock: debug.log,
    debugErrorMock: debug.error,
    debugApi: debug,
  };
});

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => toastApi,
}));

vi.mock('@/lib/safeStorage', () => ({
  safeStorage: safeStorageApi,
}));

vi.mock('@/lib/debug', () => ({
  debug: debugApi,
}));

import { useDraftRecovery, type DraftSnapshot } from './useDraftRecovery';

const STORAGE_KEY = 'email-draft-backup';
const DIRTY_FLAG = 'email-compose-dirty';
const NOW = new Date('2024-01-01T00:00:00.000Z');

type DraftFields = Parameters<typeof useDraftRecovery>[0];
type DraftSetters = Parameters<typeof useDraftRecovery>[1];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

const createFields = (overrides: Partial<DraftFields> = {}): DraftFields => ({
  to: [],
  cc: [],
  bcc: [],
  subject: '',
  body: '',
  accountId: 'acct-1',
  ...overrides,
});

const createSetters = (): DraftSetters => ({
  setTo: vi.fn<(v: string[]) => void>(),
  setCc: vi.fn<(v: string[]) => void>(),
  setBcc: vi.fn<(v: string[]) => void>(),
  setSubject: vi.fn<(v: string) => void>(),
  setBody: vi.fn<(v: string) => void>(),
});

const readSnapshot = (): DraftSnapshot => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    throw new Error('Snapshot manquant');
  }
  return JSON.parse(raw) as DraftSnapshot;
};

describe('useDraftRecovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('restaure un brouillon récent et notifie l’utilisateur', () => {
    const setters = createSetters();
    const fields = createFields();
    const snapshot: DraftSnapshot = {
      to: ['alice@example.test'],
      cc: ['bob@example.test'],
      bcc: ['carol@example.test'],
      subject: 'Compte rendu',
      body: 'Bonjour, voici le compte rendu.',
      accountId: 'acct-42',
      ts: NOW.getTime() - 5 * 60 * 1000,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    const { result, rerender } = renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: fields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    expect(setters.setTo).toHaveBeenCalledWith(['alice@example.test']);
    expect(setters.setCc).toHaveBeenCalledWith(['bob@example.test']);
    expect(setters.setBcc).toHaveBeenCalledWith(['carol@example.test']);
    expect(setters.setSubject).toHaveBeenCalledWith('Compte rendu');
    expect(setters.setBody).toHaveBeenCalledWith('Bonjour, voici le compte rendu.');
    expect(toastMock).toHaveBeenCalledWith({
      title: '✏️ Brouillon récupéré',
      description: 'Votre message précédent a été restauré automatiquement',
    });
    expect(debugLogMock).toHaveBeenCalledTimes(1);

    rerender({ currentFields: fields, hasInitialData: false });

    expect(result.current.wasRestored).toBe(true);
  });

  it('supprime le snapshot sans restaurer quand des données initiales existent déjà', () => {
    const setters = createSetters();
    const fields = createFields({ subject: 'Sujet initial' });
    const snapshot: DraftSnapshot = {
      to: ['saved@example.test'],
      cc: [],
      bcc: [],
      subject: 'Sujet sauvegardé',
      body: 'Corps sauvegardé',
      accountId: 'acct-1',
      ts: NOW.getTime(),
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: fields, hasInitialData: true },
        wrapper: createWrapper(),
      },
    );

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(safeStorageRemoveItemMock).toHaveBeenCalledWith(DIRTY_FLAG);
    expect(setters.setSubject).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('supprime un brouillon expiré de plus de trente minutes', () => {
    const setters = createSetters();
    const fields = createFields();
    const expiredSnapshot: DraftSnapshot = {
      to: ['old@example.test'],
      cc: [],
      bcc: [],
      subject: 'Ancien sujet',
      body: 'Ancien contenu',
      accountId: 'acct-old',
      ts: NOW.getTime() - 31 * 60 * 1000,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(expiredSnapshot));

    renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: fields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(safeStorageRemoveItemMock).toHaveBeenCalledWith(DIRTY_FLAG);
    expect(setters.setTo).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('supprime un snapshot vide sans restaurer ni notifier', () => {
    const setters = createSetters();
    const fields = createFields();
    const emptySnapshot: DraftSnapshot = {
      to: [],
      cc: ['copy@example.test'],
      bcc: ['hidden@example.test'],
      subject: '',
      body: '',
      accountId: 'acct-empty',
      ts: NOW.getTime(),
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(emptySnapshot));

    renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: fields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(safeStorageRemoveItemMock).toHaveBeenCalledWith(DIRTY_FLAG);
    expect(setters.setCc).not.toHaveBeenCalled();
    expect(setters.setBcc).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('sauvegarde un brouillon sale après le délai de debounce', () => {
    const setters = createSetters();
    const initialFields = createFields();
    const dirtyFields = createFields({
      to: ['dest@example.test'],
      cc: ['copy@example.test'],
      bcc: ['hidden@example.test'],
      subject: 'Proposition',
      body: 'Voici la proposition mise à jour.',
      accountId: 'acct-save',
    });

    const { rerender } = renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: initialFields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    act(() => {
      rerender({ currentFields: dirtyFields, hasInitialData: false });
    });

    expect(safeStorageSetItemMock).toHaveBeenCalledWith(DIRTY_FLAG, '1');
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const saved = readSnapshot();
    expect(saved).toEqual({
      to: ['dest@example.test'],
      cc: ['copy@example.test'],
      bcc: ['hidden@example.test'],
      subject: 'Proposition',
      body: 'Voici la proposition mise à jour.',
      accountId: 'acct-save',
      ts: NOW.getTime() + 1000,
    });
  });

  it('remplace le timer de sauvegarde quand les champs changent avant la fin du debounce', () => {
    const setters = createSetters();
    const initialFields = createFields();
    const firstDirtyFields = createFields({
      to: ['first@example.test'],
      subject: 'Première version',
      body: 'Texte initial.',
      accountId: 'acct-debounce',
    });
    const secondDirtyFields = createFields({
      to: ['second@example.test'],
      subject: 'Deuxième version',
      body: 'Texte final.',
      accountId: 'acct-debounce',
    });

    const { rerender } = renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: initialFields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    act(() => {
      rerender({ currentFields: firstDirtyFields, hasInitialData: false });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      rerender({ currentFields: secondDirtyFields, hasInitialData: false });
    });

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const saved = readSnapshot();
    expect(saved.to).toEqual(['second@example.test']);
    expect(saved.subject).toBe('Deuxième version');
    expect(saved.body).toBe('Texte final.');
    expect(saved.ts).toBe(NOW.getTime() + 1500);
  });

  it('efface le dirty flag quand le brouillon redevient vide', () => {
    const setters = createSetters();
    const initialFields = createFields();
    const dirtyFields = createFields({
      to: ['dest@example.test'],
      subject: 'Sujet temporaire',
      body: 'Texte temporaire',
    });
    const cleanFields = createFields();

    const { rerender } = renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: initialFields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    act(() => {
      rerender({ currentFields: dirtyFields, hasInitialData: false });
    });

    expect(safeStorageSetItemMock).toHaveBeenCalledWith(DIRTY_FLAG, '1');

    act(() => {
      rerender({ currentFields: cleanFields, hasInitialData: false });
    });

    expect(safeStorageRemoveItemMock).toHaveBeenCalledWith(DIRTY_FLAG);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('expose clearSnapshot pour supprimer le brouillon et le dirty flag', () => {
    const setters = createSetters();
    const fields = createFields();
    const snapshot: DraftSnapshot = {
      to: ['clear@example.test'],
      cc: [],
      bcc: [],
      subject: 'À supprimer',
      body: 'Contenu à supprimer',
      accountId: 'acct-clear',
      ts: NOW.getTime(),
    };

    const { result } = renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: fields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    act(() => {
      result.current.clearSnapshot();
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(safeStorageRemoveItemMock).toHaveBeenCalledWith(DIRTY_FLAG);
  });

  it('active une protection beforeunload quand le formulaire contient un brouillon', () => {
    const setters = createSetters();
    const dirtyFields = createFields({
      to: ['leave@example.test'],
      subject: 'Brouillon en cours',
      body: 'Ne pas perdre ce texte.',
    });

    renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: dirtyFields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe(false);
  });

  it('n’active pas la protection beforeunload quand le formulaire est vide', () => {
    const setters = createSetters();
    const fields = createFields();

    renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: fields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('journalise une erreur quand la restauration échoue sur un JSON invalide', () => {
    const setters = createSetters();
    const fields = createFields();

    sessionStorage.setItem(STORAGE_KEY, '{json-invalide');

    renderHook(
      ({ currentFields, hasInitialData }) => useDraftRecovery(currentFields, setters, hasInitialData),
      {
        initialProps: { currentFields: fields, hasInitialData: false },
        wrapper: createWrapper(),
      },
    );

    expect(debugErrorMock).toHaveBeenCalledTimes(1);
    expect(debugErrorMock.mock.calls[0]).toEqual([
      '[DraftRecovery] Restore failed:',
      expect.objectContaining({ name: 'SyntaxError' }),
    ]);
    expect(setters.setTo).not.toHaveBeenCalled();
    expect(toastMock).not.toHaveBeenCalled();
  });
});