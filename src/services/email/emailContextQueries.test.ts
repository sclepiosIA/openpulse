// @vitest-environment jsdom

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import {
  fetchActiveTachesForEtablissement,
  fetchEtablissementForHover,
  fetchSiblingMessagesForInvitation,
} from './emailContextQueries';

const {
  HOVER_ROW,
  TACHES_ROWS,
  SIBLING_ROWS,
  NULL_ROW,
  mockFrom,
  builder,
  authState,
} = vi.hoisted(() => {
  const HOVER_ROW = {
    id: 'etab-1',
    nom: 'Clinique du Lac',
    ville: 'Lyon',
    taches: [
      {
        id: 't1',
        titre: 'Préparer devis',
        statut: 'A faire',
        echeance: '2026-02-03',
        priorite: 'Haute',
      },
      {
        id: 't2',
        titre: 'Relancer client',
        statut: 'En cours',
        echeance: '2026-02-05',
        priorite: 'Normale',
      },
    ],
  };

  const TACHES_ROWS = [
    {
      id: 't1',
      titre: 'Préparer devis',
      statut: 'A faire',
      echeance: '2026-02-03',
      priorite: 'Haute',
    },
    {
      id: 't2',
      titre: 'Relancer client',
      statut: 'En cours',
      echeance: '2026-02-05',
      priorite: 'Normale',
    },
  ];

  const SIBLING_ROWS = [
    {
      subject: 'Invitation réunion',
      body_text: 'Texte invitation',
      body_html: '<p>Texte invitation</p>',
    },
    {
      subject: 'RE: Invitation réunion',
      body_text: 'Réponse',
      body_html: '<p>Réponse</p>',
    },
  ];

  const NULL_ROW = null;

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockImplementation(() => builder);
  builder.eq.mockImplementation(() => builder);
  builder.gte.mockImplementation(() => builder);
  builder.lte.mockImplementation(() => builder);
  builder.in.mockImplementation(() => builder);
  builder.neq.mockImplementation(() => builder);
  builder.order.mockImplementation(() => builder);
  builder.limit.mockImplementation(() => Promise.resolve({ data: [], error: null }));
  builder.insert.mockImplementation(() => builder);
  builder.update.mockImplementation(() => builder);
  builder.delete.mockImplementation(() => builder);
  builder.single.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }));
  builder.then.mockImplementation((onFulfilled: (value: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(onFulfilled),
  );
  builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).catch(onRejected),
  );

  const mockFrom = vi.fn(() => builder);

  const authState = {
    user: { id: 'u1', email: 'test@example.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  return { HOVER_ROW, TACHES_ROWS, SIBLING_ROWS, NULL_ROW, mockFrom, builder, authState };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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

describe('emailContextQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(() => builder);

    builder.select.mockImplementation(() => builder);
    builder.eq.mockImplementation(() => builder);
    builder.gte.mockImplementation(() => builder);
    builder.lte.mockImplementation(() => builder);
    builder.in.mockImplementation(() => builder);
    builder.neq.mockImplementation(() => builder);
    builder.order.mockImplementation(() => builder);
    builder.limit.mockImplementation(() => Promise.resolve({ data: [], error: null }));
    builder.single.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    builder.maybeSingle.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    builder.then.mockImplementation((onFulfilled: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(onFulfilled),
    );
    builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).catch(onRejected),
    );
  });

  describe('fetchEtablissementForHover', () => {
    it('retourne la fiche établissement avec ses tâches liées', async () => {
      builder.maybeSingle.mockResolvedValueOnce({ data: HOVER_ROW, error: null });

      const result = await fetchEtablissementForHover('etab-1');

      expect(mockFrom).toHaveBeenCalledWith('etablissements');
      expect(builder.select).toHaveBeenCalledWith('*, taches ( id, titre, statut, echeance, priorite )');
      expect(builder.eq).toHaveBeenCalledWith('id', 'etab-1');
      expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
      expect(result).toEqual(HOVER_ROW);
      expect(result?.id).toBe('etab-1');
      expect(result?.taches).toHaveLength(2);
      expect(result?.taches?.[0]).toEqual({
        id: 't1',
        titre: 'Préparer devis',
        statut: 'A faire',
        echeance: '2026-02-03',
        priorite: 'Haute',
      });
    });

    it('retourne null quand aucune ligne n’est trouvée', async () => {
      builder.maybeSingle.mockResolvedValueOnce({ data: NULL_ROW, error: null });

      const result = await fetchEtablissementForHover('missing-etab');

      expect(result).toBeNull();
      expect(builder.eq).toHaveBeenCalledWith('id', 'missing-etab');
    });

    it('propage une erreur Supabase dans un hook react-query', async () => {
      builder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } });

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['hover-etab', 'etab-err'],
            queryFn: () => fetchEtablissementForHover('etab-err'),
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual({ message: 'x' });
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });
  });

  describe('fetchActiveTachesForEtablissement', () => {
    it('retourne les tâches actives triées avec la limite fournie', async () => {
      builder.limit.mockResolvedValueOnce({ data: TACHES_ROWS, error: null });

      const result = await fetchActiveTachesForEtablissement('etab-1', { limit: 5 });

      expect(mockFrom).toHaveBeenCalledWith('taches');
      expect(builder.select).toHaveBeenCalledWith('id, titre, statut, echeance, priorite');
      expect(builder.eq).toHaveBeenCalledWith('etablissement_id', 'etab-1');
      expect(builder.in).toHaveBeenCalledWith('statut', ['A faire', 'En cours']);
      expect(builder.order).toHaveBeenCalledWith('echeance', { ascending: true, nullsFirst: false });
      expect(builder.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual(TACHES_ROWS);
      expect(result).toHaveLength(2);
      expect(result[0].statut).toBe('A faire');
      expect(result[1].statut).toBe('En cours');
    });

    it('utilise la limite par défaut à 10 et retourne un tableau vide si data est null', async () => {
      builder.limit.mockResolvedValueOnce({ data: null, error: null });

      const result = await fetchActiveTachesForEtablissement('etab-2');

      expect(builder.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual([]);
    });

    it('passe de isLoading à success via react-query avec des valeurs métier exactes', async () => {
      builder.limit.mockResolvedValueOnce({ data: TACHES_ROWS, error: null });

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['active-taches', 'etab-1'],
            queryFn: () => fetchActiveTachesForEtablissement('etab-1', { limit: 2 }),
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(TACHES_ROWS);
      expect(result.current.data?.[0].titre).toBe('Préparer devis');
      expect(result.current.data?.[1].priorite).toBe('Normale');
    });
  });

  describe('fetchSiblingMessagesForInvitation', () => {
    it('retourne les messages frères en excluant le message courant', async () => {
      builder.limit.mockResolvedValueOnce({ data: SIBLING_ROWS, error: null });

      const result = await fetchSiblingMessagesForInvitation('thread-1', 'msg-2', { limit: 3 });

      expect(mockFrom).toHaveBeenCalledWith('email_messages');
      expect(builder.select).toHaveBeenCalledWith('subject, body_text, body_html');
      expect(builder.eq).toHaveBeenCalledWith('thread_id', 'thread-1');
      expect(builder.neq).toHaveBeenCalledWith('id', 'msg-2');
      expect(builder.order).toHaveBeenCalledWith('sent_date', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(3);
      expect(result).toEqual(SIBLING_ROWS);
      expect(result[0].subject).toBe('Invitation réunion');
      expect(result[1].body_text).toBe('Réponse');
    });

    it('utilise la limite par défaut à 10', async () => {
      builder.limit.mockResolvedValueOnce({ data: SIBLING_ROWS, error: null });

      const result = await fetchSiblingMessagesForInvitation('thread-2', 'msg-9');

      expect(builder.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(2);
    });

    it('retourne une erreur react-query si la requête échoue au await query thenable', async () => {
      builder.then.mockImplementationOnce(
        (_onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.reject({ message: 'x' }).catch((reason) => {
            if (onRejected) {
              return onRejected(reason);
            }
            throw reason;
          }),
      );

      const failingFn = async () => {
        await (builder as unknown as PromiseLike<{ data: unknown; error: unknown }>);
        return fetchSiblingMessagesForInvitation('thread-3', 'msg-1');
      };

      const { result } = renderHook(
        () =>
          useQuery({
            queryKey: ['siblings-error', 'thread-3'],
            queryFn: failingFn,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual({ message: 'x' });
    });
  });
});