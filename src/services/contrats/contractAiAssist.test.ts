/* @vitest-environment jsdom */

const {
  AUTH_STATE,
  INVOKE_RESULT_SUCCESS,
  INVOKE_RESULT_ERROR,
  mockInvoke,
  mockFrom,
  mockUseAuth,
  mockToastSuccess,
  mockToastError,
  mockNavigate,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  INVOKE_RESULT_SUCCESS: {
    data: { result: 'Clause reformulée avec succès' },
    error: null,
  },
  INVOKE_RESULT_ERROR: {
    data: null,
    error: { message: 'x' },
  },
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
  mockUseAuth: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      like: vi.fn(() => builder),
      is: vi.fn(() => builder),
      or: vi.fn(() => builder),
      not: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    };
    return builder;
  };

  return {
    supabase: {
      from: mockFrom.mockImplementation(() => createBuilder()),
      functions: {
        invoke: mockInvoke,
      },
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mockUseAuth.mockImplementation(() => AUTH_STATE),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: mockUseAuth.mockImplementation(() => AUTH_STATE),
  AuthProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: mockUseAuth.mockImplementation(() => AUTH_STATE),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { callContractAiAssist } from './contractAiAssist';

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

describe('callContractAiAssist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockImplementation(() => AUTH_STATE);
  });

  it('retourne le résultat métier de la fonction edge avec les bons paramètres', async () => {
    mockInvoke.mockResolvedValue(INVOKE_RESULT_SUCCESS);

    const params = {
      action: 'rewrite',
      content: 'Le prestataire livre sous 30 jours.',
      sectionTitle: 'Délais',
      customPrompt: 'Rendre la clause plus protectrice pour le client',
    };

    const result = await callContractAiAssist(params);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('contract-ai-assist', {
      body: {
        action: 'rewrite',
        content: 'Le prestataire livre sous 30 jours.',
        sectionTitle: 'Délais',
        customPrompt: 'Rendre la clause plus protectrice pour le client',
      },
    });
    expect(result).toEqual({ result: 'Clause reformulée avec succès' });
    expect(result.result).toBe('Clause reformulée avec succès');
    expect(result.error).toBeUndefined();
  });

  it('propage l’erreur quand la fonction edge renvoie une erreur', async () => {
    mockInvoke.mockResolvedValue(INVOKE_RESULT_ERROR);

    await expect(
      callContractAiAssist({
        action: 'summarize',
        content: 'Texte contractuel',
      }),
    ).rejects.toEqual({ message: 'x' });

    expect(mockInvoke).toHaveBeenCalledWith('contract-ai-assist', {
      body: {
        action: 'summarize',
        content: 'Texte contractuel',
      },
    });
  });

  it('retourne un objet vide quand data est null et sans erreur', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    const result = await callContractAiAssist({
      action: 'analyze',
      content: 'Clause de résiliation',
    });

    expect(result).toEqual({});
  });

  it('peut être utilisé dans un flux async observé via renderHook: chargement puis succès', async () => {
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(INVOKE_RESULT_SUCCESS), 0);
        }),
    );

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState<{
          isLoading: boolean;
          isError: boolean;
          data: string | null;
          error: string | null;
        }>({
          isLoading: true,
          isError: false,
          data: null,
          error: null,
        });

        React.useEffect(() => {
          let active = true;
          callContractAiAssist({
            action: 'rewrite',
            content: 'Clause initiale',
            sectionTitle: 'Objet',
          })
            .then((res) => {
              if (active) {
                setState({
                  isLoading: false,
                  isError: false,
                  data: res.result ?? null,
                  error: null,
                });
              }
            })
            .catch((err: { message?: string }) => {
              if (active) {
                setState({
                  isLoading: false,
                  isError: true,
                  data: null,
                  error: err.message ?? null,
                });
              }
            });

          return () => {
            active = false;
          };
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBe('Clause reformulée avec succès');
    expect(result.current.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith('contract-ai-assist', {
      body: {
        action: 'rewrite',
        content: 'Clause initiale',
        sectionTitle: 'Objet',
      },
    });
  });

  it('peut être utilisé dans un flux async observé via renderHook: chargement puis erreur', async () => {
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(INVOKE_RESULT_ERROR), 0);
        }),
    );

    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const [state, setState] = React.useState<{
          isLoading: boolean;
          isError: boolean;
          data: string | null;
          error: string | null;
        }>({
          isLoading: true,
          isError: false,
          data: null,
          error: null,
        });

        React.useEffect(() => {
          let active = true;
          callContractAiAssist({
            action: 'summarize',
            content: 'Clause source',
          })
            .then((res) => {
              if (active) {
                setState({
                  isLoading: false,
                  isError: false,
                  data: res.result ?? null,
                  error: null,
                });
              }
            })
            .catch((err: { message?: string }) => {
              if (active) {
                setState({
                  isLoading: false,
                  isError: true,
                  data: null,
                  error: err.message ?? null,
                });
              }
            });

          return () => {
            active = false;
          };
        }, []);

        return state;
      },
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('x');
    expect(mockInvoke).toHaveBeenCalledWith('contract-ai-assist', {
      body: {
        action: 'summarize',
        content: 'Clause source',
      },
    });
  });
});