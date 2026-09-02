// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChurnAccountCard } from './ChurnAccountCard';

const { sparklineProps, linkProps } = vi.hoisted(() => ({
  sparklineProps: vi.fn(),
  linkProps: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
    catch: vi.fn(),
  };
  const mockFrom = vi.fn(() => builder);
  return {
    supabase: {
      from: mockFrom,
    },
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid="badge" data-variant={variant ?? 'default'} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    asChild,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    asChild?: boolean;
    variant?: string;
    size?: string;
  }) => {
    if (asChild) {
      return (
        <div data-testid="button-as-child" data-variant={variant} data-size={size}>
          {children}
        </div>
      );
    }
    return (
      <button type="button" onClick={onClick} data-testid="button" data-variant={variant} data-size={size}>
        {children}
      </button>
    );
  },
}));

vi.mock('./ChurnSparkline', () => ({
  ChurnSparkline: (props: { etablissementId: string; days: number; height: number }) => {
    sparklineProps(props);
    return <div data-testid="sparkline">sparkline</div>;
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({
    to,
    className,
    children,
  }: {
    to: string;
    className?: string;
    children: React.ReactNode;
  }) => {
    linkProps({ to, className, childrenText: typeof children === 'string' ? children : undefined });
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  },
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    ShieldAlert: Icon,
    AlertTriangle: Icon,
    TrendingDown: Icon,
    Activity: Icon,
    BellOff: Icon,
    ExternalLink: Icon,
    Wand2: Icon,
  };
});

describe('ChurnAccountCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les informations métier, les badges de facteurs, les liens et la sparkline', () => {
    const onOpenAction = vi.fn();

    render(
      <ChurnAccountCard
        onOpenAction={onOpenAction}
        prediction={{
          etablissement_id: 'eta-1',
          risk_level: 'critical',
          score: 87.4,
          predicted_at: '2024-05-12T14:30:00.000Z',
          acknowledged_until: '2099-05-20T00:00:00.000Z',
          factors: {
            open_tickets: 4,
            unpaid_invoices: 2,
            emails_30d: 0,
            days_since_last_interaction: 45,
          },
          etablissement: {
            nom: 'Clinique du Lac',
            type_offre: 'Premium',
          },
        }}
      />
    );

    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Critique')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('/100')).toBeInTheDocument();

    expect(screen.getByText('4 tickets')).toBeInTheDocument();
    expect(screen.getByText('2 impayées')).toBeInTheDocument();
    expect(screen.getByText('0 email/30j')).toBeInTheDocument();
    expect(screen.getByText('45j sans contact')).toBeInTheDocument();

    expect(screen.getByText(/Suivi jusqu'au/i)).toBeInTheDocument();
    expect(screen.getByText(/Calculé le/i)).toBeInTheDocument();
    expect(screen.getByTestId('sparkline')).toBeInTheDocument();

    expect(sparklineProps).toHaveBeenCalledWith({
      etablissementId: 'eta-1',
      days: 30,
      height: 36,
    });

    expect(linkProps).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/etablissements/eta-1',
      })
    );
    expect(screen.getByRole('link', { name: 'Clinique du Lac' })).toHaveAttribute('href', '/etablissements/eta-1');
    expect(screen.getByRole('link', { name: /Fiche/i })).toHaveAttribute('href', '/etablissements/eta-1');
  });

  it("déclenche l'action d'ouverture du plan d'action avec l'id établissement", () => {
    const onOpenAction = vi.fn();

    render(
      <ChurnAccountCard
        onOpenAction={onOpenAction}
        prediction={{
          etablissement_id: 'eta-42',
          risk_level: 'high',
          score: 64,
          predicted_at: '2024-01-15T09:05:00.000Z',
          acknowledged_until: null,
          factors: {
            open_tickets: 1,
            unpaid_invoices: 0,
            emails_30d: 3,
            days_since_last_interaction: 5,
          },
          etablissement: {
            nom: 'Cabinet Horizon',
            type_offre: 'Standard',
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Plan d'action/i }));

    expect(onOpenAction).toHaveBeenCalledTimes(1);
    expect(onOpenAction).toHaveBeenCalledWith('eta-42');
    expect(screen.getByText('Élevé')).toBeInTheDocument();
    expect(screen.queryByText(/tickets$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/impayée/i)).not.toBeInTheDocument();
    expect(screen.queryByText('0 email/30j')).not.toBeInTheDocument();
    expect(screen.queryByText(/sans contact/i)).not.toBeInTheDocument();
  });

  it("utilise les valeurs par défaut et n'affiche pas le badge de snooze si la date est passée", () => {
    render(
      <ChurnAccountCard
        onOpenAction={vi.fn()}
        prediction={{
          etablissement_id: 'eta-x',
          risk_level: 'low',
          score: 12,
          predicted_at: '2024-03-10T08:00:00.000Z',
          acknowledged_until: '2000-01-01T00:00:00.000Z',
          factors: {},
          etablissement: {
            nom: null,
            type_offre: null,
          },
        }}
      />
    );

    expect(screen.getByText('Établissement')).toBeInTheDocument();
    expect(screen.getByText('Faible')).toBeInTheDocument();
    expect(screen.queryByText(/Suivi jusqu'au/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Premium')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Établissement' })).toHaveAttribute('href', '/etablissements/eta-x');
  });
});