const { ROWS, ROWS_VILLE, mockFrom, state } = vi.hoisted(() => {
  const ROWS = [
    { id: '1', nom: 'Alpha' },
    { id: '2', nom: 'Beta' },
  ];
  const ROWS_VILLE = [
    { id: '1', nom: 'Alpha', ville: 'Paris' },
    { id: '2', nom: 'Beta', ville: null },
  ];
  const state: { result: { data: unknown; error: unknown } } = {
    result: { data: null, error: null },
  };
  const mockFrom = vi.fn();
  return { ROWS, ROWS_VILLE, mockFrom, state };
});

vi.mock('@/integrations/supabase/client', () => {
  const makeBuilder = () => {
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
    builder.single = vi.fn(() => Promise.resolve(state.result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(state.result));
    builder.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown
    ) => Promise.resolve(state.result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(state.result).catch(onRejected);
    return builder;
  };
  mockFrom.mockImplementation(() => makeBuilder());
  return { supabase: { from: mockFrom } };
});

import {
  fetchEtablissementsLite,
  fetchEtablissementsLiteWithVille,
} from './etablissementsLite';

describe('etablissementsLite', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    state.result = { data: null, error: null };
  });

  describe('fetchEtablissementsLite', () => {
    it('retourne les établissements triés par nom', async () => {
      state.result = { data: ROWS, error: null };

      const result = await fetchEtablissementsLite();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', nom: 'Alpha' });
      expect(result[1]).toEqual({ id: '2', nom: 'Beta' });
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    it('appelle select avec les bonnes colonnes et order sur nom', async () => {
      state.result = { data: ROWS, error: null };

      await fetchEtablissementsLite();

      const builder = mockFrom.mock.results[0].value as {
        select: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
      };
      expect(builder.select).toHaveBeenCalledWith('id, nom');
      expect(builder.order).toHaveBeenCalledWith('nom');
    });

    it('retourne un tableau vide si data est null', async () => {
      state.result = { data: null, error: null };

      const result = await fetchEtablissementsLite();

      expect(result).toEqual([]);
    });

    it('ignore les erreurs et retourne un tableau vide', async () => {
      state.result = { data: null, error: { message: 'x' } };

      const result = await fetchEtablissementsLite();

      expect(result).toEqual([]);
    });
  });

  describe('fetchEtablissementsLiteWithVille', () => {
    it('retourne les établissements avec ville', async () => {
      state.result = { data: ROWS_VILLE, error: null };

      const result = await fetchEtablissementsLiteWithVille();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', nom: 'Alpha', ville: 'Paris' });
      expect(result[1].ville).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });

    it('appelle select avec id, nom, ville et order sur nom', async () => {
      state.result = { data: ROWS_VILLE, error: null };

      await fetchEtablissementsLiteWithVille();

      const builder = mockFrom.mock.results[0].value as {
        select: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
      };
      expect(builder.select).toHaveBeenCalledWith('id, nom, ville');
      expect(builder.order).toHaveBeenCalledWith('nom');
    });

    it('retourne un tableau vide si data est null sans erreur', async () => {
      state.result = { data: null, error: null };

      const result = await fetchEtablissementsLiteWithVille();

      expect(result).toEqual([]);
    });

    it('lance une erreur si supabase renvoie une erreur', async () => {
      state.result = { data: null, error: { message: 'x' } };

      await expect(fetchEtablissementsLiteWithVille()).rejects.toEqual({
        message: 'x',
      });
    });
  });
});