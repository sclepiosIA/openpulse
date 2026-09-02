/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmailSenderLogo } from './useEmailSenderLogo';

const {
  MARQUE_LOGO,
  AUTH_STATE,
  MAPPING_ETABLISSEMENT_LOGO,
  MAPPING_GROUPE_LOGO,
  MAPPING_GROUPE_SANS_LOGO,
  MEMBER_WITH_LOGO,
  NULL_RESULT,
  mockIsMarqueEmail,
  mockFrom,
  responseQueue,
  calls,
} = vi.hoisted(() => ({
  MARQUE_LOGO: '/mocked/placeholder.svg',
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  MAPPING_ETABLISSEMENT_LOGO: {
    etablissement_id: 'e1',
    groupe_id: null,
    etablissement: { id: 'e1', nom: 'Clinique du Lac', logo_url: 'https://cdn.test/lac.png' },
    groupe: null,
  },
  MAPPING_GROUPE_LOGO: {
    etablissement_id: null,
    groupe_id: 'g1',
    etablissement: null,
    groupe: { id: 'g1', nom: 'Groupe Santé', logo_url: 'https://cdn.test/groupe.png' },
  },
  MAPPING_GROUPE_SANS_LOGO: {
    etablissement_id: null,
    groupe_id: 'g2',
    etablissement: null,
    groupe: { id: 'g2', nom: 'Alliance Médicale', logo_url: null },
  },
  MEMBER_WITH_LOGO: {
    etablissement: { id: 'e2', nom: 'Hôpital Central', logo_url: 'https://cdn.test/member.png' },
  },
  NULL_RESULT: null,
  mockIsMarqueEmail: vi.fn(),
  mockFrom: vi.fn(),
  responseQueue: [] as Array<{
    table?: string;
    result: { data: unknown; error: { message: string } | null };
  }>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

vi.mock('@/assets/marque/logo.png', () => ({
  default: MARQUE_LOGO,
}));

vi.mock('@/lib/internalEmailConfig', () => ({
  isMarqueEmail: mockIsMarqueEmail,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

function pushResponse(table: string | undefined, data: unknown, error: { message: string } | null = null) {
  responseQueue.push({
    table,
    result: { data, error },
  });
}

function shiftResponse(table: string) {
  const index = responseQueue.findIndex((item) => item.table === undefined || item.table === table);
  if (index === -1) {
    return { data: null, error: null };
  }
  const [item] = responseQueue.splice(index, 1);
  return item.result;
}

function createBuilder(table: string) {
  const builder = {
    select: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'select', args });
      return builder;
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'eq', args });
      return builder;
    }),
    gte: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'gte', args });
      return builder;
    }),
    lte: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'lte', args });
      return builder;
    }),
    in: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'in', args });
      return builder;
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'order', args });
      return builder;
    }),
    limit: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'limit', args });
      return builder;
    }),
    insert: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'insert', args });
      return builder;
    }),
    update: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'update', args });
      return builder;
    }),
    delete: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'delete', args });
      return builder;
    }),
    not: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'not', args });
      return builder;
    }),
    single: vi.fn(async () => {
      calls.push({ table, method: 'single', args: [] });
      const result = shiftResponse(table);
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result;
    }),
    maybeSingle: vi.fn(async () => {
      calls.push({ table, method: 'maybeSingle', args: [] });
      const result = shiftResponse(table);
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result;
    }),
    then: (
      onFulfilled?: ((value: { data: unknown; error: { message: string } | null }) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => {
      const result = shiftResponse(table);
      const promise = result.error
        ? Promise.reject(new Error(result.error.message))
        : Promise.resolve(result);
      return promise.then(onFulfilled ?? undefined, onRejected ?? undefined);
    },
    catch: (onRejected?: ((reason: unknown) => unknown) | null) => {
      const result = shiftResponse(table);
      const promise = result.error
        ? Promise.reject(new Error(result.error.message))
        : Promise.resolve(result);
      return promise.catch(onRejected ?? undefined);
    },
  };
  return builder;
}

