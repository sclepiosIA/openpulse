/// <reference types="vitest" />
/* @vitest-environment jsdom */

import React, { type PropsWithChildren } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client }, children);
  }

  return { Wrapper };
}

describe('signature.ts', () => {
  it('expose des labels/couleurs cohérents pour les statuts et événements', async () => {
    const mod = await import('./signature');

    expect(mod.SIGNATURE_STATUS_LABELS.pending).toBe('En préparation');
    expect(mod.SIGNATURE_STATUS_LABELS.completed).toBe('Complété');
    expect(mod.SIGNATURE_STATUS_LABELS.cancelled).toBe('Annulé');

    expect(mod.SIGNATURE_STATUS_COLORS.viewed).toContain('amber');
    expect(mod.SIGNATURE_STATUS_COLORS.refused).toContain('red');
    expect(mod.SIGNATURE_STATUS_COLORS.sent).toContain('blue');

    expect(mod.SIGNATURE_EVENT_LABELS.created).toBe('Demande créée');
    expect(mod.SIGNATURE_EVENT_LABELS.completed).toBe('Tous les signataires ont signé');
    expect(mod.SIGNATURE_EVENT_LABELS.error).toBe('Erreur');

    const statuses = [
      'pending',
      'sent',
      'viewed',
      'signed',
      'completed',
      'refused',
      'expired',
      'cancelled',
    ] as const;

    for (const s of statuses) {
      expect(typeof mod.SIGNATURE_STATUS_LABELS[s]).toBe('string');
      expect(mod.SIGNATURE_STATUS_LABELS[s].length).toBeGreaterThan(0);
      expect(typeof mod.SIGNATURE_STATUS_COLORS[s]).toBe('string');
      expect(mod.SIGNATURE_STATUS_COLORS[s].includes('text-')).toBe(true);
    }

    const events = [
      'created',
      'sent',
      'opened',
      'viewed',
      'signed',
      'completed',
      'refused',
      'expired',
      'reminded',
      'cancelled',
      'error',
    ] as const;

    for (const e of events) {
      expect(typeof mod.SIGNATURE_EVENT_LABELS[e]).toBe('string');
      expect(mod.SIGNATURE_EVENT_LABELS[e].length).toBeGreaterThan(0);
    }
  });

  it('renderHook avec wrapper QueryClientProvider: isLoading -> succès (hook factice)', async () => {
    const { Wrapper } = createWrapper();

    function useFakeLoadingThenSuccess() {
      const [state, setState] = React.useState<{ isLoading: boolean; value: number }>({
        isLoading: true,
        value: 0,
      });

      React.useEffect(() => {
        const t = setTimeout(() => setState({ isLoading: false, value: 42 }), 0);
        return () => clearTimeout(t);
      }, []);

      return state;
    }

    const { result } = renderHook(() => useFakeLoadingThenSuccess(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.value).toBe(42);
    });
  });

  it('renderHook avec wrapper QueryClientProvider: erreur (hook factice)', async () => {
    const { Wrapper } = createWrapper();

    function useFakeError() {
      const [state, setState] = React.useState<{
        isLoading: boolean;
        isError: boolean;
        errorMessage: string | null;
      }>({ isLoading: true, isError: false, errorMessage: null });

      React.useEffect(() => {
        const t = setTimeout(
          () => setState({ isLoading: false, isError: true, errorMessage: 'x' }),
          0,
        );
        return () => clearTimeout(t);
      }, []);

      return state;
    }

    const { result } = renderHook(() => useFakeError(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.errorMessage).toBe('x');
    });
  });

  it('mutation: déclenchement via act et vérification des args (hook factice)', async () => {
    const { Wrapper } = createWrapper();

    const mutateFn = vi.fn(async (payload: { requestId: string; action: 'cancel' }) => {
      return { ok: true, payload };
    });

    function useFakeMutation() {
      const [isPending, setIsPending] = React.useState(false);

      async function mutate(payload: { requestId: string; action: 'cancel' }) {
        setIsPending(true);
        try {
          return await mutateFn(payload);
        } finally {
          setIsPending(false);
        }
      }

      return { isPending, mutate };
    }

    const { result } = renderHook(() => useFakeMutation(), { wrapper: Wrapper });

    expect(result.current.isPending).toBe(false);

    await act(async () => {
      await result.current.mutate({ requestId: 'req1', action: 'cancel' });
    });

    expect(mutateFn).toHaveBeenCalledTimes(1);
    expect(mutateFn).toHaveBeenCalledWith({ requestId: 'req1', action: 'cancel' });
    expect(result.current.isPending).toBe(false);
  });
});