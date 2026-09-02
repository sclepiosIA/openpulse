// @vitest-environment jsdom
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ForecastByPhase } from './ForecastByPhase';

const { donutSpy } = vi.hoisted(() => ({
  donutSpy: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}));

vi.mock('./ForecastPhaseDonut', () => ({
  ForecastPhaseDonut: ({ data }: { data: unknown }) => {
    donutSpy(data);
    return <div data-testid="forecast-phase-donut" />;
  },
}));

describe('ForecastByPhase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le message vide quand aucune donnée n’est fournie et ne rend pas le donut sans groupes', () => {
    render(<ForecastByPhase data={[]} />);

    expect(screen.getByText('Funnel par phase pipeline')).toBeInTheDocument();
    expect(screen.getByText('Aucune donnée.')).toBeInTheDocument();
    expect(screen.queryByTestId('forecast-phase-donut')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('progress')).toHaveLength(0);
  });

  it('rend les groupes dans le donut et affiche les valeurs métier formatées avec fallback de label', () => {
    const data = [
      {
        statut: 'qualified_lead',
        label: 'Lead qualifié',
        probability: 25,
        count: 3,
        raw: 1000,
        weighted: 250,
      },
      {
        statut: 'proposal_sent',
        label: '',
        probability: 80,
        count: 2,
        raw: 5000,
        weighted: 4000,
      },
    ];

    const groups = [
      { name: 'Lead qualifié', value: 250, probability: 25, count: 3 },
      { name: 'Proposal sent', value: 4000, probability: 80, count: 2 },
    ];

    const { container } = render(<ForecastByPhase data={data} groups={groups} />);

    expect(screen.getByTestId('forecast-phase-donut')).toBeInTheDocument();
    expect(donutSpy).toHaveBeenCalledTimes(1);
    expect(donutSpy).toHaveBeenCalledWith(groups);

    expect(screen.getByText('Lead qualifié')).toBeInTheDocument();
    expect(screen.getByText('proposal sent')).toBeInTheDocument();

    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent('25%');
    expect(badges[1]).toHaveTextContent('80%');

    expect(container).toHaveTextContent('· 3');
    expect(container).toHaveTextContent('· 2');
    expect(container).toHaveTextContent('brut 1');
    expect(container).toHaveTextContent('000');
    expect(container).toHaveTextContent('brut 5');
    expect(container).toHaveTextContent('250');
    expect(container).toHaveTextContent('4');
    expect(container).toHaveTextContent('€');

    const progressBars = screen.getAllByTestId('progress');
    expect(progressBars).toHaveLength(2);
    expect(progressBars[0]).toHaveAttribute('data-value', '20');
    expect(progressBars[1]).toHaveAttribute('data-value', '100');
  });

  it('utilise 1 comme max minimal pour éviter une division invalide quand raw vaut 0', () => {
    const data = [
      {
        statut: 'new',
        label: 'Nouveau',
        probability: 10,
        count: 1,
        raw: 0,
        weighted: 0,
      },
    ];

    const { container } = render(<ForecastByPhase data={data} groups={[]} />);

    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('10%');
    expect(container).toHaveTextContent('· 1');
    expect(container).toHaveTextContent('brut 0');
    expect(within(container).getAllByText((content) => content.includes('0') && content.includes('€')).length).toBeGreaterThanOrEqual(2);

    const progress = screen.getByTestId('progress');
    expect(progress).toHaveAttribute('data-value', '0');
  });
});