import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEtablissementBySlug } from './useEtablissementBySlug';

const {
  ETABLISSEMENT_ROW,
  AUTH_STATE,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  builder,
} = vi.hoisted(() => {
  const ETABLISSEMENT_ROW = {
    id: 'etab-1',
    nom: 'Clinique du Centre',
    slug: 'clinique-centre',
    ville: 'Lyon',
    qr_access_token: 'tok-qr',
    qr_access_expires_at: '2026-01-01T10:00:00.000Z',
  };

  const AUTH_STATE = {
    user: { id: 'user-1', email: 'test@local.dev' },
    session: { user: { id: 'user-1' } },
    isLoading: false,
  };

  const builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  } = {} as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
  };

  const mockSelect = vi.fn(() => builder);
  const mockEq = vi.fn(() => builder);
  const mockSingle = vi.fn();

  builder.select = mockSelect;
  builder.eq = mockEq;
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = mockSingle;
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: ETABLISSEMENT_ROW, error: null }));
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve({ data: ETABLISSEMENT_ROW, error: null }).then(onFulfilled, onRejected);
  builder.catch = (onRejected) =>
    Promise.resolve({ data: ETABLISSEMENT_ROW, error: null }).catch(onRejected);

  const mockFrom = vi.fn(() => builder);

  return {
    ETABLISSEMENT_ROW,
    AUTH_STATE,
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    builder,
  };
});

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

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

describe('useEtablissementBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(builder);
    mockSelect.mockReturnValue(builder);
    mockEq.mockReturnValue(builder);
    mockSingle.mockResolvedValue({ data: ETABLISSEMENT_ROW, error: null });
  });

  it('démarre en chargement puis retourne les données de l’établissement pour un slug valide', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEtablissementBySlug('clinique-centre'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.fetchStatus).toBe('fetching');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements_public');
    expect(mockSelect).toHaveBeenCalledWith('id, nom, slug, ville, qr_access_token, qr_access_expires_at');
    expect(mockEq).toHaveBeenCalledWith('slug', 'clinique-centre');
    expect(mockSingle).toHaveBeenCalledTimes(1);

    expect(result.current.data).toEqual({
      id: 'etab-1',
      nom: 'Clinique du Centre',
      slug: 'clinique-centre',
      ville: 'Lyon',
      qr_access_token: 'tok-qr',
      qr_access_expires_at: '2026-01-01T10:00:00.000Z',
    });
  });

  it('passe en erreur quand Supabase renvoie une erreur', async () => {
    const wrapper = createWrapper();
    const supabaseError = { message: 'x' };

    mockSingle.mockResolvedValueOnce({ data: null, error: supabaseError });

    const { result } = renderHook(() => useEtablissementBySlug('clinique-centre'), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFrom).toHaveBeenCalledWith('etablissements_public');
    expect(mockEq).toHaveBeenCalledWith('slug', 'clinique-centre');
    expect(result.current.error).toEqual(supabaseError);
  });

  it('n’exécute pas la requête quand le slug est vide', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => useEtablissementBySlug(''), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockSingle).not.toHaveBeenCalled();
  });
});