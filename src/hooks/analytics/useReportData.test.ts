import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useReportData } from './useReportData';

const { REPORT_DATA, mockRpc } = vi.hoisted(() => {
  const REPORT_DATA = {
    columns: ['mois', 'total'],
    rows: [
      { mois: '2024-01', total: 42 },
      { mois: '2024-02', total: 58 },
    ],
  };
  return { REPORT_DATA, mockRpc: vi.fn() };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
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

describe('useReportData', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('est en chargement puis retourne les données du rapport en cas de succès', async () => {
    mockRpc.mockResolvedValue({ data: REPORT_DATA, error: null });

    const { result } = renderHook(
      () =>
        useReportData({
          source: 'ventes' as never,
          filters: { period: '2024' } as never,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(REPORT_DATA);
    expect(result.current.data?.rows).toHaveLength(2);
    expect(result.current.data?.rows[0]).toEqual({ mois: '2024-01', total: 42 });
  });

  it('appelle supabase.rpc avec source_key et params sérialisés', async () => {
    mockRpc.mockResolvedValue({ data: REPORT_DATA, error: null });

    const { result } = renderHook(
      () =>
        useReportData({
          source: 'ventes' as never,
          filters: { period: '2024', region: 'EU' } as never,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_report_data', {
      source_key: 'ventes',
      params: { period: '2024', region: 'EU' },
    });
  });

  it('envoie un objet params vide quand filters est absent', async () => {
    mockRpc.mockResolvedValue({ data: REPORT_DATA, error: null });

    const { result } = renderHook(
      () => useReportData({ source: 'ventes' as never }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRpc).toHaveBeenCalledWith('get_report_data', {
      source_key: 'ventes',
      params: {},
    });
  });

  it('passe en erreur quand le rpc retourne une erreur (avec 1 retry défini dans le hook)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(
      () => useReportData({ source: 'ventes' as never }),
      { wrapper: createWrapper() }
    );

    // Le hook définit retry: 1, donc la requête est rejouée une fois avant l'échec final.
    await waitFor(() => expect(result.current.isError).toBe(true), {
      timeout: 8000,
    });

    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledTimes(2);
  }, 10000);

  it('ne déclenche pas la requête quand source est absent', () => {
    const { result } = renderHook(() => useReportData({}), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isPending).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('ne déclenche pas la requête quand enabled est false', () => {
    const { result } = renderHook(
      () => useReportData({ source: 'ventes' as never, enabled: false }),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isPending).toBe(true);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});