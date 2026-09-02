import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

const { mockFrom, mockUpdate, mockEq, mockSupabaseError, THREAD_ID, PRIORITY_HIGH, builder, errorBuilder } =
  vi.hoisted(() => {
    const mockUpdate = vi.fn();
    const mockEq = vi.fn();
    const mockFrom = vi.fn();

    const successResponse = Promise.resolve({ data: null, error: null });
    const errorObject = { message: 'update failed' };
    const errorResponse = Promise.resolve({ data: null, error: errorObject });

    const builder: unknown = {
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return builder;
      },
      eq: (...args: unknown[]) => {
        mockEq(...args);
        return successResponse;
      },
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        successResponse.then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        successResponse.catch(onRejected),
    };

    const errorBuilder: unknown = {
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return errorBuilder;
      },
      eq: (...args: unknown[]) => {
        mockEq(...args);
        return errorResponse;
      },
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        errorResponse.then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) =>
        errorResponse.catch(onRejected),
    };

    mockFrom.mockReturnValue(builder);

    const THREAD_ID = 'thread-1';
    const PRIORITY_HIGH = 'high' as const;

    return {
      mockFrom,
      mockUpdate,
      mockEq,
      mockSupabaseError: errorObject,
      THREAD_ID,
      PRIORITY_HIGH,
      builder,
      errorBuilder,
    };
  });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { updateThreadPriority } from './emailThreadMutations';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      props.children,
    );
  };
}

describe('updateThreadPriority', () => {
  it('updates thread priority successfully', async () => {
    mockFrom.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockFrom.mockReturnValue(builder);

    await act(async () => {
      await updateThreadPriority(THREAD_ID, PRIORITY_HIGH);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockUpdate).toHaveBeenCalledWith({ priority: PRIORITY_HIGH });
    expect(mockEq).toHaveBeenCalledWith('id', THREAD_ID);
  });

  it('allows setting priority to null', async () => {
    mockFrom.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockFrom.mockReturnValue(builder);

    await act(async () => {
      await updateThreadPriority(THREAD_ID, null);
    });

    expect(mockUpdate).toHaveBeenCalledWith({ priority: null });
  });

  it('throws when supabase returns an error', async () => {
    mockFrom.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockFrom.mockReturnValue(errorBuilder);

    await expect(
      act(async () => {
        await updateThreadPriority(THREAD_ID, PRIORITY_HIGH);
      }),
    ).rejects.toEqual(mockSupabaseError);
  });

  it('can be used within a react-query-like mutation hook', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        return {
          mutateAsync: (threadId: string, priority: 'high' | 'medium' | 'low' | null) =>
            updateThreadPriority(threadId, priority),
        };
      },
      { wrapper },
    );

    mockFrom.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();
    mockFrom.mockReturnValue(builder);

    await act(async () => {
      await result.current.mutateAsync(THREAD_ID, PRIORITY_HIGH);
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockUpdate).toHaveBeenCalledWith({ priority: PRIORITY_HIGH });
    expect(mockEq).toHaveBeenCalledWith('id', THREAD_ID);
  });
});