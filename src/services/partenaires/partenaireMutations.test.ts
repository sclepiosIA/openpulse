import { savePartenaireNote } from './partenaireMutations';

const { mockFrom, builder, state } = vi.hoisted(() => {
  const state: { result: { error: { message: string } | null } } = {
    result: { error: null },
  };
  type Builder = {
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: (
      resolve: (v: { error: { message: string } | null }) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise<unknown>;
  };
  const builder = {} as Builder;
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.then = (resolve, reject) =>
    Promise.resolve(state.result).then(resolve, reject);
  const mockFrom = vi.fn(() => builder);
  return { mockFrom, builder, state };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

describe('savePartenaireNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.result = { error: null };
  });

  it('met à jour la note et le dernier_contact du partenaire ciblé', async () => {
    await expect(
      savePartenaireNote('part-42', 'Nouvelle note de suivi'),
    ).resolves.toBeUndefined();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('partenaires');

    expect(builder.update).toHaveBeenCalledTimes(1);
    const updatePayload = builder.update.mock.calls[0][0] as {
      notes: string;
      dernier_contact: string;
    };
    expect(updatePayload.notes).toBe('Nouvelle note de suivi');
    expect(updatePayload.dernier_contact).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(
      Number.isNaN(Date.parse(updatePayload.dernier_contact)),
    ).toBe(false);

    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('id', 'part-42');
  });

  it('utilise une date récente pour dernier_contact', async () => {
    const before = Date.now();
    await savePartenaireNote('part-1', 'note');
    const after = Date.now();

    const updatePayload = builder.update.mock.calls[0][0] as {
      dernier_contact: string;
    };
    const ts = Date.parse(updatePayload.dernier_contact);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("lève l'erreur supabase quand la mise à jour échoue", async () => {
    state.result = { error: { message: 'update refusée' } };

    await expect(
      savePartenaireNote('part-99', 'note en échec'),
    ).rejects.toEqual({ message: 'update refusée' });

    expect(mockFrom).toHaveBeenCalledWith('partenaires');
    expect(builder.eq).toHaveBeenCalledWith('id', 'part-99');
  });

  it('propage une note vide sans la filtrer', async () => {
    await savePartenaireNote('part-7', '');

    const updatePayload = builder.update.mock.calls[0][0] as {
      notes: string;
    };
    expect(updatePayload.notes).toBe('');
    expect(builder.eq).toHaveBeenCalledWith('id', 'part-7');
  });
});