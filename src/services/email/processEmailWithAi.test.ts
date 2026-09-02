// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { fetchScannableThreads, processEmailWithAi } from './processEmailWithAi';

const {
  THREADS,
  INVOKE_SUCCESS,
  INVOKE_EMPTY,
  invokeMock,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const THREADS = [
    {
      id: 'thread-1',
      subject: 'Sujet A',
      etablissement_id: 'eta-1',
      partenaire_id: null,
      last_message_date: '2026-06-02T10:00:00.000Z',
    },
    {
      id: 'thread-2',
      subject: 'Sujet B',
      etablissement_id: null,
      partenaire_id: 'part-1',
      last_message_date: '2026-06-02T09:00:00.000Z',
    },
  ];

  const INVOKE_SUCCESS = {
    tasks_created: 2,
    tasks_updated: 1,
    contacts_created: 3,
    extra_info: 'ok',
  };

  const INVOKE_EMPTY = {};

  const builderState = {
    data: THREADS as Array<{
      id: string;
      subject: string | null;
      etablissement_id: string | null;
      partenaire_id: string | null;
      last_message_date: string | null;
    }> | null,
    error: null as { message: string } | null,
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: builderState.data, error: builderState.error })),
    maybeSingle: vi.fn(async () => ({ data: builderState.data, error: builderState.error })),
    then: (onFulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) =>
      Promise.resolve({ data: builderState.data, error: builderState.error }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: builderState.data, error: builderState.error }).catch(onRejected),
    __setResult: (data: typeof builderState.data, error: typeof builderState.error) => {
      builderState.data = data;
      builderState.error = error;
    },
  };

  const invokeState = {
    data: INVOKE_SUCCESS as Record<string, unknown> | null,
    error: null as { message: string } | null,
  };

  const invokeMock = vi.fn(async () => ({ data: invokeState.data, error: invokeState.error }));
  invokeMock.mockImplementation(async () => ({ data: invokeState.data, error: invokeState.error }));
  (invokeMock as unknown as { __setResult?: (data: typeof invokeState.data, error: typeof invokeState.error) => void }).__setResult =
    (data, error) => {
      invokeState.data = data;
      invokeState.error = error;
    };

  const mockFrom = vi.fn(() => builder);

  return {
    THREADS,
    INVOKE_SUCCESS,
    INVOKE_EMPTY,
    invokeMock,
    mockFrom,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: invokeMock,
    },
  },
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

describe('processEmailWithAi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builder.__setResult(THREADS, null);
    (
      invokeMock as unknown as {
        __setResult: (data: Record<string, unknown> | null, error: { message: string } | null) => void;
      }
    ).__setResult(INVOKE_SUCCESS, null);
  });

  it('appelle l’edge function avec le bon nom et le bon body puis retourne le résultat métier', async () => {
    const result = await processEmailWithAi({
      threadId: 'thread-123',
      forceReprocess: true,
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('process-email-with-ai', {
      body: {
        thread_id: 'thread-123',
        force_reprocess: true,
      },
    });
    expect(result).toEqual({
      tasks_created: 2,
      tasks_updated: 1,
      contacts_created: 3,
      extra_info: 'ok',
    });
    expect(result.tasks_created).toBe(2);
    expect(result.tasks_updated).toBe(1);
    expect(result.contacts_created).toBe(3);
  });

  it('utilise forceReprocess à false par défaut', async () => {
    await processEmailWithAi({
      threadId: 'thread-default',
    });

    expect(invokeMock).toHaveBeenCalledWith('process-email-with-ai', {
      body: {
        thread_id: 'thread-default',
        force_reprocess: false,
      },
    });
  });

  it('retourne un objet vide si data est null', async () => {
    (
      invokeMock as unknown as {
        __setResult: (data: Record<string, unknown> | null, error: { message: string } | null) => void;
      }
    ).__setResult(null, null);

    const result = await processEmailWithAi({
      threadId: 'thread-empty',
    });

    expect(result).toEqual({});
  });

  it('propage l’erreur de l’edge function', async () => {
    (
      invokeMock as unknown as {
        __setResult: (data: Record<string, unknown> | null, error: { message: string } | null) => void;
      }
    ).__setResult(null, { message: 'x' });

    await expect(
      processEmailWithAi({
        threadId: 'thread-error',
      }),
    ).rejects.toMatchObject({ message: 'x' });
  });
});

