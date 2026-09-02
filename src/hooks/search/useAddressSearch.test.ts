import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { SUCCESS_DATA, RES_OK, RES_ERR, fetchMock, mockUseDebounce } = vi.hoisted(() => {
  type AddressSuggestion = {
    display_name: string;
    lat: string;
    lon: string;
    place_id: number;
    address?: Record<string, unknown>;
  };

  const SUCCESS_DATA: AddressSuggestion[] = [
    {
      display_name: 'Paris, France',
      lat: '48.8566',
      lon: '2.3522',
      place_id: 1,
      address: { city: 'Paris', postcode: '75000', country: 'France' },
    },
    {
      display_name: 'Paris 2, France',
      lat: '48.8570',
      lon: '2.3530',
      place_id: 2,
      address: { town: 'Paris', country: 'France' },
    },
  ];

  const okJson = vi.fn().mockResolvedValue(SUCCESS_DATA);
  const RES_OK = { ok: true, status: 200, json: okJson };

  const errJson = vi.fn().mockResolvedValue(null);
  const RES_ERR = { ok: false, status: 500, json: errJson };

  const fetchMock = vi.fn();
  const mockUseDebounce = vi.fn();

  return { SUCCESS_DATA, RES_OK, RES_ERR, fetchMock, mockUseDebounce };
});

vi.mock('@/hooks/shared/useDebounce', () => ({ useDebounce: mockUseDebounce }));

vi.stubGlobal('fetch', fetchMock);

import { useAddressSearch } from './useAddressSearch';

describe('useAddressSearch', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
    });
    return React.createElement(QueryClientProvider, { client }, children);
  };

  beforeEach(() => {
    fetchMock.mockClear();
    mockUseDebounce.mockClear();
    // default behavior: identity debounce
    mockUseDebounce.mockImplementation((q: string) => q);
  });

  it('returns empty suggestions and not loading when debounced query is too short or disabled', async () => {
    // debounced value shorter than 3 chars
    mockUseDebounce.mockReturnValueOnce('ab');
    const { result } = renderHook(() => useAddressSearch('ab', true), { wrapper });

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    // also when enabled = false
    mockUseDebounce.mockReturnValueOnce('paris'); // even if debounced long enough
    const { result: res2 } = renderHook(() => useAddressSearch('paris', false), { wrapper });
    expect(res2.current.suggestions).toEqual([]);
    expect(res2.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches suggestions and updates loading and suggestions on success', async () => {
    mockUseDebounce.mockReturnValueOnce('paris');
    fetchMock.mockResolvedValueOnce(RES_OK);

    const { result } = renderHook(() => useAddressSearch('paris', true), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const calledUrl = call[0] as string;
    const calledOptions = call[1] as Record<string, unknown>;
    expect(typeof calledUrl).toBe('string');
    expect(calledUrl).toContain('q=paris');
    expect(calledUrl).toContain('format=json');
    expect(calledUrl).toContain('limit=5');
    expect(calledUrl).toContain('addressdetails=1');
    expect(calledUrl).toContain('accept-language=fr');
    expect(calledOptions).toBeDefined();
    expect((calledOptions.signal as AbortSignal) !== undefined).toBe(true);
    expect(calledOptions.headers).toBeDefined();
    // headers typed as unknown, but we assert the Accept header value
    const headers = calledOptions.headers as Record<string, string> | undefined;
    expect(headers).toBeDefined();
    expect(headers?.Accept).toBe('application/json');

    // suggestions should match the mocked SUCCESS_DATA exactly
    expect(result.current.suggestions).toEqual(SUCCESS_DATA);
  });

  it('handles non-ok response by clearing suggestions and not throwing', async () => {
    mockUseDebounce.mockReturnValueOnce('errorq');
    fetchMock.mockResolvedValueOnce(RES_ERR);

    const { result } = renderHook(() => useAddressSearch('errorq', true), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.suggestions).toEqual([]);
  });
});