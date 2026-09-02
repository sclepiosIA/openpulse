import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';

const { DATA, RESPONSES, setResponseForTable, resetResponses, mockFrom } = vi.hoisted(() => {
  const DATA = {
    rh_absences: [
      {
        id: 'a1',
        type_absence: 'Congés',
        statut: 'approuvée',
        date_debut: '2023-12-25',
        date_fin: '2023-12-28',
        demandeur_commentaire: 'Vacances',
      },
    ],
    tresorerie_revenus: [
      {
        id: 'r1',
        numero_facture: 'F-2024-001',
        notes: 'Accompte',
        type_revenu: 'Facture',
        statut: 'payé',
        montant_prevu: 1000,
        date_prevue: '2024-01-10',
      },
    ],
    tresorerie_depenses: [
      {
        id: 'd1',
        nom: 'Loyer',
        notes: 'Bureau',
        sous_categorie: 'Fixe',
        statut: 'prévu',
        montant: 800,
        date_prevue: '2024-01-05',
      },
    ],
    proactive_alerts: [
      {
        id: 'pa1',
        titre: 'Retard paiement',
        description: 'Client en retard',
        severite: 'haute',
        statut: 'open',
        etablissement_id: 'e42',
      },
    ],
    pulse_polls: [
      {
        id: 'p1',
        question: 'Satisfait ?',
        conversation_id: 'c9',
        created_at: '2024-02-03',
      },
    ],
    dashboard_notes: [
      {
        id: 'n1',
        tab_name: 'Finance',
        content: 'Note de dashboard très longue',
        updated_at: '2024-02-01',
      },
    ],
    candidate_evaluations: [
      {
        id: 'ce1',
        candidate_id: 'cand3',
        commentaire_general: 'Très bon candidat, motivé et sérieux',
        recommandation: 'Embaucher',
        note_globale: 8,
        points_forts: 'Communication',
      },
    ],
  };
  const RESPONSES = new Map<string, { data: unknown; error: any }>();
  const setResponseForTable = (table: string, response: { data: unknown; error: any }) => {
    RESPONSES.set(table, response);
  };
  const resetResponses = () => {
    RESPONSES.clear();
  };
  const defaultResponseFor = (table: string) => ({ data: (DATA as any)[table] || [], error: null });

  const makeBuilder = (table: string) => {
    const builder: any = {
      _table: table,
      select: () => builder,
      or: () => builder,
      ilike: () => builder,
      like: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      contains: () => builder,
      match: () => builder,
      textSearch: () => builder,
      neq: () => builder,
      order: () => builder,
      limit: () => builder,
      range: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: async () => {
        const r = RESPONSES.get(table) ?? defaultResponseFor(table);
        if (r.error) throw Object.assign(new Error(r.error.message || 'error'), r.error);
        return r;
      },
      maybeSingle: async () => {
        const r = RESPONSES.get(table) ?? defaultResponseFor(table);
        if (r.error) throw Object.assign(new Error(r.error.message || 'error'), r.error);
        return r;
      },
      then: (resolve: (v: any) => any, reject: (e: any) => any) => {
        const r = RESPONSES.get(table) ?? defaultResponseFor(table);
        return new Promise((res, rej) => {
          setTimeout(() => {
            if (r && r.error) {
              rej(Object.assign(new Error(r.error.message || 'error'), r.error));
            } else {
              res(r);
            }
          }, 0);
        }).then(resolve, reject);
      },
      catch: (onReject: (e: any) => any) => {
        const r = RESPONSES.get(table) ?? defaultResponseFor(table);
        return new Promise((res, rej) => {
          setTimeout(() => {
            if (r && r.error) {
              rej(Object.assign(new Error(r.error.message || 'error'), r.error));
            } else {
              res(r);
            }
          }, 0);
        }).catch(onReject);
      },
    };
    return builder;
  };

  const mockFrom = vi.fn((table: string) => makeBuilder(table));

  return { DATA, RESPONSES, setResponseForTable, resetResponses, mockFrom };
});

const { sanitizePostgrestValueMock, buildIlikeOrFilterMock } = vi.hoisted(() => ({
  sanitizePostgrestValueMock: vi.fn((s: string) => s),
  buildIlikeOrFilterMock: vi.fn((cols: string[], s: string) => cols.map((c) => `${c}.ilike.%${s}%`).join(',')),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizePostgrestValue: sanitizePostgrestValueMock,
  buildIlikeOrFilter: buildIlikeOrFilterMock,
}));

import { useFinanceSearch } from './useFinanceSearch';

