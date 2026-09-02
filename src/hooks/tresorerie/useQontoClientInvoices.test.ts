import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { debugError, mockInvoke, SUCCESS_DATA, ERROR_OBJ } = vi.hoisted(() => {
  const debugError = vi.fn();
  const mockInvoke = vi.fn();

  const SUCCESS_DATA = {
    success: true,
    invoices: [
      {
        id: 'inv1',
        numero: '0001',
        status: 'paid',
        montant_ttc: 100.5,
        currency: 'EUR',
        date_emission: '2024-01-01',
        date_echeance: null,
        client_name: 'Acme Corp',
        client_email: 'billing@acme.example',
        file_url: null,
      },
      {
        id: 'inv2',
        numero: '0002',
        status: 'pending',
        montant_ttc: 49.5,
        currency: 'EUR',
        date_emission: '2024-02-01',
        date_echeance: '2024-03-01',
        client_name: 'Beta LLC',
        client_email: null,
        file_url: 'https://files.example/inv2.pdf',
      },
    ],
    total_a_encaisser: 150,
    count: 2,
    meta: { current_page: 1, total_pages: 1, total_count: 2 },
  };

  const ERROR_OBJ = { message: 'something went wrong' };

  return { debugError, mockInvoke, SUCCESS_DATA, ERROR_OBJ };
});

vi.mock('@/integrations/supabase/client', () => {
  // provide a minimal chainable builder in case other modules call it;
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn((onFulfilled) => onFulfilled({ data: null, error: null })),
    catch: vi.fn(() => builder),
  };

  return {
    supabase: {
      functions: {
        invoke: mockInvoke,
      },
      from: vi.fn(() => builder),
    },
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

import { useQontoClientInvoices } from './useQontoClientInvoices';

describe('useQontoClientInvoices', () => {
  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const wrapper = (client: QueryClient) => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is loading initially while the supabase function is pending', async () => {
    // keep the promise pending to assert loading state
    mockInvoke.mockImplementationOnce(() => new Promise(() => {}));

    const client = createClient();
    const { result, unmount } = renderHook(() => useQontoClientInvoices(), {
      wrapper: wrapper(client),
    });

    // initial state should be loading
    expect(result.current.isLoading).toBe(true);
    // invoices should be empty while loading
    expect(result.current.invoices).toEqual([]);
    // cleanup to avoid leaked pending promise references affecting other tests
    unmount();
  });

  it('returns invoices and metadata on successful response', async () => {
    mockInvoke.mockResolvedValueOnce({ data: SUCCESS_DATA, error: null });

    const client = createClient();
    const { result } = renderHook(() => useQontoClientInvoices(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Business value assertions
    expect(result.current.invoices.length).toBe(2);
    expect(result.current.invoices[0].id).toBe('inv1');
    expect(result.current.invoices[0].client_name).toBe('Acme Corp');
    expect(result.current.invoices[1].file_url).toBe('https://files.example/inv2.pdf');

    expect(result.current.totalAEncaisser).toBe(150);
    expect(result.current.count).toBe(2);

    // should not be in error state
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('handles supabase function error and surfaces it via isError and error message, and logs via debug.error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: ERROR_OBJ });

    const client = createClient();
    const { result } = renderHook(() => useQontoClientInvoices(), {
      wrapper: wrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // When supabase returns an error object, the hook marks isError true and returns the error message
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(ERROR_OBJ.message);

    // debug.error should have been called with the expected prefix and the error object
    expect(debugError).toHaveBeenCalledTimes(1);
    expect(debugError).toHaveBeenCalledWith('[useQontoClientInvoices] Error:', ERROR_OBJ);

    // ensures no invoices are exposed on error
    expect(result.current.invoices).toEqual([]);
    expect(result.current.totalAEncaisser).toBe(0);
    expect(result.current.count).toBe(0);
  });
});