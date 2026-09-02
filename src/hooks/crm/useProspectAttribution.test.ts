import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  mockRpc,
  mockFrom,
  mockSelect,
  mockEq,
  mockOrder,
  mockLimit,
  successfulAttributionResult,
  successfulTouchpoints,
  errorObject,
} = vi.hoisted(() => {
  const successfulAttributionResult = {
    model: 'time_decay',
    by_channel: { email: 0.7, ads: 0.3 },
    by_user: { u1: 1 },
    first_touch: { channel: 'email', weight: 0.6 },
    last_touch: { channel: 'ads', weight: 0.4 },
  };

  const successfulTouchpoints = [
    {
      id: 'tp1',
      etablissement_id: 'etab1',
      channel: 'email',
      occurred_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'tp2',
      etablissement_id: 'etab1',
      channel: 'ads',
      occurred_at: '2024-01-02T10:00:00Z',
    },
  ];

  const errorObject = { message: 'rpc failed' };

  const mockRpc = vi.fn();
  const mockSelect = vi.fn();
  const mockEq = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockFrom = vi.fn();

  return {
    mockRpc,
    mockFrom,
    mockSelect,
    mockEq,
    mockOrder,
    mockLimit,
    successfulAttributionResult,
    successfulTouchpoints,
    errorObject,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const buildThenable = (result: unknown, error: unknown = null) => {
    const response = { data: result, error };
    const thenable = {
      then(onFulfilled: (value: typeof response) => unknown) {
        try {
          const v = onFulfilled(response);
          return Promise.resolve(v);
        } catch (e) {
          return Promise.reject(e);
        }
      },
      catch(onRejected: (reason: unknown) => unknown) {
        if (error) {
          const v = onRejected(error);
          return Promise.resolve(v);
        }
        return Promise.resolve(response);
      },
    };
    return thenable;
  };

  const builder: Record<string, unknown> = {};

  builder.select = mockSelect.mockImplementation(() => builder);
  builder.eq = mockEq.mockImplementation(() => builder);
  builder.order = mockOrder.mockImplementation(() => builder);
  builder.limit = mockLimit.mockImplementation((limitValue: number) =>
    buildThenable(successfulTouchpoints.slice(0, limitValue), null)
  );

  mockFrom.mockImplementation(() => builder);

  mockRpc.mockImplementation((fnName: string, params: unknown) => {
    if (fnName === 'compute_attribution') {
      return Promise.resolve({
        data: successfulAttributionResult,
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  return {
    supabase: {
      rpc: mockRpc,
      from: mockFrom,
    },
  };
});

// Mocks génériques pour d'autres imports éventuels
vi.mock('@/components/AuthProvider', () => ({}));
vi.mock('@/contexts/AuthContext', () => ({}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }),
}));
vi.mock('@/hooks/useAdminRole', () => ({
  useAdminRole: () => true,
}));
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import { useProspectAttribution, useAttributionTouchpoints } from './useProspectAttribution';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      props.children
    );
  }

  return Wrapper;
}

describe('useProspectAttribution', () => {
  it('reste désactivé tant que etablissementId est undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useProspectAttribution(undefined, 'time_decay'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('charge puis retourne un résultat métier en succès', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useProspectAttribution('etab1', 'time_decay'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('compute_attribution', {
      _etablissement_id: 'etab1',
      _model: 'time_decay',
    });

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(data?.model).toBe('time_decay');
    expect(data?.by_channel.email).toBeCloseTo(0.7);
    expect(data?.by_channel.ads).toBeCloseTo(0.3);
    expect(data?.by_user.u1).toBe(1);
    expect(data?.first_touch?.channel).toBe('email');
    expect(data?.last_touch?.channel).toBe('ads');
  });

  it('utilise le modèle par défaut time_decay quand model est omis', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useProspectAttribution('etab2'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRpc).toHaveBeenCalledWith('compute_attribution', {
      _etablissement_id: 'etab2',
      _model: 'time_decay',
    });
  });

  it('passe en état erreur quand le RPC renvoie une erreur', async () => {
    const wrapper = createWrapper();

    mockRpc.mockImplementationOnce(() =>
      Promise.resolve({
        data: null,
        error: errorObject,
      })
    );

    const { result } = renderHook(
      () => useProspectAttribution('etab_err', 'time_decay'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toHaveProperty('message', 'rpc failed');
  });
});

describe('useAttributionTouchpoints', () => {
  it('reste désactivé quand etablissementId est undefined', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useAttributionTouchpoints(undefined, 10),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('charge les touchpoints puis retourne les données ordonnées', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useAttributionTouchpoints('etab1', 20),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('attribution_touchpoints');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('etablissement_id', 'etab1');
    expect(mockOrder).toHaveBeenCalledWith('occurred_at', { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(20);

    const data = result.current.data;
    expect(data).toHaveLength(successfulTouchpoints.length);
    expect(data?.[0].id).toBe('tp1');
    expect(data?.[1].channel).toBe('ads');
  });

  it('passe en état erreur quand la requête Supabase échoue', async () => {
    const wrapper = createWrapper();

    const failingBuilder: Record<string, unknown> = {};
    failingBuilder.select = mockSelect.mockImplementation(() => failingBuilder);
    failingBuilder.eq = mockEq.mockImplementation(() => failingBuilder);
    failingBuilder.order = mockOrder.mockImplementation(() => failingBuilder);
    failingBuilder.limit = mockLimit.mockImplementation(() => {
      return {
        then(onFulfilled: (value: { data: unknown; error: unknown }) => unknown) {
          const payload = { data: null, error: errorObject };
          const v = onFulfilled(payload);
          return Promise.resolve(v);
        },
        catch(onRejected: (reason: unknown) => unknown) {
          const v = onRejected(errorObject);
          return Promise.resolve(v);
        },
      };
    });

    mockFrom.mockImplementationOnce(() => failingBuilder);

    const { result } = renderHook(
      () => useAttributionTouchpoints('etab_err', 5),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toHaveProperty('message', 'rpc failed');
  });
});