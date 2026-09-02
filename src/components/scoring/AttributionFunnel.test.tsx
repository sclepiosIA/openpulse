/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AttributionFunnel } from './AttributionFunnel';
import { useProspectAttribution } from '@/hooks/crm/useProspectAttribution';

const {
  STABLE_AUTH,
  HOOK_STATE,
  mockUseProspectAttribution,
  mockFrom,
} = vi.hoisted(() => {
  const STABLE_AUTH = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const HOOK_STATE: {
    data:
      | {
          by_channel?: Record<string, number>;
          first_touch?: { channel: string; occurred_at: string };
          last_touch?: { channel: string; occurred_at: string };
        }
      | null
      | undefined;
    isLoading: boolean;
    isError: boolean;
    error: { message: string } | null;
  } = {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  };

  const mockUseProspectAttribution = vi.fn((etablissementId: string) => ({
    data: HOOK_STATE.data,
    isLoading: HOOK_STATE.isLoading,
    isError: HOOK_STATE.isError,
    error: HOOK_STATE.error,
    etablissementId,
  }));

  const createBuilder = () => {
    const result = { data: null, error: null };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      like: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      overlaps: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => result),
      maybeSingle: vi.fn(async () => result),
      then: (
        onFulfilled?: (value: typeof result) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(result).catch(onRejected),
      finally: (onFinally?: (() => void) | undefined) =>
        Promise.resolve(result).finally(onFinally),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());

  return {
    STABLE_AUTH,
    HOOK_STATE,
    mockUseProspectAttribution,
    mockFrom,
  };
});

vi.mock('@/hooks/crm/useProspectAttribution', () => ({
  useProspectAttribution: mockUseProspectAttribution,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  GitBranch: ({ className }: { className?: string }) => <svg data-testid="git-branch" className={className} />,
}));

vi.mock('@/types/scoring', () => ({
  ATTRIBUTION_CHANNEL_LABELS: {
    organic: 'Organique',
    paid: 'Publicité',
    referral: 'Parrainage',
    direct: 'Direct',
    email: 'Email',
    social: 'Réseaux sociaux',
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => STABLE_AUTH,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => STABLE_AUTH,
}));

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

describe('AttributionFunnel', () => {
  beforeEach(() => {
    HOOK_STATE.data = undefined;
    HOOK_STATE.isLoading = false;
    HOOK_STATE.isError = false;
    HOOK_STATE.error = null;
    mockUseProspectAttribution.mockClear();
    mockFrom.mockClear();
  });

  it('appelle le hook avec l’etablissementId via renderHook et expose l’état de chargement', () => {
    HOOK_STATE.isLoading = true;
    HOOK_STATE.data = undefined;

    const { result } = renderHook(() => useProspectAttribution('eta-hook'), {
      wrapper: createWrapper(),
    });

    expect(mockUseProspectAttribution).toHaveBeenCalledWith('eta-hook');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();

    render(<AttributionFunnel etablissementId="eta-hook" />, { wrapper: createWrapper() });

    expect(screen.getByText('Attribution multi-touch')).toBeInTheDocument();
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Aucun touchpoint enregistré.')).not.toBeInTheDocument();
  });

  it('affiche les canaux triés, les poids, les progressions et les dates first/last touch', () => {
    HOOK_STATE.isLoading = false;
    HOOK_STATE.data = {
      by_channel: {
        paid: 12,
        organic: 7,
        referral: 3,
      },
      first_touch: {
        channel: 'organic',
        occurred_at: '2024-01-15T10:00:00.000Z',
      },
      last_touch: {
        channel: 'paid',
        occurred_at: '2024-03-20T14:00:00.000Z',
      },
    };

    render(<AttributionFunnel etablissementId="eta-2" />, { wrapper: createWrapper() });

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars).toHaveLength(3);

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(3);
    expect(badges[0]).toHaveTextContent('12');
    expect(badges[1]).toHaveTextContent('7');
    expect(badges[2]).toHaveTextContent('3');

    const paidRow = badges[0].closest('div');
    const organicRow = badges[1].closest('div');
    const referralRow = badges[2].closest('div');

    expect(paidRow).toHaveTextContent('Publicité');
    expect(organicRow).toHaveTextContent('Organique');
    expect(referralRow).toHaveTextContent('Parrainage');

    expect(progressBars[0]).toHaveAttribute('data-value', '100');
    expect(progressBars[1]).toHaveAttribute('data-value', String((7 / 12) * 100));
    expect(progressBars[2]).toHaveAttribute('data-value', String((3 / 12) * 100));

    expect(screen.getByText('First touch')).toBeInTheDocument();
    expect(screen.getByText('Last touch')).toBeInTheDocument();
    expect(screen.getByText('15 janv. 2024')).toBeInTheDocument();
    expect(screen.getByText('20 mars 2024')).toBeInTheDocument();

    expect(screen.getAllByText('Organique')).toHaveLength(2);
    expect(screen.getAllByText('Publicité')).toHaveLength(2);
    expect(screen.getAllByText('Parrainage')).toHaveLength(1);
  });

  it('affiche le message vide quand aucun touchpoint n’est disponible', () => {
    HOOK_STATE.isLoading = false;
    HOOK_STATE.data = {
      by_channel: {},
    };

    render(<AttributionFunnel etablissementId="eta-3" />, { wrapper: createWrapper() });

    expect(screen.getByText('Aucun touchpoint enregistré.')).toBeInTheDocument();
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument();
    expect(screen.queryByText('First touch')).not.toBeInTheDocument();
    expect(screen.queryByText('Last touch')).not.toBeInTheDocument();
  });

  it('en cas d’erreur du hook, expose isError via renderHook et retombe sur l’état vide côté composant', () => {
    HOOK_STATE.isLoading = false;
    HOOK_STATE.isError = true;
    HOOK_STATE.error = { message: 'x' };
    HOOK_STATE.data = null;

    const { result } = renderHook(() => useProspectAttribution('eta-4'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeNull();

    render(<AttributionFunnel etablissementId="eta-4" />, { wrapper: createWrapper() });

    expect(mockUseProspectAttribution).toHaveBeenCalledWith('eta-4');
    expect(screen.getByText('Aucun touchpoint enregistré.')).toBeInTheDocument();
    expect(screen.queryByText('First touch')).not.toBeInTheDocument();
    expect(screen.queryByText('Last touch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument();
  });
});