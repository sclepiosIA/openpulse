/* @vitest-environment jsdom */

import React, { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmailClassificationStats } from './useEmailClassificationStats';

type QueryError = { message: string } | null;
type QueryResult = {
  data: unknown;
  error: QueryError;
  count: number | null;
};

const {
  TOTAL_COUNT,
  ETAB_COUNT,
  PART_COUNT,
  GROUPE_COUNT,
  HORS_COUNT,
  INTERNE_COUNT,
  CLASSIFIED_COUNT,
  SUGGESTIONS_ROWS,
  DOMAINS_ROWS,
  THREAD_COUNTS_ROWS,
  RECENT_THREADS_ROWS,
  RECENT_SUGGESTIONS_ROWS,
  mockFrom,
} = vi.hoisted(() => {
  const now = new Date();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return `${d.toISOString().split('T')[0]}T12:00:00.000Z`;
  };

  return {
    TOTAL_COUNT: 20,
    ETAB_COUNT: 8,
    PART_COUNT: 3,
    GROUPE_COUNT: 2,
    HORS_COUNT: 1,
    INTERNE_COUNT: 4,
    CLASSIFIED_COUNT: 15,
    SUGGESTIONS_ROWS: [
      { status: 'pending', match_confidence: 80, created_at: day(-2) },
      { status: 'accepted', match_confidence: 60, created_at: day(-1) },
      { status: 'accepted', match_confidence: 100, created_at: day(0) },
      { status: 'rejected', match_confidence: 40, created_at: day(0) },
    ],
    DOMAINS_ROWS: [
      {
        domain: 'alpha.fr',
        confidence_level: 'high',
        etablissement: { id: 'e1', nom: 'Alpha Clinic' },
      },
      {
        domain: 'beta.fr',
        confidence_level: 'medium',
        etablissement: [{ id: 'e2', nom: 'Beta Center' }],
      },
      {
        domain: 'unknown.fr',
        confidence_level: null,
        etablissement: null,
      },
    ],
    THREAD_COUNTS_ROWS: [
      { etablissement_id: 'e1' },
      { etablissement_id: 'e1' },
      { etablissement_id: 'e1' },
      { etablissement_id: 'e2' },
    ],
    RECENT_THREADS_ROWS: [
      { etablissement_id: 'e1', created_at: day(-6) },
      { etablissement_id: 'e1', created_at: day(-6) },
      { etablissement_id: null, created_at: day(-6) },
      { etablissement_id: 'e2', created_at: day(-3) },
      { etablissement_id: 'e2', created_at: day(0) },
    ],
    RECENT_SUGGESTIONS_ROWS: [
      { created_at: day(-6) },
      { created_at: day(-1) },
      { created_at: day(-1) },
      { created_at: day(0) },
    ],
    mockFrom: vi.fn(),
  };
});

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createThenableBuilder(executor: () => Promise<QueryResult>) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => executor()),
    maybeSingle: vi.fn(() => executor()),
    then: (
      onFulfilled?: ((value: QueryResult) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => executor().then(onFulfilled ?? undefined, onRejected ?? undefined),
    catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
      executor().catch(onRejected ?? undefined),
    finally: (onFinally?: (() => void) | null) => executor().finally(onFinally ?? undefined),
  };

  return builder;
}

function makeCountBuilder(count: number, error: QueryError = null) {
  return createThenableBuilder(async () => ({
    data: null,
    error,
    count,
  }));
}

function makeDataBuilder(data: unknown, error: QueryError = null) {
  return createThenableBuilder(async () => ({
    data,
    error,
    count: null,
  }));
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useEmailClassificationStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passe de isLoading à succès et calcule les statistiques métier correctement', async () => {
    mockFrom
      .mockImplementationOnce(() => makeCountBuilder(TOTAL_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(ETAB_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(PART_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(GROUPE_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(HORS_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(INTERNE_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(CLASSIFIED_COUNT))
      .mockImplementationOnce(() => makeDataBuilder(SUGGESTIONS_ROWS))
      .mockImplementationOnce(() => makeDataBuilder(DOMAINS_ROWS))
      .mockImplementationOnce(() => makeDataBuilder(THREAD_COUNTS_ROWS))
      .mockImplementationOnce(() => makeDataBuilder(RECENT_THREADS_ROWS))
      .mockImplementationOnce(() => makeDataBuilder(RECENT_SUGGESTIONS_ROWS));

    const { result } = renderHook(() => useEmailClassificationStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data;

    expect(data).toBeDefined();
    expect(data?.totalThreadsCount).toBe(20);
    expect(data?.etablissementCount).toBe(8);
    expect(data?.partenaireCount).toBe(3);
    expect(data?.groupeCount).toBe(2);
    expect(data?.horsEtablissementCount).toBe(1);
    expect(data?.interneCount).toBe(4);
    expect(data?.totalClassifiedCount).toBe(15);
    expect(data?.unclassifiedCount).toBe(5);
    expect(data?.autoMatchedCount).toBe(8);
    expect(data?.manuallyClassifiedCount).toBe(0);
    expect(data?.autoMatchRate).toBe(40);
    expect(data?.totalClassificationRate).toBe(75);
    expect(data?.suggestionsPending).toBe(1);
    expect(data?.suggestionsAccepted).toBe(2);
    expect(data?.suggestionsRejected).toBe(1);
    expect(data?.avgConfidence).toBe(70);

    expect(data?.topDomains).toEqual([
      {
        domain: 'alpha.fr',
        etablissement_nom: 'Alpha Clinic',
        thread_count: 3,
        confidence_level: 'high',
      },
      {
        domain: 'beta.fr',
        etablissement_nom: 'Beta Center',
        thread_count: 1,
        confidence_level: 'medium',
      },
      {
        domain: 'unknown.fr',
        etablissement_nom: 'N/A',
        thread_count: 0,
        confidence_level: 'low',
      },
    ]);

    expect(data?.recentActivity).toHaveLength(7);
    expect(data?.recentActivity[0]).toMatchObject({
      date: expect.any(String),
      auto_matched: 2,
      suggestions_created: 1,
    });
    expect(data?.recentActivity[3]).toMatchObject({
      date: expect.any(String),
      auto_matched: 1,
      suggestions_created: 0,
    });
    expect(data?.recentActivity[5]).toMatchObject({
      date: expect.any(String),
      auto_matched: 0,
      suggestions_created: 2,
    });
    expect(data?.recentActivity[6]).toMatchObject({
      date: expect.any(String),
      auto_matched: 1,
      suggestions_created: 1,
    });

    expect(mockFrom).toHaveBeenCalledWith('email_threads');
    expect(mockFrom).toHaveBeenCalledWith('email_to_etablissement_suggestions');
    expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
    expect(mockFrom).toHaveBeenCalledTimes(12);
  });

  it('passe en erreur si la requête principale échoue', async () => {
    mockFrom
      .mockImplementationOnce(() => makeCountBuilder(0, { message: 'x' }))
      .mockImplementationOnce(() => makeCountBuilder(ETAB_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(PART_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(GROUPE_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(HORS_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(INTERNE_COUNT))
      .mockImplementationOnce(() => makeCountBuilder(CLASSIFIED_COUNT));

    const { result } = renderHook(() => useEmailClassificationStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledTimes(7);
  });
});