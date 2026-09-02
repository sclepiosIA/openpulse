import { fetchEnquetesDashboard } from './enquetesDashboard';

const {
  FORMATION_ROWS,
  CES_ROWS,
  SOLUTION_ROWS,
  CSM_ROWS,
  CAMPAGNES_ROWS,
  V3_ROWS,
  mockFrom,
  makeBuilder,
} = vi.hoisted(() => {
  const FORMATION_ROWS = [
    { id: 'f1', note: 9, date_reponse: '2024-06-01', etablissements: { nom: 'Etab A' } },
  ];
  const CES_ROWS = [
    { id: 'c1', score_ces: 3, date_reponse: '2024-05-20', etablissements: { nom: 'Etab B' } },
  ];
  const SOLUTION_ROWS = [
    { id: 's1', note: 7, date_reponse: '2024-05-10', etablissements: { nom: 'Etab C' } },
  ];
  const CSM_ROWS = [
    {
      id: 'k1',
      note: 8,
      date_reponse: '2024-04-15',
      etablissements: { nom: 'Etab D' },
      profiles: { full_name: 'Jane Doe' },
    },
  ];
  const CAMPAGNES_ROWS = [
    { id: 'camp1', nom: 'Campagne printemps', created_at: '2024-03-01' },
  ];
  const V3_ROWS = [
    { source: 'v3-dpi', satisfaction: 10, recommendation: 9, created_at: '2024-06-02' },
  ];

  type Result = { data: unknown; error: unknown };

  const makeBuilder = (result: Result) => {
    const builder: Record<string, unknown> = {};
    const chainMethods = [
      'select',
      'eq',
      'gte',
      'lte',
      'in',
      'order',
      'limit',
      'insert',
      'update',
      'delete',
    ];
    for (const m of chainMethods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (
      onFulfilled?: (value: Result) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn();

  return {
    FORMATION_ROWS,
    CES_ROWS,
    SOLUTION_ROWS,
    CSM_ROWS,
    CAMPAGNES_ROWS,
    V3_ROWS,
    mockFrom,
    makeBuilder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

describe('fetchEnquetesDashboard', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  const configureSuccess = () => {
    mockFrom.mockImplementation((table: string) => {
      switch (table) {
        case 'enquetes_satisfaction_formation':
          return makeBuilder({ data: FORMATION_ROWS, error: null });
        case 'enquetes_ces':
          return makeBuilder({ data: CES_ROWS, error: null });
        case 'enquetes_satisfaction_solution':
          return makeBuilder({ data: SOLUTION_ROWS, error: null });
        case 'enquetes_suivi_csm':
          return makeBuilder({ data: CSM_ROWS, error: null });
        case 'enquetes_campagnes':
          return makeBuilder({ data: CAMPAGNES_ROWS, error: null });
        case 'satisfaction_v3_responses':
          return makeBuilder({ data: V3_ROWS, error: null });
        default:
          return makeBuilder({ data: null, error: { message: 'table inconnue' } });
      }
    });
  };

  it('retourne les données des 6 tables sur succès', async () => {
    configureSuccess();

    const result = await fetchEnquetesDashboard();

    expect(result.formation).toEqual(FORMATION_ROWS);
    expect(result.formation[0]).toMatchObject({
      id: 'f1',
      note: 9,
      etablissements: { nom: 'Etab A' },
    });
    expect(result.ces).toEqual(CES_ROWS);
    expect(result.ces[0].score_ces).toBe(3);
    expect(result.solution).toEqual(SOLUTION_ROWS);
    expect(result.csm[0]).toMatchObject({
      id: 'k1',
      profiles: { full_name: 'Jane Doe' },
    });
    expect(result.campagnes[0]).toMatchObject({
      id: 'camp1',
      nom: 'Campagne printemps',
    });
    expect(result.v3).toEqual(V3_ROWS);
  });

  it('interroge les 6 bonnes tables avec select/order/limit', async () => {
    configureSuccess();

    await fetchEnquetesDashboard();

    expect(mockFrom).toHaveBeenCalledTimes(6);
    expect(mockFrom).toHaveBeenCalledWith('enquetes_satisfaction_formation');
    expect(mockFrom).toHaveBeenCalledWith('enquetes_ces');
    expect(mockFrom).toHaveBeenCalledWith('enquetes_satisfaction_solution');
    expect(mockFrom).toHaveBeenCalledWith('enquetes_suivi_csm');
    expect(mockFrom).toHaveBeenCalledWith('enquetes_campagnes');
    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_responses');
  });

  it('applique les bons paramètres de requête (select, order desc, limit 500)', async () => {
    const builders: Record<string, ReturnType<typeof makeBuilder>> = {};
    mockFrom.mockImplementation((table: string) => {
      const builder = makeBuilder({ data: [], error: null });
      builders[table] = builder;
      return builder;
    });

    await fetchEnquetesDashboard();

    const formationBuilder = builders['enquetes_satisfaction_formation'];
    expect(formationBuilder.select).toHaveBeenCalledWith('*, etablissements(nom)');
    expect(formationBuilder.order).toHaveBeenCalledWith('date_reponse', {
      ascending: false,
    });
    expect(formationBuilder.limit).toHaveBeenCalledWith(500);

    const csmBuilder = builders['enquetes_suivi_csm'];
    expect(csmBuilder.select).toHaveBeenCalledWith(
      '*, etablissements(nom)'
    );

    const campagnesBuilder = builders['enquetes_campagnes'];
    expect(campagnesBuilder.select).toHaveBeenCalledWith('*');
    expect(campagnesBuilder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(campagnesBuilder.limit).toHaveBeenCalledWith(500);
  });

  it('remonte une erreur explicite au lieu d’afficher de faux zéros', async () => {
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: null, error: { message: 'x' } })
    );

    await expect(fetchEnquetesDashboard()).rejects.toMatchObject({ message: 'x' });
  });

  it('remonte aussi une erreur partielle au lieu de mélanger données et zéros', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'enquetes_ces') {
        return makeBuilder({ data: null, error: { message: 'x' } });
      }
      if (table === 'enquetes_campagnes') {
        return makeBuilder({ data: CAMPAGNES_ROWS, error: null });
      }
      return makeBuilder({ data: [], error: null });
    });

    await expect(fetchEnquetesDashboard()).rejects.toMatchObject({ message: 'x' });
  });
});