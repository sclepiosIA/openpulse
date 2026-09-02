/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEnrichmentHistory, useEnrichProspect } from './useEnrichProspect';

const {
  HISTORY_ROWS,
  HISTORY_ERROR,
  INVOKE_SUCCESS,
  INVOKE_EMPTY,
  AUTH_STATE,
  mockFrom,
  mockInvoke,
  toastSuccess,
  toastError,
  toastWarning,
  historySuccessBuilder,
  historyErrorBuilder,
} = vi.hoisted(() => {
  const HISTORY_ROWS_VALUE = [
    {
      id: 'log-1',
      etablissement_id: 'eta-1',
      source: 'apollo',
      trigger: 'manual_button',
      success: true,
      data_returned: { website: 'acme.test', phone: '0102030405' },
      fields_updated: ['website', 'phone'],
      error_message: null,
      duration_ms: 321,
      created_at: '2024-01-02T10:00:00.000Z',
    },
    {
      id: 'log-2',
      etablissement_id: 'eta-1',
      source: 'pappers',
      trigger: 'manual_button',
      success: false,
      data_returned: {},
      fields_updated: [],
      error_message: 'no data',
      duration_ms: 210,
      created_at: '2024-01-01T10:00:00.000Z',
    },
  ];

  const HISTORY_ERROR_VALUE = { message: 'x' };
  const INVOKE_SUCCESS_VALUE = { ok: true, fields_updated: ['website', 'phone'] };
  const INVOKE_EMPTY_VALUE = { ok: false, fields_updated: [], error: 'Aucune donnée trouvée' };
  const AUTH_STATE_VALUE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const makeBuilder = (result: { data: unknown; error: unknown }) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (
        onFulfilled?: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
    };
    return builder;
  };

  return {
    HISTORY_ROWS: HISTORY_ROWS_VALUE,
    HISTORY_ERROR: HISTORY_ERROR_VALUE,
    INVOKE_SUCCESS: INVOKE_SUCCESS_VALUE,
    INVOKE_EMPTY: INVOKE_EMPTY_VALUE,
    AUTH_STATE: AUTH_STATE_VALUE,
    mockFrom: vi.fn(),
    mockInvoke: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
    toastWarning: vi.fn(),
    historySuccessBuilder: makeBuilder({ data: HISTORY_ROWS_VALUE, error: null }),
    historyErrorBuilder: makeBuilder({ data: null, error: HISTORY_ERROR_VALUE }),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
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

  return function Wrapper(props: React.PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useEnrichProspect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => historySuccessBuilder);
  });

  it('charge puis retourne l’historique d’enrichissement avec les valeurs métier attendues', async () => {
    mockFrom.mockImplementation(() => historySuccessBuilder);

    const { result } = renderHook(() => useEnrichmentHistory('eta-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('prospect_enrichment_log');
    expect(historySuccessBuilder.select).toHaveBeenCalledWith('*');
    expect(historySuccessBuilder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1');
    expect(historySuccessBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(historySuccessBuilder.limit).toHaveBeenCalledWith(20);

    expect(result.current.data).toEqual(HISTORY_ROWS);
    expect(result.current.data?.[0]).toMatchObject({
      id: 'log-1',
      etablissement_id: 'eta-1',
      source: 'apollo',
      trigger: 'manual_button',
      success: true,
      fields_updated: ['website', 'phone'],
      error_message: null,
      duration_ms: 321,
    });
    expect(result.current.data?.[0].data_returned).toEqual({ website: 'acme.test', phone: '0102030405' });
    expect(result.current.data?.[1]).toMatchObject({
      id: 'log-2',
      success: false,
      error_message: 'no data',
      fields_updated: [],
    });
  });

  it('passe en erreur quand la récupération de l’historique échoue', async () => {
    mockFrom.mockImplementation(() => historyErrorBuilder);

    const { result } = renderHook(() => useEnrichmentHistory('eta-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('prospect_enrichment_log');
    expect(historyErrorBuilder.eq).toHaveBeenCalledWith('etablissement_id', 'eta-1');
    expect(result.current.error?.message).toBe('x');
  });

  it('déclenche l’enrichissement, invalide les queries et affiche un toast succès avec le bon nombre de champs', async () => {
    mockInvoke.mockResolvedValue({ data: INVOKE_SUCCESS, error: null });

    const invalidateQueries = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

    const { result } = renderHook(() => useEnrichProspect(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('eta-1');
    });

    expect(mockInvoke).toHaveBeenCalledWith('enrich-prospect', {
      body: { etablissement_id: 'eta-1', trigger: 'manual_button' },
    });
    expect(toastSuccess).toHaveBeenCalledWith('Prospect enrichi : 2 champs mis à jour');
    expect(toastWarning).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissement', 'eta-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['etablissements'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['enrichment-log', 'eta-1'] });

    invalidateQueries.mockRestore();
  });

  it('affiche un warning quand l’enrichissement réussit sans donnée exploitable', async () => {
    mockInvoke.mockResolvedValue({ data: INVOKE_EMPTY, error: null });

    const { result } = renderHook(() => useEnrichProspect(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('eta-1');
    });

    expect(mockInvoke).toHaveBeenCalledWith('enrich-prospect', {
      body: { etablissement_id: 'eta-1', trigger: 'manual_button' },
    });
    expect(toastWarning).toHaveBeenCalledWith('Aucune donnée trouvée');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('passe en erreur et affiche le toast adéquat quand l’edge function échoue', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'x' } });

    const { result } = renderHook(() => useEnrichProspect(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('eta-1')).rejects.toEqual({ message: 'x' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockInvoke).toHaveBeenCalledWith('enrich-prospect', {
      body: { etablissement_id: 'eta-1', trigger: 'manual_button' },
    });
    expect(result.current.error?.message).toBe('x');
    expect(toastError).toHaveBeenCalledWith('Échec enrichissement : x');
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastWarning).not.toHaveBeenCalled();
  });
});