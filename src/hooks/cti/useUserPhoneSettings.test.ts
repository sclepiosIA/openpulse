// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserPhoneSettings } from './useUserPhoneSettings';

const {
  SETTINGS_ROW,
  mockFrom,
  mockSelect,
  mockEq,
  mockMaybeSingle,
} = vi.hoisted(() => {
  const SETTINGS_ROW = {
    sip_uri: 'sip:alice@example.org',
    sip_username: 'alice',
    sip_domain: 'example.org',
    sip_proxy: 'proxy.example.org',
    sip_transport: 'tls',
    caller_id: '+331234567',
    is_active: true,
    record_calls: false,
  };

  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockMaybeSingle = vi.fn();

  return {
    SETTINGS_ROW,
    mockFrom,
    mockSelect,
    mockEq,
    mockMaybeSingle,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: mockSelect,
    eq: mockEq,
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: mockMaybeSingle,
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(mockMaybeSingle()).then(onFulfilled, onRejected);
    },
    catch(onRejected: (reason: unknown) => unknown) {
      return Promise.resolve(mockMaybeSingle()).catch(onRejected);
    },
  };

  mockSelect.mockImplementation(() => builder);
  mockEq.mockImplementation(() => builder);
  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
    },
  };
});

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

describe('useUserPhoneSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne null immédiatement et ne lance pas la requête quand userId est undefined', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useUserPhoneSettings(undefined), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('charge puis retourne les réglages téléphoniques de l’utilisateur', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: SETTINGS_ROW,
      error: null,
    });

    const wrapper = createWrapper();

    const { result } = renderHook(() => useUserPhoneSettings('user-1'), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('user_phone_settings');
    expect(mockSelect).toHaveBeenCalledWith(
      'sip_uri, sip_username, sip_domain, sip_proxy, sip_transport, caller_id, is_active, record_calls'
    );
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);

    expect(result.current.data).toEqual({
      sip_uri: 'sip:alice@example.org',
      sip_username: 'alice',
      sip_domain: 'example.org',
      sip_proxy: 'proxy.example.org',
      sip_transport: 'tls',
      caller_id: '+331234567',
      is_active: true,
      record_calls: false,
    });
  });

  it('retourne null avec succès quand aucun réglage n’existe', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const wrapper = createWrapper();

    const { result } = renderHook(() => useUserPhoneSettings('user-2'), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-2');
  });

  it('passe en erreur quand supabase rejette la requête', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('x'));

    const wrapper = createWrapper();

    const { result } = renderHook(() => useUserPhoneSettings('user-3'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('user_phone_settings');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-3');
  });
});