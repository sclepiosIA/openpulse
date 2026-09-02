import { updateProfileEmailSignature } from './profileMutations';

const { STATE, mockFrom, builder, setNext } = vi.hoisted(() => {
  const STATE = {
    nextResponse: { data: null as unknown, error: null as unknown },
    last: { from: null as string | null, updateArgs: [] as unknown[][], eqArgs: [] as unknown[][] },
  };

  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn((...args: unknown[]) => {
      STATE.last.updateArgs.push(args);
      return builder;
    }),
    delete: vi.fn(() => builder),
    eq: vi.fn((...args: unknown[]) => {
      STATE.last.eqArgs.push(args);
      return builder;
    }),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(STATE.nextResponse)),
    maybeSingle: vi.fn(() => Promise.resolve(STATE.nextResponse)),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      const p = Promise.resolve(STATE.nextResponse);
      return p.then(onFulfilled, onRejected as any);
    },
    catch: (onRejected: (e: unknown) => unknown) => Promise.resolve(STATE.nextResponse).catch(onRejected),
  };

  const mockFrom = vi.fn((table: string) => {
    STATE.last.from = table;
    return builder;
  });

  const setNext = (resp: { data: unknown; error: unknown }) => {
    STATE.nextResponse = resp;
  };

  return { STATE, mockFrom, builder, setNext };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('updateProfileEmailSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    STATE.last.from = null;
    STATE.last.updateArgs = [];
    STATE.last.eqArgs = [];
  });

  it('met à jour la signature email du profil avec succès', async () => {
    setNext({ data: { ok: true }, error: null });
    const profileId = 'profile-123';
    const signature = 'Cordialement, L. Dupont';

    const result = await updateProfileEmailSignature(profileId, signature);

    expect(result).toBeUndefined();
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(STATE.last.from).toBe('profiles');

    expect(builder.update).toHaveBeenCalledTimes(1);
    expect(builder.update).toHaveBeenCalledWith({ email_signature: signature });

    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('id', profileId);
  });

  it('propage une erreur Supabase si la mise à jour échoue', async () => {
    const error = { message: 'update failed' };
    setNext({ data: null, error });
    const profileId = 'profile-err';
    const signature = 'Signature KO';

    await expect(updateProfileEmailSignature(profileId, signature)).rejects.toEqual(error);

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(builder.update).toHaveBeenCalledWith({ email_signature: signature });
    expect(builder.eq).toHaveBeenCalledWith('id', profileId);
  });
});