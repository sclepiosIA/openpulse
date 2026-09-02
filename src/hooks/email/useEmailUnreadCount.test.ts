const { LOADING_STATE, SUCCESS_STATE, ERROR_STATE, CURRENT, mockUseEmailCounts } = vi.hoisted(() => {
  const LOADING_STATE = { unreadCount: 0, isLoading: true, isError: false };
  const SUCCESS_STATE = { unreadCount: 7, isLoading: false, isError: false };
  const ERROR_STATE = { unreadCount: 0, isLoading: false, isError: true, error: { message: 'x' } };
  const CURRENT = { value: LOADING_STATE };
  const mockUseEmailCounts = vi.fn(() => CURRENT.value);
  return { LOADING_STATE, SUCCESS_STATE, ERROR_STATE, CURRENT, mockUseEmailCounts };
});

vi.mock('./useEmailCounts', () => ({ useEmailCounts: mockUseEmailCounts }));

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEmailUnreadCount } from './useEmailUnreadCount';

describe('useEmailUnreadCount', () => {
  let queryClient;
  let wrapper;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

    wrapper = ({ children }) => React.createElement(QueryClientProvider, { client: queryClient }, children);

    mockUseEmailCounts.mockClear();
  });

  it('returns the unreadCount while loading then updates to the success value', () => {
    // start in loading
    CURRENT.value = LOADING_STATE;

    const { result, rerender } = renderHook(() => useEmailUnreadCount(), { wrapper });

    // while loading, unreadCount from the underlying hook should be the loading state's value
    expect(result.current).toBe(LOADING_STATE.unreadCount);
    expect(mockUseEmailCounts).toHaveBeenCalled();

    // move to success state and rerender
    act(() => {
      CURRENT.value = SUCCESS_STATE;
      rerender();
    });

    // now the returned unreadCount must reflect the success state's business value
    expect(result.current).toBe(SUCCESS_STATE.unreadCount);
    expect(mockUseEmailCounts).toHaveBeenCalled();
  });

  it('reflects error state provided by the underlying hook (data null, error present)', () => {
    // simulate underlying hook returning an error shape
    CURRENT.value = ERROR_STATE;

    const { result } = renderHook(() => useEmailUnreadCount(), { wrapper });

    // the returned unreadCount should equal the value provided in the error state (business value)
    expect(result.current).toBe(ERROR_STATE.unreadCount);

    // ensure the underlying mock returned an error object with the expected message
    const lastResultValue = mockUseEmailCounts.mock.results.at(-1)?.value;
    expect(lastResultValue).toBeDefined();
    expect(lastResultValue.error).toBeDefined();
    expect(lastResultValue.error.message).toBe('x');
  });
});