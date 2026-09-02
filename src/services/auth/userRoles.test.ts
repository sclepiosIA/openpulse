const { mockFrom, mockSelect, mockEq, mockMaybeSingle } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  return { mockFrom, mockSelect, mockEq, mockMaybeSingle };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

import { fetchIsAdminForAuthUser } from './userRoles';

describe('fetchIsAdminForAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it('retourne true quand le rôle est admin', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });

    const result = await fetchIsAdminForAuthUser('u1');

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('user_roles');
    expect(mockSelect).toHaveBeenCalledWith('role');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u1');
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it('retourne false quand le rôle est différent de admin', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'user' }, error: null });

    const result = await fetchIsAdminForAuthUser('u2');

    expect(result).toBe(false);
    expect(mockEq).toHaveBeenCalledWith('user_id', 'u2');
  });

  it('retourne false quand aucune ligne trouvée (data null)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchIsAdminForAuthUser('u3');

    expect(result).toBe(false);
  });

  it('retourne false quand data est présent mais sans champ role', async () => {
    mockMaybeSingle.mockResolvedValue({ data: {}, error: null });

    const result = await fetchIsAdminForAuthUser('u4');

    expect(result).toBe(false);
  });

  it('retourne false en cas d\'erreur supabase (data null, error renseignée)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'x' } });

    const result = await fetchIsAdminForAuthUser('u5');

    expect(result).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('user_roles');
  });
});