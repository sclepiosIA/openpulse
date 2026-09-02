import { fetchActivityTeam, fetchActivityEtablissements } from './activityFilters';

const { mockFrom, state } = vi.hoisted(() => {
  const state: { result: { data: unknown } } = { result: { data: null } };

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    const chain = vi.fn(() => builder);
    builder.select = chain;
    builder.order = chain;
    builder.limit = chain;
    builder.eq = chain;
    builder.gte = chain;
    builder.lte = chain;
    builder.in = chain;
    builder.insert = chain;
    builder.update = chain;
    builder.delete = chain;
    builder.single = vi.fn(() => Promise.resolve(state.result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(state.result));
    builder.then = (
      onFulfilled?: (v: unknown) => unknown,
      onRejected?: (r: unknown) => unknown
    ) => Promise.resolve(state.result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(state.result).catch(onRejected);
    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());

  return { mockFrom, state };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
}));

describe('activityFilters', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    state.result = { data: null };
  });

  describe('fetchActivityTeam', () => {
    it('mappe les profils en personnes avec nom complet', async () => {
      state.result = {
        data: [
          { user_id: 'u1', prenom: 'Alice', nom: 'Durand' },
          { user_id: 'u2', prenom: 'Bob', nom: 'Martin' },
        ],
      };

      const result = await fetchActivityTeam();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(result).toEqual([
        { id: 'u1', name: 'Alice Durand' },
        { id: 'u2', name: 'Bob Martin' },
      ]);
    });

    it('gère prénom ou nom manquant en trimant le résultat', async () => {
      state.result = {
        data: [
          { user_id: 'u1', prenom: 'Alice', nom: null },
          { user_id: 'u2', prenom: null, nom: 'Martin' },
        ],
      };

      const result = await fetchActivityTeam();

      expect(result).toEqual([
        { id: 'u1', name: 'Alice' },
        { id: 'u2', name: 'Martin' },
      ]);
    });

    it("renvoie 'Sans nom' quand prénom et nom sont vides", async () => {
      state.result = {
        data: [{ user_id: 'u3', prenom: '', nom: '' }],
      };

      const result = await fetchActivityTeam();

      expect(result).toEqual([{ id: 'u3', name: 'Sans nom' }]);
    });

    it('renvoie un tableau vide quand data est null (erreur supabase)', async () => {
      state.result = { data: null };

      const result = await fetchActivityTeam();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('fetchActivityEtablissements', () => {
    it('mappe les établissements en { id, name }', async () => {
      state.result = {
        data: [
          { id: 'e1', nom: 'Lycée Hugo' },
          { id: 'e2', nom: 'Collège Zola' },
        ],
      };

      const result = await fetchActivityEtablissements();

      expect(mockFrom).toHaveBeenCalledWith('etablissements');
      expect(result).toEqual([
        { id: 'e1', name: 'Lycée Hugo' },
        { id: 'e2', name: 'Collège Zola' },
      ]);
    });

    it('renvoie un tableau vide quand data est null', async () => {
      state.result = { data: null };

      const result = await fetchActivityEtablissements();

      expect(result).toEqual([]);
    });
  });
});