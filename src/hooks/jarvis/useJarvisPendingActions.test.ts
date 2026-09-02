/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useJarvisPendingActions } from './useJarvisPendingActions';

const {
  PENDING_ROWS,
  USER,
  TOAST_FN,
  mockFrom,
  mockInvoke,
  mockDebugError,
  mockSanitizeSupabaseError,
} = vi.hoisted(() => ({
  PENDING_ROWS: [
    {
      id: 'a1',
      user_id: 'u1',
      trigger_type: 'manual',
      trigger_entity_type: 'ticket',
      trigger_entity_id: 't1',
      proposed_action: { type: 'send_email' },
      context: { subject: 'Relance' },
      ai_response: { ok: true },
      status: 'pending',
      expires_at: '2099-01-01T00:00:00.000Z',
      created_at: '2099-01-01T10:00:00.000Z',
      reviewed_at: null,
      user_feedback: null,
      feedback_rating: null,
      kb_sources: [],
    },
    {
      id: 'a2',
      user_id: 'u1',
      trigger_type: 'auto',
      trigger_entity_type: 'task',
      trigger_entity_id: 't2',
      proposed_action: { type: 'create_task' },
      context: { title: 'Suivi' },
      ai_response: { ok: true },
      status: 'pending',
      expires_at: '2099-01-02T00:00:00.000Z',
      created_at: '2099-01-01T09:00:00.000Z',
      reviewed_at: null,
      user_feedback: null,
      feedback_rating: null,
      kb_sources: [],
    },
  ],
  USER: { id: 'u1', email: 't@t.co' },
  TOAST_FN: vi.fn(),
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
  mockDebugError: vi.fn(),
  mockSanitizeSupabaseError: vi.fn(),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitizeSupabaseError,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}));