describe('useFinanceSearch', () => {
  beforeEach(() => {
    resetResponses();
    vi.clearAllMocks();
  });

  const createClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 0, gcTime: 0 },
        mutations: { retry: 0 },
      },
    });

  const createWrapper = (client: QueryClient) => {
    const Wrapper = ({ children }: { children?: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children as React.ReactNode);
    return Wrapper;
  };

  it('renvoie un état de chargement puis des résultats mappés pour chaque slice', async () => {
    const client = createClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useFinanceSearch('paris', true), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('rh_absences');
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_revenus');
    expect(mockFrom).toHaveBeenCalledWith('tresorerie_depenses');
    expect(mockFrom).toHaveBeenCalledWith('proactive_alerts');
    expect(mockFrom).toHaveBeenCalledWith('pulse_polls');
    expect(mockFrom).toHaveBeenCalledWith('dashboard_notes');
    expect(mockFrom).toHaveBeenCalledWith('candidate_evaluations');

    const { absences, revenus, depenses, proactiveAlerts, polls, dashboardNotes, candidateEvaluations } =
      result.current.slice;

    expect(absences.length).toBe(1);
    expect(absences[0]).toEqual({
      id: 'a1',
      type: 'absence',
      title: 'Congés',
      subtitle: '25 déc. 2023',
      badge: 'approuvée',
      href: '/people?absence=a1',
    });

    expect(revenus.length).toBe(1);
    expect(revenus[0]).toEqual({
      id: 'r1',
      type: 'revenu',
      title: 'Revenu F-2024-001',
      subtitle: 'Facture',
      badge: 'payé',
      href: '/tresorerie?revenu=r1',
    });

    expect(depenses.length).toBe(1);
    expect(depenses[0]).toEqual({
      id: 'd1',
      type: 'depense',
      title: 'Loyer',
      subtitle: 'Fixe',
      badge: 'prévu',
      href: '/tresorerie?depense=d1',
    });

    expect(proactiveAlerts.length).toBe(1);
    expect(proactiveAlerts[0]).toEqual({
      id: 'pa1',
      type: 'proactive_alert',
      title: 'Retard paiement',
      subtitle: 'Client en retard',
      badge: 'haute',
      href: '/etablissements/e42?alert=pa1',
    });

    expect(polls.length).toBe(1);
    expect(polls[0]).toEqual({
      id: 'p1',
      type: 'poll',
      title: 'Satisfait ?',
      subtitle: '3 févr. 2024',
      href: '/pulse?conversation=c9&poll=p1',
    });

    expect(dashboardNotes.length).toBe(1);
    expect(dashboardNotes[0]).toEqual({
      id: 'n1',
      type: 'dashboard_note',
      title: 'Finance',
      subtitle: 'Note de dashboard très longue',
      href: '/?note=n1',
    });

    expect(candidateEvaluations.length).toBe(1);
    expect(candidateEvaluations[0]).toEqual({
      id: 'ce1',
      type: 'candidate_evaluation',
      title: 'Très bon candidat, motivé et sérieux',
      subtitle: 'Embaucher',
      badge: '8/10',
      href: '/recrutement?candidate=cand3&evaluation=ce1',
    });
  });

  it('ne lance pas la recherche quand shouldSearch=false', async () => {
    const client = createClient();
    const wrapper = createWrapper(client);

    const { result } = renderHook(() => useFinanceSearch('ignored', false), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.slice.absences).toEqual([]);
    expect(result.current.slice.revenus).toEqual([]);
    expect(result.current.slice.depenses).toEqual([]);
    expect(result.current.slice.proactiveAlerts).toEqual([]);
    expect(result.current.slice.polls).toEqual([]);
    expect(result.current.slice.dashboardNotes).toEqual([]);
    expect(result.current.slice.candidateEvaluations).toEqual([]);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('gère une erreur sur une table (depenses) sans bloquer les autres résultats', async () => {
    setResponseForTable('tresorerie_depenses', { data: null, error: { message: 'depenses error' } });

    const client = createClient();
    const wrapper = createWrapper(client);

    const search = 'errcase';
    const { result } = renderHook(() => useFinanceSearch(search, true), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const state = client.getQueryState(['global-search-depenses', search]);
    expect(state?.status).toBe('error');

    expect(result.current.slice.depenses).toEqual([]);
    expect(result.current.slice.absences.length).toBe(1);
    expect(result.current.slice.revenus.length).toBe(1);
    expect(result.current.slice.proactiveAlerts.length).toBe(1);
    expect(result.current.slice.polls.length).toBe(1);
    expect(result.current.slice.dashboardNotes.length).toBe(1);
    expect(result.current.slice.candidateEvaluations.length).toBe(1);
  });
});