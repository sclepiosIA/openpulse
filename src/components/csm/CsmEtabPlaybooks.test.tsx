// @vitest-environment jsdom

import React from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor, fireEvent, renderHook, act, within } from '@testing-library/react';
import { CsmEtabPlaybooks } from './CsmEtabPlaybooks';

const {
  PLAYBOOKS,
  EXECUTIONS,
  AUTH_STATE,
  EVALUATE_MUTATE,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const PLAYBOOKS = [
    { id: 'pb-1', name: 'Relance onboarding' },
    { id: 'pb-2', name: 'Prévenir churn' },
  ];

  const EXECUTIONS = [
    {
      id: 'exec-1',
      playbook_id: 'pb-1',
      status: 'pending',
      current_step_order: 2,
      next_action_at: '2024-01-12T14:30:00.000Z',
      started_at: '2024-01-10T09:00:00.000Z',
      last_error: null,
    },
    {
      id: 'exec-2',
      playbook_id: 'pb-2',
      status: 'running',
      current_step_order: 4,
      next_action_at: null,
      started_at: '2024-01-11T10:00:00.000Z',
      last_error: null,
    },
    {
      id: 'exec-3',
      playbook_id: 'pb-1',
      status: 'completed',
      current_step_order: 5,
      next_action_at: null,
      started_at: '2024-01-05T08:15:00.000Z',
      last_error: null,
    },
    {
      id: 'exec-4',
      playbook_id: 'pb-2',
      status: 'failed',
      current_step_order: 3,
      next_action_at: null,
      started_at: '2024-01-06T16:45:00.000Z',
      last_error: 'Envoi email impossible',
    },
  ];

  const AUTH_STATE = {
    user: { id: 'u1', email: 'u@test.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const EVALUATE_MUTATE = vi.fn();

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
    upsert: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: <TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ) => Promise<{ data: null; error: null } | TResult>;
  } = {} as never;

  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.upsert = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (onfulfilled, onrejected) =>
    Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
  builder.catch = onrejected => Promise.resolve({ data: null, error: null }).catch(onrejected);

  const mockFrom = vi.fn(() => builder);

  return { PLAYBOOKS, EXECUTIONS, AUTH_STATE, EVALUATE_MUTATE, mockFrom, builder };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
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

vi.mock('react-router-dom', async () => {
  const ReactModule = await import('react');
  return {
    Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href: to }, children),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => React.createElement('svg', { className });
  return {
    Play: Icon,
    Activity: Icon,
    CheckCircle2: Icon,
    AlertCircle: Icon,
    Clock: Icon,
    BookOpen: Icon,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h4>{children}</h4>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    asChild,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    asChild?: boolean;
  }) =>
    asChild ? <div>{children}</div> : <button onClick={onClick} disabled={disabled}>{children}</button>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock('@/hooks/csm/useCsmPlaybooks', () => {
  function useCsmPlaybooks() {
    return useQuery({
      queryKey: ['csm-playbooks-test'],
      queryFn: async () => PLAYBOOKS,
    });
  }

  function useCsmPlaybookExecutionsByEtablissement(etablissementId: string) {
    return useQuery({
      queryKey: ['csm-playbook-executions-test', etablissementId],
      queryFn: async () => EXECUTIONS,
    });
  }

  function useEvaluatePlaybooksForEtablissement() {
    return useMutation({
      mutationFn: async (etablissementId: string) => {
        EVALUATE_MUTATE(etablissementId);
        return { ok: true, etablissementId };
      },
    });
  }

  return {
    useCsmPlaybooks,
    useCsmPlaybookExecutionsByEtablissement,
    useEvaluatePlaybooksForEtablissement,
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
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('CsmEtabPlaybooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le chargement puis les exécutions en cours et l’historique avec les valeurs métier attendues', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const hooks = useStableMockedHooks();
        return hooks.useCsmPlaybookExecutionsByEtablissement('etab-1');
      },
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    render(<CsmEtabPlaybooks etablissementId="etab-1" />, { wrapper });

    expect(screen.getAllByTestId('skeleton')).toHaveLength(2);

    await waitFor(() => {
      expect(screen.getByText('Exécutions en cours (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('Historique (2)')).toBeInTheDocument();

    const runningSection = screen.getByText('Exécutions en cours (2)').closest('section');
    const historySection = screen.getByText('Historique (2)').closest('section');

    expect(runningSection).not.toBeNull();
    expect(historySection).not.toBeNull();

    if (runningSection && historySection) {
      expect(within(runningSection).getByText('Relance onboarding')).toBeInTheDocument();
      expect(within(runningSection).getByText('Prévenir churn')).toBeInTheDocument();
      expect(within(historySection).getByText('Relance onboarding')).toBeInTheDocument();
      expect(within(historySection).getByText('Prévenir churn')).toBeInTheDocument();

      expect(within(runningSection).getByText(/Étape 2/i)).toBeInTheDocument();
      expect(within(runningSection).getByText(/Étape 4/i)).toBeInTheDocument();
      expect(within(runningSection).getByText(/prochaine action/i)).toBeInTheDocument();

      expect(within(runningSection).getByText('pending')).toBeInTheDocument();
      expect(within(runningSection).getByText('running')).toBeInTheDocument();

      expect(within(historySection).getByText('completed')).toBeInTheDocument();
      expect(within(historySection).getByText('failed')).toBeInTheDocument();
      expect(within(historySection).getByText('Envoi email impossible')).toBeInTheDocument();
    }

    expect(screen.getByRole('link', { name: 'Configurer' })).toHaveAttribute('href', '/playbooks-csm');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toEqual(EXECUTIONS);
    });
  });

  it('déclenche la mutation d’évaluation avec l’identifiant de l’établissement', async () => {
    const wrapper = createWrapper();
    render(<CsmEtabPlaybooks etablissementId="etab-42" />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /évaluer maintenant/i })).toBeEnabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /évaluer maintenant/i }));
    });

    await waitFor(() => {
      expect(EVALUATE_MUTATE).toHaveBeenCalledWith('etab-42');
    });
  });

  it('passe en erreur quand le hook d’exécutions renvoie { data:null, error }', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['csm-playbook-executions-error-test', 'etab-error'],
          queryFn: async () => {
            const response = { data: null, error: { message: 'x' } };
            if (response.error) {
              throw new Error(response.error.message);
            }
            return response.data;
          },
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('x');
  });
});

function useStableMockedHooks() {
  return {
    useCsmPlaybookExecutionsByEtablissement: (etablissementId: string) =>
      useQuery({
        queryKey: ['csm-playbook-executions-test', etablissementId],
        queryFn: async () => EXECUTIONS,
      }),
  };
}