import {
  fetchSatisfactionCampaignsList,
  fetchSatisfactionResponsesPaged,
  fetchSatisfactionStats,
  fetchSatisfactionForExport,
  fetchSatisfactionCampaigns,
  fetchSatisfactionCampaignCounts,
  fetchSatisfactionEtabOptions,
  fetchSatisfactionServiceOptions,
  upsertSatisfactionCampaign,
  toggleSatisfactionCampaignActive,
  satisfactionOnFive,
  type SatisfactionV3Filters,
} from './satisfactionV3';

describe('satisfactionOnFive', () => {
  it('normalise les notes DPI /10 et conserve les notes publiques /5', () => {
    expect(satisfactionOnFive(10, 'v3-dpi')).toBe(5);
    expect(satisfactionOnFive(4, 'v3-dpi')).toBe(2);
    expect(satisfactionOnFive(4, 'public-form')).toBe(4);
    expect(satisfactionOnFive(8, 'public-form')).toBe(5);
    expect(satisfactionOnFive(null, 'v3-dpi')).toBeNull();
  });
});

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

type QueryResult = { data: unknown; error: unknown; count?: number | null };

const CHAIN_METHODS = [
  'select',
  'eq',
  'ilike',
  'gte',
  'lte',
  'in',
  'not',
  'order',
  'range',
  'limit',
  'insert',
  'update',
  'delete',
] as const;

type ChainMethod = (typeof CHAIN_METHODS)[number];

type Builder = Record<ChainMethod, ReturnType<typeof vi.fn>> & {
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled?: (v: QueryResult) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise<unknown>;
  catch: (onRejected?: (e: unknown) => unknown) => Promise<unknown>;
};

const createBuilder = (result: QueryResult): Builder => {
  const partial = {} as Builder;
  CHAIN_METHODS.forEach((m) => {
    partial[m] = vi.fn(() => partial);
  });
  partial.single = vi.fn(async () => result);
  partial.maybeSingle = vi.fn(async () => result);
  partial.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  partial.catch = (onRejected) => Promise.resolve(result).catch(onRejected);
  return partial;
};

const ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' } };

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchSatisfactionCampaignsList', () => {
  it('retourne les campagnes triées par titre', async () => {
    const builder = createBuilder({
      data: [
        { id: 'c1', title: 'Alpha' },
        { id: 'c2', title: 'Beta' },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const res = await fetchSatisfactionCampaignsList();

    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_campaigns');
    expect(builder.select).toHaveBeenCalledWith('id, title');
    expect(builder.order).toHaveBeenCalledWith('title');
    expect(res).toEqual([
      { id: 'c1', title: 'Alpha' },
      { id: 'c2', title: 'Beta' },
    ]);
  });

  it('retourne un tableau vide si data est null', async () => {
    mockFrom.mockReturnValue(createBuilder({ data: null, error: null }));
    await expect(fetchSatisfactionCampaignsList()).resolves.toEqual([]);
  });

  it('lance l erreur supabase', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(fetchSatisfactionCampaignsList()).rejects.toEqual({ message: 'x' });
  });
});