function createBuilder(config?: {
  selectResult?: { data: unknown; error: unknown };
  updateResult?: { data?: unknown; error: unknown };
}) {
  const state = {
    mode: 'select' as 'select' | 'update',
    selectResult: config?.selectResult ?? { data: PENDING_ROWS, error: null },
    updateResult: config?.updateResult ?? { error: null },
  };

  const builder = {
    select: vi.fn(() => {
      state.mode = 'select';
      return builder;
    }),
    eq: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => {
      state.mode = 'update';
      return builder;
    }),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => (state.mode === 'update' ? state.updateResult : state.selectResult)),
    maybeSingle: vi.fn(async () => (state.mode === 'update' ? state.updateResult : state.selectResult)),
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      const payload = state.mode === 'update' ? state.updateResult : state.selectResult;
      return Promise.resolve(payload).then(onFulfilled, onRejected);
    },
    catch: (onRejected: (reason: unknown) => unknown) => {
      const payload = state.mode === 'update' ? state.updateResult : state.selectResult;
      return Promise.resolve(payload).catch(onRejected);
    },
  };

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useJarvisPendingActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSanitizeSupabaseError.mockReturnValue('Erreur nettoyée');
  });

  it('charge puis retourne les actions en attente avec le bon compte', async () => {
    const builder = createBuilder({
      selectResult: { data: PENDING_ROWS, error: null },
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useJarvisPendingActions(USER.id), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.pendingActions).toEqual([]);
    expect(result.current.pendingCount).toBe(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('jarvis_pending_actions');
    expect(builder.select).toHaveBeenCalledWith(
      'id, user_id, trigger_type, trigger_entity_type, trigger_entity_id, proposed_action, context, ai_response, status, expires_at, created_at, reviewed_at, user_feedback, feedback_rating, kb_sources'
    );
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'user_id', USER.id);
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
    expect(builder.gt).toHaveBeenCalledWith('expires_at', expect.any(String));
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(result.current.pendingActions).toEqual(PENDING_ROWS);
    expect(result.current.pendingCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('ne lance pas la requête et retourne des valeurs vides sans userId', async () => {
    const { result } = renderHook(() => useJarvisPendingActions(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.pendingActions).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('passe en erreur si la requête supabase échoue', async () => {
    const error = { message: 'x' };
    const builder = createBuilder({
      selectResult: { data: null, error },
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useJarvisPendingActions(USER.id), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.pendingActions).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(mockDebugError).toHaveBeenCalledWith('[useJarvisPendingActions] Error:', error);
  });

  it('approuve une action, appelle la function et affiche un toast métier', async () => {
    const builder = createBuilder({
      selectResult: { data: PENDING_ROWS, error: null },
    });
    mockFrom.mockReturnValue(builder);
    mockInvoke.mockResolvedValue({ data: { action_type: 'send_email' }, error: null });

    const { result } = renderHook(() => useJarvisPendingActions(USER.id), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.approveAction('a1');
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-execute', {
      body: { action_id: 'a1', user_id: USER.id },
    });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: '✅ Action exécutée',
      description: 'Email envoyé avec succès',
    });
  });

  it('rejette une action avec une raison et met à jour la table', async () => {
    const builder = createBuilder({
      selectResult: { data: PENDING_ROWS, error: null },
      updateResult: { error: null },
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useJarvisPendingActions(USER.id), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.rejectAction('a2', 'Pas pertinent');
    });

    expect(mockFrom).toHaveBeenCalledWith('jarvis_pending_actions');
    expect(builder.update).toHaveBeenCalledWith({
      status: 'rejected',
      reviewed_at: expect.any(String),
      user_feedback: 'Pas pertinent',
    });
    expect(builder.eq).toHaveBeenNthCalledWith(3, 'id', 'a2');
    expect(builder.eq).toHaveBeenNthCalledWith(4, 'user_id', USER.id);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Action ignorée',
      description: 'La suggestion a été rejetée',
    });
  });

  it('modifie puis approuve une action avec les modifications fournies', async () => {
    const builder = createBuilder({
      selectResult: { data: PENDING_ROWS, error: null },
    });
    mockFrom.mockReturnValue(builder);
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });

    const { result } = renderHook(() => useJarvisPendingActions(USER.id), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.modifyAndApprove('a1', { subject: 'Nouveau sujet', urgent: true });
    });

    expect(mockInvoke).toHaveBeenCalledWith('jarvis-execute', {
      body: {
        action_id: 'a1',
        user_id: USER.id,
        modifications: { subject: 'Nouveau sujet', urgent: true },
      },
    });
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: '✅ Action modifiée et exécutée',
      description: 'Vos modifications ont été prises en compte',
    });
  });

  it('soumet un feedback avec note et commentaire', async () => {
    const builder = createBuilder({
      selectResult: { data: PENDING_ROWS, error: null },
      updateResult: { error: null },
    });
    mockFrom.mockReturnValue(builder);

    const { result } = renderHook(() => useJarvisPendingActions(USER.id), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.submitFeedback('a1', 4, 'Très utile');
    });

    expect(builder.update).toHaveBeenCalledWith({
      feedback_rating: 4,
      user_feedback: 'Très utile',
    });
    expect(builder.eq).toHaveBeenNthCalledWith(3, 'id', 'a1');
    expect(builder.eq).toHaveBeenNthCalledWith(4, 'user_id', USER.id);
    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Merci pour votre retour',
      description: 'Votre feedback aide à améliorer Jarvis',
    });
  });

  it('affiche un toast destructif si l’approbation échoue', async () => {
    const builder = createBuilder({
      selectResult: { data: PENDING_ROWS, error: null },
    });
    const invokeError = new Error('x');

    mockFrom.mockReturnValue(builder);
    mockInvoke.mockResolvedValue({ data: null, error: invokeError });

    const { result } = renderHook(() => useJarvisPendingActions(USER.id), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.approveAction('a1')).rejects.toThrow('x');
    });

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalledWith(invokeError);
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur nettoyée',
      variant: 'destructive',
    });
  });

  it('retourne une erreur métier si rejet sans utilisateur', async () => {
    const { result } = renderHook(() => useJarvisPendingActions(undefined), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.rejectAction('a1', 'Non')).rejects.toThrow('User not authenticated');
    });

    await waitFor(() => {
      expect(mockSanitizeSupabaseError).toHaveBeenCalled();
    });

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Erreur',
      description: 'Erreur nettoyée',
      variant: 'destructive',
    });
  });
});