mockFrom.mockImplementation((table: string) => {
  calls.push({ table, method: 'from', args: [table] });
  return createBuilder(table);
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useEmailSenderLogo', () => {
  beforeEach(() => {
    responseQueue.length = 0;
    calls.length = 0;
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      calls.push({ table, method: 'from', args: [table] });
      return createBuilder(table);
    });
  });

  it('retourne isLoading puis le logo interne pour un email OpenPulse sans interroger Supabase', async () => {
    mockIsMarqueEmail.mockReturnValue(true);

    const { result } = renderHook(() => useEmailSenderLogo('medecin@marque.fr'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      type: 'internal',
      logoUrl: MARQUE_LOGO,
    });
    expect(mockIsMarqueEmail).toHaveBeenCalledWith('medecin@marque.fr');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retourne le logo de l’établissement quand un mapping établissement avec logo existe', async () => {
    mockIsMarqueEmail.mockReturnValue(false);
    pushResponse('email_domain_mappings', MAPPING_ETABLISSEMENT_LOGO);

    const { result } = renderHook(() => useEmailSenderLogo('contact@clinique-lac.example.org'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      type: 'etablissement',
      logoUrl: 'https://cdn.test/lac.png',
      entityName: 'Clinique du Lac',
    });
    expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
    expect(calls).toContainEqual({ table: 'email_domain_mappings', method: 'eq', args: ['domain', 'clinique-lac.example.org'] });
    expect(calls).toContainEqual({ table: 'email_domain_mappings', method: 'eq', args: ['is_excluded', false] });
    expect(calls.some((call) => call.table === 'etablissements_groupes')).toBe(false);
  });

  it('retourne le logo du groupe quand le mapping groupe contient un logo', async () => {
    mockIsMarqueEmail.mockReturnValue(false);
    pushResponse('email_domain_mappings', MAPPING_GROUPE_LOGO);

    const { result } = renderHook(() => useEmailSenderLogo('direction@groupe-sante.fr'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      type: 'groupe',
      logoUrl: 'https://cdn.test/groupe.png',
      entityName: 'Groupe Santé',
    });
    expect(calls.some((call) => call.table === 'etablissements_groupes')).toBe(false);
  });

  it('utilise le fallback sur un établissement membre quand le groupe n’a pas de logo', async () => {
    mockIsMarqueEmail.mockReturnValue(false);
    pushResponse('email_domain_mappings', MAPPING_GROUPE_SANS_LOGO);
    pushResponse('etablissements_groupes', MEMBER_WITH_LOGO);

    const { result } = renderHook(() => useEmailSenderLogo('admin@alliance-medicale.fr'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      type: 'groupe',
      logoUrl: 'https://cdn.test/member.png',
      entityName: 'Alliance Médicale',
    });
    expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
    expect(mockFrom).toHaveBeenCalledWith('etablissements_groupes');
    expect(calls).toContainEqual({ table: 'etablissements_groupes', method: 'eq', args: ['groupe_id', 'g2'] });
    expect(calls).toContainEqual({ table: 'etablissements_groupes', method: 'not', args: ['etablissement.logo_url', 'is', null] });
    expect(calls).toContainEqual({ table: 'etablissements_groupes', method: 'limit', args: [1] });
  });

  it('retourne null quand aucun mapping exploitable n’est trouvé', async () => {
    mockIsMarqueEmail.mockReturnValue(false);
    pushResponse('email_domain_mappings', NULL_RESULT);

    const { result } = renderHook(() => useEmailSenderLogo('user@inconnu.fr'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
    expect(calls).toContainEqual({ table: 'email_domain_mappings', method: 'eq', args: ['domain', 'inconnu.fr'] });
  });

  it('passe en erreur quand Supabase renvoie une erreur', async () => {
    mockIsMarqueEmail.mockReturnValue(false);
    pushResponse('email_domain_mappings', null, { message: 'x' });

    const { result } = renderHook(() => useEmailSenderLogo('contact@erreur.fr'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
    expect(mockFrom).toHaveBeenCalledWith('email_domain_mappings');
  });

  it('n’exécute pas la query quand email est absent', () => {
    mockIsMarqueEmail.mockReturnValue(false);

    const { result } = renderHook(() => useEmailSenderLogo(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockIsMarqueEmail).not.toHaveBeenCalled();
  });
});