/* @vitest-environment jsdom */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailNavigation } from './useEmailNavigation';

const {
  THREADS,
  DRAFT,
  AUTH_STATE,
  EMAIL_CONTEXT_DEFAULT,
  EMAIL_CONTEXT_FIRST,
  EMAIL_CONTEXT_LAST,
  EMAIL_CONTEXT_NONE,
  mockUseEmailContext,
  selectThreadSpy,
  startComposingSpy,
  editDraftSpy,
  goBackSpy,
  mockNavigate,
  toastSuccess,
  toastError,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const THREADS = [
    { id: 't1', subject: 'Sujet 1' },
    { id: 't2', subject: 'Sujet 2' },
    { id: 't3', subject: 'Sujet 3' },
  ];

  const DRAFT = {
    id: 'd1',
    subject: 'Brouillon',
    body: 'Contenu',
  };

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const selectThreadSpy = vi.fn();
  const startComposingSpy = vi.fn();
  const editDraftSpy = vi.fn();
  const goBackSpy = vi.fn();
  const mockUseEmailContext = vi.fn();
  const mockNavigate = vi.fn();
  const toastSuccess = vi.fn();
  const toastError = vi.fn();

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onFulfilled?: (value: { data: null; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => builder);
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockResolvedValue({ data: null, error: null });

  const mockFrom = vi.fn(() => builder);

  const EMAIL_CONTEXT_DEFAULT = {
    state: {
      threads: THREADS,
      selectedThread: 't2',
      composing: false,
      draftToEdit: null,
    },
    actions: {
      selectThread: selectThreadSpy,
      startComposing: startComposingSpy,
      editDraft: editDraftSpy,
      goBack: goBackSpy,
    },
  };

  const EMAIL_CONTEXT_FIRST = {
    state: {
      threads: THREADS,
      selectedThread: 't1',
      composing: false,
      draftToEdit: null,
    },
    actions: {
      selectThread: selectThreadSpy,
      startComposing: startComposingSpy,
      editDraft: editDraftSpy,
      goBack: goBackSpy,
    },
  };

  const EMAIL_CONTEXT_LAST = {
    state: {
      threads: THREADS,
      selectedThread: 't3',
      composing: false,
      draftToEdit: null,
    },
    actions: {
      selectThread: selectThreadSpy,
      startComposing: startComposingSpy,
      editDraft: editDraftSpy,
      goBack: goBackSpy,
    },
  };

  const EMAIL_CONTEXT_NONE = {
    state: {
      threads: THREADS,
      selectedThread: null,
      composing: true,
      draftToEdit: DRAFT,
    },
    actions: {
      selectThread: selectThreadSpy,
      startComposing: startComposingSpy,
      editDraft: editDraftSpy,
      goBack: goBackSpy,
    },
  };

  return {
    THREADS,
    DRAFT,
    AUTH_STATE,
    EMAIL_CONTEXT_DEFAULT,
    EMAIL_CONTEXT_FIRST,
    EMAIL_CONTEXT_LAST,
    EMAIL_CONTEXT_NONE,
    mockUseEmailContext,
    selectThreadSpy,
    startComposingSpy,
    editDraftSpy,
    goBackSpy,
    mockNavigate,
    toastSuccess,
    toastError,
    mockFrom,
    builder,
  };
});

vi.mock('@/contexts/EmailContext', () => ({
  useEmailContext: mockUseEmailContext,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

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

describe('useEmailNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEmailContext.mockReturnValue(EMAIL_CONTEXT_DEFAULT);
  });

  it('expose les valeurs métier du contexte sélectionné au succès', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    expect(result.current.selectedThread).toBe('t2');
    expect(result.current.composing).toBe(false);
    expect(result.current.draftToEdit).toBeNull();
    expect(result.current.canGoPrevious).toBe(true);
    expect(result.current.canGoNext).toBe(true);
  });

  it('selectThread utilise le sujet du thread quand aucun sujet explicite n’est fourni', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.selectThread('t1');
    });

    expect(selectThreadSpy).toHaveBeenCalledTimes(1);
    expect(selectThreadSpy).toHaveBeenCalledWith('t1', 'Sujet 1');
  });

  it('selectThread privilégie le sujet explicite fourni', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.selectThread('t1', 'Sujet forcé');
    });

    expect(selectThreadSpy).toHaveBeenCalledTimes(1);
    expect(selectThreadSpy).toHaveBeenCalledWith('t1', 'Sujet forcé');
  });

  it('closeThread désélectionne le thread courant', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.closeThread();
    });

    expect(selectThreadSpy).toHaveBeenCalledTimes(1);
    expect(selectThreadSpy).toHaveBeenCalledWith(null);
  });

  it('startComposing déclenche l’action dédiée', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.startComposing();
    });

    expect(startComposingSpy).toHaveBeenCalledTimes(1);
  });

  it('editDraft transmet le brouillon à éditer', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.editDraft(DRAFT);
    });

    expect(editDraftSpy).toHaveBeenCalledTimes(1);
    expect(editDraftSpy).toHaveBeenCalledWith(DRAFT);
  });

  it('goBack déclenche le retour de navigation', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.goBack();
    });

    expect(goBackSpy).toHaveBeenCalledTimes(1);
  });

  it('selectNextThread sélectionne le thread suivant avec son sujet', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.selectNextThread();
    });

    expect(selectThreadSpy).toHaveBeenCalledTimes(1);
    expect(selectThreadSpy).toHaveBeenCalledWith('t3', 'Sujet 3');
  });

  it('selectPreviousThread sélectionne le thread précédent avec son sujet', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    await act(async () => {
      result.current.selectPreviousThread();
    });

    expect(selectThreadSpy).toHaveBeenCalledTimes(1);
    expect(selectThreadSpy).toHaveBeenCalledWith('t1', 'Sujet 1');
  });

  it('désactive la navigation précédente sur le premier thread et ne déclenche aucune action', async () => {
    mockUseEmailContext.mockReturnValue(EMAIL_CONTEXT_FIRST);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    expect(result.current.selectedThread).toBe('t1');
    expect(result.current.canGoPrevious).toBe(false);
    expect(result.current.canGoNext).toBe(true);

    await act(async () => {
      result.current.selectPreviousThread();
    });

    expect(selectThreadSpy).not.toHaveBeenCalled();
  });

  it('désactive la navigation suivante sur le dernier thread et ne déclenche aucune action', async () => {
    mockUseEmailContext.mockReturnValue(EMAIL_CONTEXT_LAST);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    expect(result.current.selectedThread).toBe('t3');
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(true);

    await act(async () => {
      result.current.selectNextThread();
    });

    expect(selectThreadSpy).not.toHaveBeenCalled();
  });

  it('retourne canGoNext et canGoPrevious à false quand aucun thread n’est sélectionné', () => {
    mockUseEmailContext.mockReturnValue(EMAIL_CONTEXT_NONE);
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEmailNavigation(), { wrapper });

    expect(result.current.selectedThread).toBeNull();
    expect(result.current.composing).toBe(true);
    expect(result.current.draftToEdit).toBe(DRAFT);
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
  });

  it('lance une erreur si le contexte email échoue', () => {
    const expectedError = new Error('x');
    mockUseEmailContext.mockImplementation(() => {
      throw expectedError;
    });

    const wrapper = createWrapper();

    expect(() => renderHook(() => useEmailNavigation(), { wrapper })).toThrow('x');
  });
});