describe('fetchScannableThreads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builder.__setResult(THREADS, null);
  });

  it('construit la requête Supabase attendue et retourne les threads scannables', async () => {
    const now = new Date('2026-06-02T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const result = await fetchScannableThreads(24);

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(builder.select).toHaveBeenCalledWith(
      'id, subject, etablissement_id, partenaire_id, last_message_date',
    );
    expect(builder.gte).toHaveBeenCalledWith('last_message_date', '2026-06-01T12:00:00.000Z');
    expect(builder.or).toHaveBeenCalledWith(
      'etablissement_id.not.is.null,partenaire_id.not.is.null',
    );
    expect(builder.order).toHaveBeenCalledWith('last_message_date', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(100);

    expect(result).toEqual(THREADS);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'thread-1',
      subject: 'Sujet A',
      etablissement_id: 'eta-1',
      partenaire_id: null,
    });
    expect(result[1]).toMatchObject({
      id: 'thread-2',
      subject: 'Sujet B',
      etablissement_id: null,
      partenaire_id: 'part-1',
    });

    vi.useRealTimers();
  });

  it('retourne un tableau vide si data est null', async () => {
    builder.__setResult(null, null);

    const result = await fetchScannableThreads(6);

    expect(result).toEqual([]);
  });

  it('lève une erreur explicite si Supabase retourne une erreur', async () => {
    builder.__setResult(null, { message: 'x' });

    await expect(fetchScannableThreads(12)).rejects.toThrow('Erreur de récupération: x');
  });
});

describe('intégration avec renderHook et QueryClientProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    builder.__setResult(THREADS, null);
    (
      invokeMock as unknown as {
        __setResult: (data: Record<string, unknown> | null, error: { message: string } | null) => void;
      }
    ).__setResult(INVOKE_SUCCESS, null);
  });

  it('couvre chargement puis succès pour processEmailWithAi via un hook de test', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState<{
          isLoading: boolean;
          isError: boolean;
          data: Record<string, unknown> | null;
          error: Error | null;
        }>({
          isLoading: true,
          isError: false,
          data: null,
          error: null,
        });

        React.useEffect(() => {
          processEmailWithAi({ threadId: 'thread-hook', forceReprocess: true })
            .then((data) => {
              setState({
                isLoading: false,
                isError: false,
                data,
                error: null,
              });
            })
            .catch((error: Error) => {
              setState({
                isLoading: false,
                isError: true,
                data: null,
                error,
              });
            });
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual(INVOKE_SUCCESS);
    expect(result.current.data?.tasks_created).toBe(2);
    expect(result.current.data?.tasks_updated).toBe(1);
    expect(result.current.data?.contacts_created).toBe(3);
    expect(invokeMock).toHaveBeenCalledWith('process-email-with-ai', {
      body: {
        thread_id: 'thread-hook',
        force_reprocess: true,
      },
    });
  });

  it('couvre le chemin isError pour processEmailWithAi via un hook de test', async () => {
    const wrapper = createWrapper();
    (
      invokeMock as unknown as {
        __setResult: (data: Record<string, unknown> | null, error: { message: string } | null) => void;
      }
    ).__setResult(null, { message: 'x' });

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState<{
          isLoading: boolean;
          isError: boolean;
          data: Record<string, unknown> | null;
          error: Error | { message: string } | null;
        }>({
          isLoading: true,
          isError: false,
          data: null,
          error: null,
        });

        React.useEffect(() => {
          processEmailWithAi({ threadId: 'thread-hook-error' })
            .then((data) => {
              setState({
                isLoading: false,
                isError: false,
                data,
                error: null,
              });
            })
            .catch((error: { message: string }) => {
              setState({
                isLoading: false,
                isError: true,
                data: null,
                error,
              });
            });
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toMatchObject({ message: 'x' });
  });
});