import { updateEtablissementBackendUrl } from './etablissementMutations';

const { mockFrom, mockUpdate, mockEq, mockBuilder } = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();

  const builder: any = {
    update: (payload: unknown) => {
      mockUpdate(payload);
      return builder;
    },
    eq: (...args: unknown[]) => {
      mockEq(...args);
      return Promise.resolve({ data: null, error: null });
    },
    select: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (...args: unknown[]) =>
      Promise.resolve({ data: null, error: null }).then(
        args[0] as (value: unknown) => unknown,
        args[1] as (reason: unknown) => unknown,
      ),
    catch: (...args: unknown[]) =>
      Promise.resolve({ data: null, error: null }).catch(
        args[0] as (reason: unknown) => unknown,
      ),
  };

  const mockFrom = vi.fn(() => builder);

  return {
    mockFrom,
    mockUpdate,
    mockEq,
    mockBuilder: builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('updateEtablissementBackendUrl', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();

    // réinitialise le comportement par défaut du builder
    (mockBuilder as any).update = (payload: unknown) => {
      mockUpdate(payload);
      return {
        eq: (...args: unknown[]) => {
          mockEq(...args);
          return Promise.resolve({ data: null, error: null });
        },
      };
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('appelle supabase avec les bons paramètres pour une URL non nulle', async () => {
    const etablissementId = 'eta-123';
    const backendUrl = 'https://backend.example.com';

    await updateEtablissementBackendUrl(etablissementId, backendUrl);

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockUpdate).toHaveBeenCalledWith({ backend_url: backendUrl });
    expect(mockEq).toHaveBeenCalledWith('id', etablissementId);
  });

  it('appelle supabase avec backend_url à null', async () => {
    const etablissementId = 'eta-456';
    const backendUrl: string | null = null;

    await updateEtablissementBackendUrl(etablissementId, backendUrl);

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockUpdate).toHaveBeenCalledWith({ backend_url: null });
    expect(mockEq).toHaveBeenCalledWith('id', etablissementId);
  });

  it('lance une erreur si supabase renvoie une erreur', async () => {
    const supabaseError = new Error('update failed');

    (mockBuilder as any).update = (payload: unknown) => {
      mockUpdate(payload);
      return {
        eq: (...args: unknown[]) => {
          mockEq(...args);
          return Promise.resolve({ data: null, error: supabaseError });
        },
      };
    };

    const etablissementId = 'eta-789';
    const backendUrl = 'https://backend2.example.com';

    await expect(
      updateEtablissementBackendUrl(etablissementId, backendUrl),
    ).rejects.toThrow('update failed');

    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(mockUpdate).toHaveBeenCalledWith({ backend_url: backendUrl });
    expect(mockEq).toHaveBeenCalledWith('id', etablissementId);
  });
})