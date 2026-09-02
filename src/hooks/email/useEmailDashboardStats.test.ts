/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmailDashboardStats } from './useEmailDashboardStats';

const {
  ETABLISSEMENTS_ROWS,
  SUGGESTIONS_ROWS,
  EMPTY_ROWS,
  mockFrom,
  mockCalculateEtablissementValue,
} = vi.hoisted(() => ({
  ETABLISSEMENTS_ROWS: [
    {
      id: 'e1',
      nom: 'Clinique A',
      ville: 'Paris',
      created_at: '2024-01-10T10:00:00.000Z',
      notes: 'source email',
      modele_statique_succes: 'm1',
      nombre_passages_urgences_annuel: 100,
    },
    {
      id: 'e2',
      nom: 'Hopital B',
      ville: 'Lyon',
      created_at: '2024-01-09T10:00:00.000Z',
      notes: 'contact email entrant',
      modele_statique_succes: 'm2',
      nombre_passages_urgences_annuel: 200,
    },
    {
      id: 'e3',
      nom: 'Centre C',
      ville: 'Lille',
      created_at: '2024-01-08T10:00:00.000Z',
      notes: 'email qualification',
      modele_statique_succes: 'm3',
      nombre_passages_urgences_annuel: 300,
    },
    {
      id: 'e4',
      nom: 'Maison D',
      ville: 'Nantes',
      created_at: '2024-01-07T10:00:00.000Z',
      notes: 'email supplémentaire',
      modele_statique_succes: 'm4',
      nombre_passages_urgences_annuel: 400,
    },
  ],
  SUGGESTIONS_ROWS: [
    {
      id: 's1',
      suggestion_type: 'create_new',
      match_confidence: 0.9,
      created_at: '2024-01-10T11:00:00.000Z',
      extracted_data: { name: 'A' },
      email_threads: {
        id: 't1',
        subject: 'Sujet 1',
        participants: ['a@test.local'],
        last_message_date: '2024-01-10T11:00:00.000Z',
      },
    },
    {
      id: 's2',
      suggestion_type: 'link_existing',
      match_confidence: 0.6,
      created_at: '2024-01-09T11:00:00.000Z',
      extracted_data: { name: 'B' },
      email_threads: {
        id: 't2',
        subject: 'Sujet 2',
        participants: ['b@test.local'],
        last_message_date: '2024-01-09T11:00:00.000Z',
      },
    },
    {
      id: 's3',
      suggestion_type: 'needs_review',
      match_confidence: 0.75,
      created_at: '2024-01-08T11:00:00.000Z',
      extracted_data: { name: 'C' },
      email_threads: {
        id: 't3',
        subject: 'Sujet 3',
        participants: ['c@test.local'],
        last_message_date: '2024-01-08T11:00:00.000Z',
      },
    },
  ],
  EMPTY_ROWS: [],
  mockFrom: vi.fn(),
  mockCalculateEtablissementValue: vi.fn(),
}));

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: mockCalculateEtablissementValue,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

type QueryResult<T> = {
  data: T;
  error: { message: string } | null;
};

type ChainableBuilder<T> = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: Promise<QueryResult<T>>['then'];
  catch: Promise<QueryResult<T>>['catch'];
};

function createBuilder<T>(result: QueryResult<T>): ChainableBuilder<T> {
  const builder = {} as ChainableBuilder<T>;

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.ilike = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected) => Promise.resolve(result).catch(onRejected);

  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useEmailDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expose isLoading puis retourne les statistiques métier calculées', async () => {
    mockCalculateEtablissementValue.mockImplementation((etablissement: { id: string }) => {
      if (etablissement.id === 'e1') return 1000;
      if (etablissement.id === 'e2') return 2000;
      if (etablissement.id === 'e3') return 3000;
      if (etablissement.id === 'e4') return 4000;
      return 0;
    });

    const etablissementsBuilder = createBuilder({
      data: ETABLISSEMENTS_ROWS,
      error: null,
    });

    const suggestionsBuilder = createBuilder({
      data: SUGGESTIONS_ROWS,
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') return etablissementsBuilder;
      if (table === 'email_to_etablissement_suggestions') return suggestionsBuilder;
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useEmailDashboardStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'etablissements');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'email_to_etablissement_suggestions');

    expect(etablissementsBuilder.select).toHaveBeenCalledWith(
      'id, nom, ville, created_at, notes, modele_statique_succes, nombre_passages_urgences_annuel'
    );
    expect(etablissementsBuilder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(etablissementsBuilder.ilike).toHaveBeenCalledWith('notes', '%email%');
    expect(etablissementsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });

    expect(suggestionsBuilder.select).toHaveBeenCalledWith(expect.stringContaining('suggestion_type'));
    expect(suggestionsBuilder.eq).toHaveBeenCalledWith('status', 'pending');
    expect(suggestionsBuilder.gte).toHaveBeenCalledWith('match_confidence', 0.6);
    expect(suggestionsBuilder.in).toHaveBeenCalledWith('suggestion_type', [
      'create_new',
      'link_existing',
      'needs_review',
      'domain_match',
    ]);
    expect(suggestionsBuilder.order).toHaveBeenCalledWith('match_confidence', { ascending: false });
    expect(suggestionsBuilder.limit).toHaveBeenCalledWith(50);

    expect(mockCalculateEtablissementValue).toHaveBeenCalledTimes(4);
    expect(mockCalculateEtablissementValue).toHaveBeenNthCalledWith(1, ETABLISSEMENTS_ROWS[0]);
    expect(mockCalculateEtablissementValue).toHaveBeenNthCalledWith(4, ETABLISSEMENTS_ROWS[3]);

    expect(result.current.data).toEqual({
      newProspects: {
        count: 4,
        total_ca: 10000,
        prospects: ETABLISSEMENTS_ROWS.slice(0, 3),
      },
      pendingSuggestions: {
        count: 3,
        avg_confidence: 0.75,
        suggestions: SUGGESTIONS_ROWS,
      },
    });
  });

  it('retourne une erreur si la requête prospects échoue', async () => {
    const etablissementsBuilder = createBuilder({
      data: null,
      error: { message: 'prospects failed' },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') return etablissementsBuilder;
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useEmailDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('prospects failed');
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockCalculateEtablissementValue).not.toHaveBeenCalled();
  });

  it('retourne une erreur si la requête suggestions échoue après des prospects valides', async () => {
    mockCalculateEtablissementValue.mockReturnValue(500);

    const etablissementsBuilder = createBuilder({
      data: ETABLISSEMENTS_ROWS,
      error: null,
    });

    const suggestionsBuilder = createBuilder({
      data: null,
      error: { message: 'suggestions failed' },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'etablissements') return etablissementsBuilder;
      if (table === 'email_to_etablissement_suggestions') return suggestionsBuilder;
      return createBuilder({ data: EMPTY_ROWS, error: null });
    });

    const { result } = renderHook(() => useEmailDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe('suggestions failed');
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockCalculateEtablissementValue).toHaveBeenCalledTimes(4);
    expect(mockCalculateEtablissementValue).toHaveBeenCalledWith(ETABLISSEMENTS_ROWS[0]);
  });
});