describe('fetchSatisfactionResponsesPaged', () => {
  it('applique tous les filtres, la pagination et retourne rows + total', async () => {
    const rows = [
      {
        id: 'r1',
        campaign_id: 'c1',
        source: 'app',
        dpi: 'DPI1',
        etablissement: 'CHU',
        service: 'Urgences',
        role: 'ide',
        satisfaction: 5,
        recommendation: 9,
        comment: 'top',
        created_at: '2024-01-15T10:00:00Z',
      },
    ];
    const builder = createBuilder({ data: rows, error: null, count: 42 });
    mockFrom.mockReturnValue(builder);

    const filters: SatisfactionV3Filters = {
      source: 'app',
      dpi: 'DPI1',
      etab: 'CHU',
      service: 'urg',
      campaignId: 'c1',
      from: '2024-01-01',
      to: '2024-01-31',
      commentOnly: true,
    };

    const res = await fetchSatisfactionResponsesPaged(filters, 2, 10);

    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_responses');
    expect(builder.eq).toHaveBeenCalledWith('source', 'app');
    expect(builder.eq).toHaveBeenCalledWith('dpi', 'DPI1');
    expect(builder.eq).toHaveBeenCalledWith('campaign_id', 'c1');
    expect(builder.ilike).toHaveBeenCalledWith('etablissement', '%CHU%');
    expect(builder.ilike).toHaveBeenCalledWith('service', '%urg%');
    expect(builder.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
    expect(builder.lte).toHaveBeenCalledWith('created_at', '2024-01-31T23:59:59');
    expect(builder.not).toHaveBeenCalledWith('comment', 'is', null);
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(20, 29);
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe('r1');
    expect(res.total).toBe(42);
  });

  it('ignore les filtres "all" et vides', async () => {
    const builder = createBuilder({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);

    const res = await fetchSatisfactionResponsesPaged(
      { source: 'all', dpi: 'all', campaignId: 'all' },
      0,
      25,
    );

    expect(builder.eq).not.toHaveBeenCalled();
    expect(builder.ilike).not.toHaveBeenCalled();
    expect(builder.gte).not.toHaveBeenCalled();
    expect(builder.lte).not.toHaveBeenCalled();
    expect(builder.not).not.toHaveBeenCalled();
    expect(builder.range).toHaveBeenCalledWith(0, 24);
    expect(res).toEqual({ rows: [], total: 0 });
  });

  it('lance l erreur supabase', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(fetchSatisfactionResponsesPaged({}, 0, 10)).rejects.toEqual({ message: 'x' });
  });
});

describe('fetchSatisfactionStats', () => {
  it('retourne les stats limitées à 10000', async () => {
    const stats = [
      { source: 'app', satisfaction: 4, recommendation: 8, created_at: '2024-02-01T00:00:00Z' },
    ];
    const builder = createBuilder({ data: stats, error: null });
    mockFrom.mockReturnValue(builder);

    const res = await fetchSatisfactionStats({ source: 'app' });

    expect(builder.select).toHaveBeenCalledWith('source, satisfaction, recommendation, created_at');
    expect(builder.eq).toHaveBeenCalledWith('source', 'app');
    expect(builder.limit).toHaveBeenCalledWith(10000);
    expect(res).toEqual(stats);
  });

  it('lance l erreur supabase', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(fetchSatisfactionStats({})).rejects.toEqual({ message: 'x' });
  });
});

describe('fetchSatisfactionForExport', () => {
  it('retourne les lignes triées et limitées', async () => {
    const rows = [
      {
        id: 'e1',
        campaign_id: null,
        source: 'web',
        dpi: null,
        etablissement: 'CHU',
        service: null,
        role: null,
        satisfaction: 3,
        recommendation: 6,
        comment: null,
        created_at: '2024-03-01T00:00:00Z',
      },
    ];
    const builder = createBuilder({ data: rows, error: null });
    mockFrom.mockReturnValue(builder);

    const res = await fetchSatisfactionForExport({});

    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(10000);
    expect(res).toEqual(rows);
  });

  it('retourne [] si data null', async () => {
    mockFrom.mockReturnValue(createBuilder({ data: null, error: null }));
    await expect(fetchSatisfactionForExport({})).resolves.toEqual([]);
  });
});

