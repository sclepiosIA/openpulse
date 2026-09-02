/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';

const { EMAIL_COUNTS_RESULT, mockUseEmailCounts } = vi.hoisted(() => ({
  EMAIL_COUNTS_RESULT: {
    unreadCount: 4,
    unprocessedCount: 7,
  },
  mockUseEmailCounts: vi.fn(),
}));

vi.mock('./useEmailCounts', () => ({
  useEmailCounts: mockUseEmailCounts,
}));

import { useEmailUnprocessedCount } from './useEmailUnprocessedCount';

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

describe('useEmailUnprocessedCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne la valeur unprocessedCount provenant de useEmailCounts', () => {
    mockUseEmailCounts.mockReturnValue(EMAIL_COUNTS_RESULT);

    const { result } = renderHook(() => useEmailUnprocessedCount(), {
      wrapper: createWrapper(),
    });

    expect(mockUseEmailCounts).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(7);
  });

  it('restitue une autre valeur métier exacte si le count change', () => {
    mockUseEmailCounts.mockReturnValue({
      unreadCount: 12,
      unprocessedCount: 0,
    });

    const { result } = renderHook(() => useEmailUnprocessedCount(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBe(0);
    expect(mockUseEmailCounts).toHaveBeenCalledTimes(1);
  });

  it('propage une erreur si useEmailCounts échoue', () => {
    mockUseEmailCounts.mockImplementation(() => {
      throw new Error('x');
    });

    expect(() =>
      renderHook(() => useEmailUnprocessedCount(), {
        wrapper: createWrapper(),
      })
    ).toThrow('x');
  });
});