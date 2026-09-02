import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChurnFactorsBreakdown } from './ChurnFactorsBreakdown';

const { cardMocks, skeletonMocks, progressMocks, lucideMocks } = vi.hoisted(() => {
  const Card = ({ children }: { children?: React.ReactNode }) => <div data-testid="card">{children}</div>;
  const CardHeader = ({ children }: { children?: React.ReactNode }) => <div data-testid="card-header">{children}</div>;
  const CardTitle = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" data-class={className}>
      {children}
    </div>
  );
  const CardContent = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" data-class={className}>
      {children}
    </div>
  );

  const Skeleton = ({ className }: { className?: string }) => (
    <div data-testid="skeleton" data-class={className} />
  );

  const Progress = ({ value, className }: { value?: number; className?: string }) => (
    <div data-testid="progress" data-value={value} data-class={className} />
  );

  const BarChart3 = ({ className }: { className?: string }) => (
    <svg data-testid="bar-chart-3" data-class={className} />
  );

  return {
    cardMocks: {
      Card,
      CardHeader,
      CardTitle,
      CardContent,
    },
    skeletonMocks: {
      Skeleton,
    },
    progressMocks: {
      Progress,
    },
    lucideMocks: {
      BarChart3,
    },
  };
});

vi.mock('@/components/ui/card', () => cardMocks);
vi.mock('@/components/ui/skeleton', () => skeletonMocks);
vi.mock('@/components/ui/progress', () => progressMocks);
vi.mock('lucide-react', () => lucideMocks);

// Mocks obligatoires génériques pour éviter tout import non mocké sensible
const { supabaseHoisted } = vi.hoisted(() => {
  const mockFrom = vi.fn(() => builder);
  const builder: any = {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn(),
    catch: vi.fn(),
  };
  return {
    supabaseHoisted: {
      mockFrom,
      builder,
    },
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseHoisted.mockFrom,
  },
}));

const { authHoisted } = vi.hoisted(() => {
  const user = { id: 'u1', email: 't@t.co' };
  const session = { user };
  return {
    authHoisted: {
      useAuth: () => ({ user, session, isLoading: false }),
      useSession: () => ({ user, session, isLoading: false }),
    },
  };
});

vi.mock('@/hooks/useAuth', () => authHoisted);
vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
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

describe('ChurnFactorsBreakdown', () => {
  it('affiche les skeletons pendant le chargement', () => {
    render(<ChurnFactorsBreakdown loading />);

    const card = screen.getByTestId('card');
    expect(card).toBeInTheDocument();

    const title = screen.getByText('Facteurs déclencheurs');
    expect(title).toBeInTheDocument();

    const icon = screen.getByTestId('bar-chart-3');
    expect(icon).toBeInTheDocument();

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons).toHaveLength(4);
  });

  it('affiche les valeurs et pourcentages corrects quand les données sont fournies', () => {
    const data = {
      many_tickets: 10,
      no_emails: 5,
      many_unpaid: 2,
      no_interaction: 3,
    };
    const total = 20;

    render(<ChurnFactorsBreakdown data={data} total={total} />);

    expect(screen.getByText('🎫 ≥5 tickets ouverts')).toBeInTheDocument();
    expect(screen.getByText('📧 0 email sur 30j')).toBeInTheDocument();
    expect(screen.getByText('💸 ≥2 factures impayées')).toBeInTheDocument();
    expect(screen.getByText('⏰ >60j sans interaction')).toBeInTheDocument();

    expect(screen.getByText('10 (50%)')).toBeInTheDocument();
    expect(screen.getByText('5 (25%)')).toBeInTheDocument();
    expect(screen.getByText('2 (10%)')).toBeInTheDocument();
    expect(screen.getByText('3 (15%)')).toBeInTheDocument();

    const progresses = screen.getAllByTestId('progress');
    expect(progresses).toHaveLength(4);

    expect(progresses[0]).toHaveAttribute('data-value', '50');
    expect(progresses[1]).toHaveAttribute('data-value', '25');
    expect(progresses[2]).toHaveAttribute('data-value', '10');
    expect(progresses[3]).toHaveAttribute('data-value', '15');
  });

  it('utilise 0 comme total par défaut et affiche 0% partout', () => {
    const data = {
      many_tickets: 4,
      no_emails: 1,
      many_unpaid: 0,
      no_interaction: 2,
    };

    render(<ChurnFactorsBreakdown data={data} />);

    expect(screen.getByText('4 (0%)')).toBeInTheDocument();
    expect(screen.getByText('1 (0%)')).toBeInTheDocument();
    expect(screen.getByText('0 (0%)')).toBeInTheDocument();
    expect(screen.getByText('2 (0%)')).toBeInTheDocument();

    const progresses = screen.getAllByTestId('progress');
    expect(progresses).toHaveLength(4);
    progresses.forEach((p) => {
      expect(p).toHaveAttribute('data-value', '0');
    });
  });

  it('tombe à 0 quand data est partiellement ou totalement absent', () => {
    render(<ChurnFactorsBreakdown total={10} />);

    const values = ['0 (0%)', '0 (0%)', '0 (0%)', '0 (0%)'];

    values.forEach((val) => {
      expect(screen.getAllByText(val).length).toBeGreaterThan(0);
    });

    const progresses = screen.getAllByTestId('progress');
    expect(progresses).toHaveLength(4);
    progresses.forEach((p) => {
      expect(p).toHaveAttribute('data-value', '0');
    });
  });
});