describe('fetchSatisfactionCampaigns', () => {
  it('trie par priorité puis par date de création', async () => {
    const campaigns = [
      {
        id: 'c1',
        title: 'Camp 1',
        message: null,
        is_active: true,
        priority: 10,
        target_etablissement: null,
        target_dpi: null,
        target_service: null,
        starts_at: null,
        ends_at: null,
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    const builder = createBuilder({ data: campaigns, error: null });
    mockFrom.mockReturnValue(builder);

    const res = await fetchSatisfactionCampaigns();

    expect(builder.order).toHaveBeenNthCalledWith(1, 'priority', { ascending: false });
    expect(builder.order).toHaveBeenNthCalledWith(2, 'created_at', { ascending: false });
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('c1');
    expect(res[0].priority).toBe(10);
  });

  it('lance l erreur supabase', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(fetchSatisfactionCampaigns()).rejects.toEqual({ message: 'x' });
  });
});

describe('fetchSatisfactionCampaignCounts', () => {
  it('agrège les réponses par campaign_id en ignorant les null', async () => {
    const builder = createBuilder({
      data: [
        { campaign_id: 'a' },
        { campaign_id: 'a' },
        { campaign_id: 'b' },
        { campaign_id: null },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const res = await fetchSatisfactionCampaignCounts();

    expect(builder.select).toHaveBeenCalledWith('campaign_id');
    expect(res).toEqual({ a: 2, b: 1 });
  });

  it('lance l erreur supabase', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(fetchSatisfactionCampaignCounts()).rejects.toEqual({ message: 'x' });
  });
});

describe('fetchSatisfactionEtabOptions', () => {
  it('fusionne réponses + établissements, déduplique et trie', async () => {
    const respBuilder = createBuilder({
      data: [{ etablissement: 'Zeta' }, { etablissement: 'Alpha' }, { etablissement: null }],
      error: null,
    });
    const etabBuilder = createBuilder({
      data: [{ nom: 'Beta' }, { nom: 'Alpha' }],
      error: null,
    });
    mockFrom.mockImplementation((table: string) =>
      table === 'etablissements' ? etabBuilder : respBuilder,
    );

    const res = await fetchSatisfactionEtabOptions();

    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_responses');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(etabBuilder.eq).toHaveBeenCalledWith('statut', 'Production');
    expect(respBuilder.not).toHaveBeenCalledWith('etablissement', 'is', null);
    expect(res).toEqual(['Alpha', 'Beta', 'Zeta']);
  });
});

describe('fetchSatisfactionServiceOptions', () => {
  it('trim, déduplique et trie les services', async () => {
    const builder = createBuilder({
      data: [{ service: ' Cardio ' }, { service: 'Urgences' }, { service: '   ' }, { service: null }],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const res = await fetchSatisfactionServiceOptions();

    expect(builder.not).toHaveBeenCalledWith('service', 'is', null);
    expect(builder.limit).toHaveBeenCalledWith(5000);
    expect(res).toEqual(['Cardio', 'Urgences']);
  });
});

describe('upsertSatisfactionCampaign', () => {
  it('insère quand editingId est null', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await upsertSatisfactionCampaign({ title: 'Nouvelle' }, null);

    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_campaigns');
    expect(builder.insert).toHaveBeenCalledWith({ title: 'Nouvelle' });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it('met à jour (sans id dans le payload) quand editingId est fourni', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await upsertSatisfactionCampaign({ id: 'ancien', title: 'Modif' }, 'e1');

    expect(builder.update).toHaveBeenCalledWith({ title: 'Modif' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'e1');
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('lance l erreur en insertion', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(upsertSatisfactionCampaign({ title: 'ko' }, null)).rejects.toEqual({
      message: 'x',
    });
  });

  it('lance l erreur en mise à jour', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(upsertSatisfactionCampaign({ title: 'ko' }, 'e1')).rejects.toEqual({
      message: 'x',
    });
  });
});

describe('toggleSatisfactionCampaignActive', () => {
  it('active la campagne ciblée', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await toggleSatisfactionCampaignActive('c9', true);

    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_campaigns');
    expect(builder.update).toHaveBeenCalledWith({ is_active: true });
    expect(builder.eq).toHaveBeenCalledWith('id', 'c9');
  });

  it('désactive la campagne ciblée', async () => {
    const builder = createBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await toggleSatisfactionCampaignActive('c9', false);

    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
  });

  it('lance l erreur supabase', async () => {
    mockFrom.mockReturnValue(createBuilder(ERROR_RESULT));
    await expect(toggleSatisfactionCampaignActive('c9', true)).rejects.toEqual({ message: 'x' });
  });
});