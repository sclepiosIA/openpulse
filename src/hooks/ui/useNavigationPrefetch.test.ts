import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  etablissementsRows,
  emailsRows,
  peopleRows,
  revenusRows,
  depensesRows,
  partenairesRows,
  groupesRows,
  rdRows,
  supportRows,
} = vi.hoisted(() => {
  const etablissementsRows = [
    { id: 'e1', nom: 'Etab 1', ville: 'Paris', statut: 'actif', type: 'lycee', progression: 50 },
  ];
  const emailsRows = [
    { id: 'm1', email_address: 'a@b.c', display_name: 'A B', sync_enabled: true },
  ];
  const peopleRows = [
    { id: 'p1', full_name: 'John Doe' },
  ];
  const revenusRows = [
    { montant_prevu: 1000, statut: 'pending' },
  ];
  const depensesRows = [
    { montant: 500, statut: 'paid' },
  ];
  const partenairesRows = [
    { id: 'pa1', nom: 'Part 1', type_partenaire: 'typeA', statut_relation: 'active' },
  ];
  const groupesRows = [
    { id: 'g1', nom: 'Groupe 1', description: 'Desc' },
  ];
  const rdRows = [
    { id: 'r1', nom: 'Projet 1', statut: 'open' },
  ];
  const supportRows = [
    { id: 's1', titre: 'Ticket 1', statut: 'open', priorite: 'high' },
  ];

  return {
    etablissementsRows,
    emailsRows,
    peopleRows,
    revenusRows,
    depensesRows,
    partenairesRows,
    groupesRows,
    rdRows,
    supportRows,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  const buildersByTable: Record<string, any> = {};

  const makeBaseBuilder = () => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: null, error: null });
        return promise.then(onFulfilled, onRejected);
      }),
      catch: vi.fn(function (this: unknown, onRejected: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: null, error: null });
        return promise.catch(onRejected);
      }),
    };
    return builder;
  };

  const makeBuilderForTable = (table: string) => {
    const builder = makeBaseBuilder();

    if (table === 'etablissements') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: etablissementsRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    } else if (table === 'user_email_accounts') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: emailsRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    } else if (table === 'tresorerie_revenus') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: revenusRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    } else if (table === 'tresorerie_depenses') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: depensesRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    } else if (table === 'partenaires') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: partenairesRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    } else if (table === 'groupes_etablissements') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: groupesRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    } else if (table === 'rd_projets') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: rdRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    } else if (table === 'support_tickets') {
      builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const promise = Promise.resolve({ data: supportRows, error: null });
        return promise.then(onFulfilled, onRejected);
      });
    }

    return builder;
  };

  const from = (table: string) => {
    if (!buildersByTable[table]) {
      buildersByTable[table] = makeBuilderForTable(table);
    }
    return buildersByTable[table];
  };

  const rpc = (fnName: string) => {
    const builder = makeBaseBuilder();
    builder.then = vi.fn(function (this: unknown, onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      let data: unknown = null;
      if (fnName === 'get_profiles_public') {
        data = peopleRows;
      }
      const promise = Promise.resolve({ data, error: null });
      return promise.then(onFulfilled, onRejected);
    });
    return builder;
  };

  return {
    supabase: {
      from,
      rpc,
    },
  };
});

import { useNavigationPrefetch } from './useNavigationPrefetch';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };

  return { Wrapper, queryClient };
}

describe('useNavigationPrefetch', () => {
  it('ne fait rien pour un chemin non géré', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/unknown');
    });

    expect(spyPrefetch).not.toHaveBeenCalled();
  });

  it('prefetch les établissements avec les bonnes options', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/etablissements');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['etablissements']);

    const data = await callArg.queryFn();
    expect(data).toEqual(etablissementsRows);
    expect(callArg.staleTime).toBe(60 * 1000);
  });

  it('throttle les appels de prefetch pour le même chemin', async () => {
    vi.useFakeTimers();
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/emails');
      await result.current('/emails');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2100);

    await act(async () => {
      await result.current('/emails');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('prefetch les emails avec le bon queryKey et les données', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/emails');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['email-accounts']);

    const data = await callArg.queryFn();
    expect(data).toEqual(emailsRows);
    expect(callArg.staleTime).toBe(2 * 60 * 1000);
  });

  it('prefetch les profils people via rpc avec le bon queryKey', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/people');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['profiles-team']);

    const data = await callArg.queryFn();
    expect(data).toEqual(peopleRows);
    expect(callArg.staleTime).toBe(5 * 60 * 1000);
  });

  it('prefetch la trésorerie avec revenus et dépenses', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/tresorerie');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['tresorerie-kpis-summary']);

    const data = await callArg.queryFn();
    expect(data).toEqual({ revenus: revenusRows, depenses: depensesRows });
    expect(callArg.staleTime).toBe(2 * 60 * 1000);
  });

  it('prefetch les partenaires', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/partenaires');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['partenaires', 'prefetch-lite']);

    const data = await callArg.queryFn();
    expect(data).toEqual(partenairesRows);
    expect(callArg.staleTime).toBe(60 * 1000);
  });

  it('prefetch les groupes', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/groupes');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['groupes']);

    const data = await callArg.queryFn();
    expect(data).toEqual(groupesRows);
    expect(callArg.staleTime).toBe(60 * 1000);
  });

  it('prefetch les projets R&D', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/rd');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['rd-projets']);

    const data = await callArg.queryFn();
    expect(data).toEqual(rdRows);
    expect(callArg.staleTime).toBe(60 * 1000);
  });

  it('prefetch les tickets de support', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery');

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await result.current('/support');
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
    const callArg = spyPrefetch.mock.calls[0][0];
    expect(callArg.queryKey).toEqual(['support-tickets-preview']);

    const data = await callArg.queryFn();
    expect(data).toEqual(supportRows);
    expect(callArg.staleTime).toBe(60 * 1000);
  });

  it('ignore silencieusement les erreurs de prefetch', async () => {
    const { Wrapper, queryClient } = createWrapper();
    const spyPrefetch = vi.spyOn(queryClient, 'prefetchQuery').mockRejectedValueOnce(new Error('prefetch-fail'));

    const { result } = renderHook(() => useNavigationPrefetch(), { wrapper: Wrapper });

    await act(async () => {
      await expect(result.current('/etablissements')).resolves.toBeUndefined();
    });

    expect(spyPrefetch).toHaveBeenCalledTimes(1);
  });
});