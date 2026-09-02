import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailThreadActions } from './useEmailThreadActions';

const { mockFrom, mockUpdate, mockEq, mockInvoke, mockToast, mockSanitize, state } = vi.hoisted(() => {
  const state = {
    result: { data: null as unknown, error: null as unknown },
  };
  const builder: Record<string, unknown> = {};
  const mockUpdate = vi.fn(() => builder);
  const mockEq = vi.fn(() => builder);
  const chainMethods = ['select', 'insert', 'delete', 'gte', 'lte', 'in', 'order', 'limit'];
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.update = mockUpdate;
  builder.eq = mockEq;
  builder.single = vi.fn(() => Promise.resolve(state.result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(state.result));
  builder.then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (e: unknown) => unknown
  ) => Promise.resolve(state.result).then(onFulfilled, onRejected);
  builder.catch = (onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(state.result).catch(onRejected);

  const mockFrom = vi.fn(() => builder);
  const mockInvoke = vi.fn(() => Promise.resolve({ data: { ok: true }, error: null }));
  const mockToast = vi.fn();
  const mockSanitize = vi.fn(() => 'erreur nettoyée');

  return { mockFrom, mockUpdate, mockEq, mockInvoke, mockToast, mockSanitize, state };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: mockSanitize,
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

describe('useEmailThreadActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = { data: null, error: null };
  });

  it('expose toutes les actions et les flags isPending à false initialement', () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current.archiveThread).toBe('function');
    expect(typeof result.current.markAsSpam).toBe('function');
    expect(typeof result.current.markAsProcessed).toBe('function');
    expect(typeof result.current.markAsRead).toBe('function');
    expect(typeof result.current.updateTags).toBe('function');
    expect(typeof result.current.deleteThread).toBe('function');
    expect(typeof result.current.forwardEmail).toBe('function');
    expect(typeof result.current.toggleStar).toBe('function');
    expect(result.current.isArchiving).toBe(false);
    expect(result.current.isMarkingSpam).toBe(false);
    expect(result.current.isMarkingProcessed).toBe(false);
    expect(result.current.isMarkingRead).toBe(false);
    expect(result.current.isUpdatingTags).toBe(false);
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.isForwarding).toBe(false);
    expect(result.current.isTogglingStar).toBe(false);
  });

  it('archiveThread met à jour is_archived et affiche le toast de succès', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.archiveThread({ threadId: 't1', archived: true });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Conversation archivée',
        description: 'La conversation a été déplacée vers les archives',
      });
    });
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockUpdate).toHaveBeenCalledWith({ is_archived: true });
    expect(mockEq).toHaveBeenCalledWith('id', 't1');
  });

  it('archiveThread affiche un toast destructif en cas d\'erreur supabase', async () => {
    state.result = { data: null, error: { message: 'x' } };
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.archiveThread({ threadId: 't1', archived: true });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erreur',
        description: 'erreur nettoyée',
        variant: 'destructive',
      });
    });
    expect(mockSanitize).toHaveBeenCalledWith({ message: 'x' });
  });

  it('markAsSpam met à jour is_spam et affiche le toast correspondant', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.markAsSpam({ threadId: 't2', isSpam: true });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Marqué comme spam',
        description: 'La conversation a été marquée comme spam',
      });
    });
    expect(mockUpdate).toHaveBeenCalledWith({ is_spam: true });
    expect(mockEq).toHaveBeenCalledWith('id', 't2');
  });

  it('markAsProcessed envoie is_processed, processed_by et force unread_count à 0', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.markAsProcessed({ threadId: 't3', processed: true, userId: 'u1' });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Marqué comme traité',
        description: 'Cette conversation est maintenant traitée',
      });
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        is_processed: true,
        processed_by: 'u1',
        unread_count: 0,
        processed_at: expect.any(String),
      })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 't3');
  });

  it('markAsRead met unread_count à 0 et met aussi à jour email_messages', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.markAsRead({ threadId: 't4', read: true });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Marqué comme lu' });
    });
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockFrom).toHaveBeenCalledWith('email_messages');
    expect(mockUpdate).toHaveBeenCalledWith({ unread_count: 0 });
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true });
    expect(mockEq).toHaveBeenCalledWith('thread_id', 't4');
    expect(mockEq).toHaveBeenCalledWith('is_read', false);
  });

  it('updateTags met à jour les tags et affiche le toast de succès', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.updateTags({ threadId: 't5', tags: ['urgent', 'client'] });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Tags mis à jour',
        description: 'Les tags ont été modifiés avec succès',
      });
    });
    expect(mockUpdate).toHaveBeenCalledWith({ tags: ['urgent', 'client'] });
    expect(mockEq).toHaveBeenCalledWith('id', 't5');
  });

  it('deleteThread fait un soft delete (is_deleted: true)', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.deleteThread({ threadId: 't6' });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Conversation supprimée' });
    });
    expect(mockUpdate).toHaveBeenCalledWith({ is_deleted: true });
    expect(mockEq).toHaveBeenCalledWith('id', 't6');
  });

  it('forwardEmail invoque la fonction edge forward-email avec le bon body', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.forwardEmail({
        messageId: 'm1',
        toAddresses: ['dest@example.com'],
        additionalContent: 'FYI',
      });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Email transféré',
        description: "L'email a été transféré avec succès",
      });
    });
    expect(mockInvoke).toHaveBeenCalledWith('forward-email', {
      body: {
        message_id: 'm1',
        to_addresses: ['dest@example.com'],
        additional_content: 'FYI',
      },
    });
  });

  it('forwardEmail affiche un toast d\'erreur si la fonction edge échoue', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.forwardEmail({ messageId: 'm2', toAddresses: ['a@b.co'] });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Erreur de transfert',
        description: 'erreur nettoyée',
        variant: 'destructive',
      });
    });
  });

  it('toggleStar met priority à high quand starred est true', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.toggleStar({ threadId: 't7', starred: true });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Ajouté aux favoris' });
    });
    expect(mockUpdate).toHaveBeenCalledWith({ priority: 'high' });
    expect(mockEq).toHaveBeenCalledWith('id', 't7');
  });

  it('toggleStar remet priority à null quand starred est false', async () => {
    const { result } = renderHook(() => useEmailThreadActions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.toggleStar({ threadId: 't8', starred: false });
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Retiré des favoris' });
    });
    expect(mockUpdate).toHaveBeenCalledWith({ priority: null });
  });
});