/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useEtablissementsWithDocuments } from './useEtablissementsWithDocuments';

const {
  ROWS,
  ERROR_RESULT,
  SUCCESS_RESULT,
  AUTH_STATE,
  mockFromExtended,
  mockSelect,
  mockOrder,
  mockLimit,
} = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'etab-1',
      nom: 'Alpha Clinique',
      ville: 'Lyon',
      logo_url: 'logo-alpha',
      etablissement_logo_url: 'etab-logo-alpha',
      groupe_logo_url: 'groupe-logo-alpha',
      groupe_nom: 'Groupe Alpha',
      statut: 'actif',
      document_count: 3,
    },
    {
      id: 'etab-2',
      nom: 'Beta Centre',
      ville: null,
      logo_url: null,
      etablissement_logo_url: null,
      groupe_logo_url: 'groupe-logo-beta',
      groupe_nom: 'Groupe Beta',
      statut: null,
      document_count: '0',
    },
  ];

  const SUCCESS_RESULT = { data: ROWS, error: null };
  const ERROR_RESULT = { data: null, error: { message: 'x' } };

  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const mockSelect = vi.fn();
  const mockOrder = vi.fn();
  const mockLimit = vi.fn();
  const mockFromExtended = vi.fn();

  return {
    ROWS,
    ERROR_RESULT,
    SUCCESS_RESULT,
    AUTH_STATE,
    mockFromExtended,
    mockSelect,
    mockOrder,
    mockLimit,
  };
});

vi.mock('@/lib/supabaseTyped', () => ({
  fromExtended: mockFromExtended,
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

function createThenableBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: mockSelect.mockImplementation(() => builder),
    order: mockOrder.mockImplementation(() => builder),
    limit: mockLimit.mockImplementation(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected),
  };

  return builder;
}

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

describe('useEtablissementsWithDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passe de isLoading à success et mappe correctement les établissements avec document_count numérique', async () => {
    const builder = createThenableBuilder(SUCCESS_RESULT);
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useEtablissementsWithDocuments(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockFromExtended).toHaveBeenCalledWith('etablissements_with_documents');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockSelect).toHaveBeenCalledWith(
      'id, nom, ville, logo_url, etablissement_logo_url, groupe_logo_url, groupe_nom, statut, document_count'
    );
    expect(mockOrder).toHaveBeenCalledWith('nom', { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(1000);

    expect(result.current.data).toEqual([
      {
        id: 'etab-1',
        nom: 'Alpha Clinique',
        ville: 'Lyon',
        logo_url: 'logo-alpha',
        etablissement_logo_url: 'etab-logo-alpha',
        groupe_logo_url: 'groupe-logo-alpha',
        groupe_nom: 'Groupe Alpha',
        statut: 'actif',
        document_count: 3,
      },
      {
        id: 'etab-2',
        nom: 'Beta Centre',
        ville: null,
        logo_url: null,
        etablissement_logo_url: null,
        groupe_logo_url: 'groupe-logo-beta',
        groupe_nom: 'Groupe Beta',
        statut: null,
        document_count: 0,
      },
    ]);

    expect(result.current.data?.[1]?.document_count).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('retourne une erreur React Query quand la requête échoue', async () => {
    const builder = createThenableBuilder(ERROR_RESULT);
    mockFromExtended.mockReturnValue(builder);

    const { result } = renderHook(() => useEtablissementsWithDocuments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockFromExtended).toHaveBeenCalledWith('etablissements_with_documents');
    expect(mockSelect).toHaveBeenCalledWith(
      'id, nom, ville, logo_url, etablissement_logo_url, groupe_logo_url, groupe_nom, statut, document_count'
    );
    expect(mockOrder).toHaveBeenCalledWith('nom', { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(1000);
    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('x');
  });
});