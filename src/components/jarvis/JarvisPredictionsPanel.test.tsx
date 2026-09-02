/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisPredictionsPanel } from './JarvisPredictionsPanel';
import { useJarvisEnhanced } from '@/hooks/jarvis/useJarvisEnhanced';

const {
  AUTH_STATE,
  SUPABASE_ROWS,
  mockFrom,
  mockUseJarvisEnhanced,
  mockRefetchPredictions,
  mockGetContextualPredictions,
  mockOnExecutePrediction,
  LOADING_STATE,
  SUCCESS_STATE,
  EMPTY_STATE,
  ERROR_STATE,
  CONTEXTUAL_PREDS,
  EMPTY_CONTEXTUAL_PREDS,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const SUPABASE_ROWS = [{ id: '1' }];

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(async () => ({ data: SUPABASE_ROWS[0], error: null })),
      maybeSingle: vi.fn(async () => ({ data: SUPABASE_ROWS[0], error: null })),
      then: (onFulfilled: (value: { data: typeof SUPABASE_ROWS; error: null }) => unknown) =>
        Promise.resolve({ data: SUPABASE_ROWS, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: SUPABASE_ROWS, error: null }).catch(onRejected),
    };
    return builder;
  };

  const mockFrom = vi.fn(() => createBuilder());
  const mockUseJarvisEnhanced = vi.fn();
  const mockRefetchPredictions = vi.fn();
  const mockGetContextualPredictions = vi.fn();
  const mockOnExecutePrediction = vi.fn();

  const CONTEXTUAL_PREDS = [
    {
      action: 'daily_briefing',
      probability: 0.92,
      reason: 'Vous lancez souvent votre journée par un briefing',
      executableCommand: 'daily briefing',
      category: 'routine',
    },
    {
      action: 'check_pipeline',
      probability: 0.74,
      reason: 'Le suivi commercial est fréquent à cette heure',
      executableCommand: 'open pipeline',
      category: 'sales',
    },
  ];

  const EMPTY_CONTEXTUAL_PREDS: Array<{
    action: string;
    probability: number;
    reason: string;
    executableCommand?: string;
    category?: string;
  }> = [];

  const SUCCESS_STATE = {
    predictions: [
      CONTEXTUAL_PREDS[0],
      CONTEXTUAL_PREDS[1],
      {
        action: 'review_tasks',
        probability: 0.55,
        reason: 'Vos tâches demandent une vérification régulière',
        executableCommand: 'show tasks',
        category: 'productivity',
      },
    ],
    behaviorStats: {
      total_actions: 128,
      peak_hours: [9, 14, 16],
      most_common_actions: ['daily_briefing', 'check_pipeline', 'review_tasks'],
    },
    isPredictionsLoading: false,
    getContextualPredictions: mockGetContextualPredictions,
    refetchPredictions: mockRefetchPredictions,
  };

  const LOADING_STATE = {
    predictions: [],
    behaviorStats: null,
    isPredictionsLoading: true,
    getContextualPredictions: mockGetContextualPredictions,
    refetchPredictions: mockRefetchPredictions,
  };

  const EMPTY_STATE = {
    predictions: [],
    behaviorStats: null,
    isPredictionsLoading: false,
    getContextualPredictions: mockGetContextualPredictions,
    refetchPredictions: mockRefetchPredictions,
  };

  const ERROR_STATE = {
    data: null,
    error: { message: 'x' },
    isError: true,
  };

  return {
    AUTH_STATE,
    SUPABASE_ROWS,
    mockFrom,
    mockUseJarvisEnhanced,
    mockRefetchPredictions,
    mockGetContextualPredictions,
    mockOnExecutePrediction,
    LOADING_STATE,
    SUCCESS_STATE,
    EMPTY_STATE,
    ERROR_STATE,
    CONTEXTUAL_PREDS,
    EMPTY_CONTEXTUAL_PREDS,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: AUTH_STATE.session }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: AUTH_STATE.user }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
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

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Sparkles: Icon,
    TrendingUp: Icon,
    Clock: Icon,
    Zap: Icon,
    Brain: Icon,
    ChevronRight: Icon,
    RefreshCw: Icon,
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    'aria-label': ariaLabel,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/hooks/jarvis/useJarvisEnhanced', () => ({
  useJarvisEnhanced: mockUseJarvisEnhanced,
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('JarvisPredictionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnExecutePrediction.mockReset();
    mockRefetchPredictions.mockReset();
    mockGetContextualPredictions.mockReset();
    mockUseJarvisEnhanced.mockReset();
  });

  it('affiche un état de chargement quand les prédictions chargent', () => {
    mockUseJarvisEnhanced.mockReturnValue(LOADING_STATE);
    mockGetContextualPredictions.mockReturnValue(EMPTY_CONTEXTUAL_PREDS);

    const { container } = render(<JarvisPredictionsPanel onExecutePrediction={mockOnExecutePrediction} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByText('Prédictions IA')).not.toBeInTheDocument();
    expect(container.querySelector('.py-6')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('affiche les statistiques, les prédictions contextuelles et les autres suggestions avec les bonnes valeurs métier', () => {
    mockUseJarvisEnhanced.mockReturnValue(SUCCESS_STATE);
    mockGetContextualPredictions.mockReturnValue(CONTEXTUAL_PREDS);

    render(<JarvisPredictionsPanel onExecutePrediction={mockOnExecutePrediction} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Prédictions IA')).toBeInTheDocument();

    expect(screen.getByText('Actions ce mois')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('Heures de pointe')).toBeInTheDocument();
    expect(screen.getByText('9h, 14h')).toBeInTheDocument();
    expect(screen.getByText('Actions fréquentes')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Basé sur vos habitudes actuelles')).toBeInTheDocument();
    expect(screen.getByText('Briefing du jour')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Vous lancez souvent votre journée par un briefing')).toBeInTheDocument();

    expect(screen.getByText('Pipeline commercial')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument();
    expect(screen.getByText('Le suivi commercial est fréquent à cette heure')).toBeInTheDocument();

    expect(screen.getByText('Autres suggestions')).toBeInTheDocument();
    expect(screen.getByText('Voir mes tâches')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getByText('Vos tâches demandent une vérification régulière')).toBeInTheDocument();

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars).toHaveLength(3);
    expect(progressBars[0]).toHaveAttribute('data-value', '92');
    expect(progressBars[1]).toHaveAttribute('data-value', '74');
    expect(progressBars[2]).toHaveAttribute('data-value', '55');
  });

  it('déclenche onExecutePrediction avec la commande exécutable et permet de rafraîchir les prédictions', async () => {
    mockUseJarvisEnhanced.mockReturnValue(SUCCESS_STATE);
    mockGetContextualPredictions.mockReturnValue(CONTEXTUAL_PREDS);

    render(<JarvisPredictionsPanel onExecutePrediction={mockOnExecutePrediction} />, {
      wrapper: createWrapper(),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /briefing du jour/i }));
    });
    expect(mockOnExecutePrediction).toHaveBeenCalledWith('daily briefing');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    });
    expect(mockRefetchPredictions).toHaveBeenCalledTimes(1);
  });

  it('affiche le message vide quand aucune prédiction n’est disponible', () => {
    mockUseJarvisEnhanced.mockReturnValue(EMPTY_STATE);
    mockGetContextualPredictions.mockReturnValue(EMPTY_CONTEXTUAL_PREDS);

    render(<JarvisPredictionsPanel onExecutePrediction={mockOnExecutePrediction} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Pas assez de données pour générer des prédictions')).toBeInTheDocument();
    expect(screen.getByText('Continuez à utiliser Jarvis pour améliorer les suggestions')).toBeInTheDocument();
    expect(screen.queryByText('Autres suggestions')).not.toBeInTheDocument();
  });

  it('couvre explicitement le scénario d’erreur mocké du hook avec renderHook et wrapper QueryClientProvider', () => {
    mockUseJarvisEnhanced.mockReturnValue(ERROR_STATE);

    const { result } = renderHook(() => useJarvisEnhanced(), {
      wrapper: createWrapper(),
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error.message).toBe('x');
    expect(result.current.isError).toBe(true);
  });
});