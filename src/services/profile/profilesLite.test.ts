import { fetchProfilesLite, fetchProfilesLiteWithEmail, type ProfileLite } from './profilesLite';

const { ROWS, ROWS_EMAIL, mockFrom, createBuilder } = vi.hoisted(() => {
  const ROWS = [
    { id: 'p1', nom: 'Alpha', prenom: 'Anna' },
    { id: 'p2', nom: 'Beta', prenom: 'Bob' },
  ];
  const ROWS_EMAIL = [
    { id: 'p1', nom: 'Alpha', prenom: 'Anna', email: 'anna@example.com' },
    { id: 'p2', nom: 'Beta', prenom: 'Bob', email: null },
  ];
  const createBuilder = (result: { data: unknown; error: unknown }) => {
    const builder: Record<string, unknown> = {};
    const methods = ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'update', 'delete'];
    for (const m of methods) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected);
    builder.catch = (onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected);
    return builder;
  };
  const mockFrom = vi.fn();
  return { ROWS, ROWS_EMAIL, mockFrom, createBuilder };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: { from: mockFrom },
}));

describe('profilesLite', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  describe('fetchProfilesLite', () => {
    it('retourne les profils triés par nom en cas de succès', async () => {
      const builder = createBuilder({ data: ROWS, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await fetchProfilesLite();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(builder.select).toHaveBeenCalledWith('id, nom, prenom');
      expect(builder.order).toHaveBeenCalledWith('nom');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'p1', nom: 'Alpha', prenom: 'Anna' });
      expect(result[1].id).toBe('p2');
      expect(result[1].prenom).toBe('Bob');
    });

    it('retourne un tableau vide si data est null', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await fetchProfilesLite();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("lève l'erreur retournée par supabase", async () => {
      const builder = createBuilder({ data: null, error: { message: 'x' } });
      mockFrom.mockReturnValue(builder);

      await expect(fetchProfilesLite()).rejects.toEqual({ message: 'x' });
    });
  });

  describe('fetchProfilesLiteWithEmail', () => {
    it('retourne les profils avec email en cas de succès', async () => {
      const builder = createBuilder({ data: ROWS_EMAIL, error: null });
      mockFrom.mockReturnValue(builder);

      const result: ProfileLite[] = await fetchProfilesLiteWithEmail();

      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(builder.select).toHaveBeenCalledWith('id, nom, prenom, email');
      expect(builder.order).toHaveBeenCalledWith('nom');
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('anna@example.com');
      expect(result[1].email).toBeNull();
      expect(result[0].nom).toBe('Alpha');
    });

    it('retourne un tableau vide si data est null', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await fetchProfilesLiteWithEmail();

      expect(result).toEqual([]);
    });

    it("lève l'erreur retournée par supabase", async () => {
      const builder = createBuilder({ data: null, error: { message: 'x' } });
      mockFrom.mockReturnValue(builder);

      await expect(fetchProfilesLiteWithEmail()).rejects.toEqual({ message: 'x' });
    });
  });
});