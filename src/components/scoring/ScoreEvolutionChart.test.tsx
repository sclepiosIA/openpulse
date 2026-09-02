import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockUseScoreHistory } = vi.hoisted(() => {
  return {
    mockUseScoreHistory: vi.fn(),
  };
});

vi.mock('@/components/ui/card', () => {
  function Card({ children }: { children: React.ReactNode }) {
    return <div data-testid="card">{children}</div>;
  }
  function CardHeader({ children }: { children: React.ReactNode }) {
    return <div data-testid="card-header">{children}</div>;
  }
  function CardTitle({ children }: { children: React.ReactNode }) {
    return <h2 data-testid="card-title">{children}</h2>;
  }
  function CardContent({ children }: { children: React.ReactNode }) {
    return <div data-testid="card-content">{children}</div>;
  }
  return { Card, CardHeader, CardTitle, CardContent };
});

vi.mock('lucide-react', () => {
  return {
    TrendingUp: (props: Record<string, unknown>) => <svg data-testid="icon-trending-up" {...props} />,
  };
});

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="recharts-responsive">{children}</div>
  );
  const LineChart = ({ data, children }: { data: unknown; children: React.ReactNode }) => (
    <div data-testid="recharts-linechart" data-chart={JSON.stringify(data)}>
      {children}
    </div>
  );
  const CartesianGrid = () => <div data-testid="recharts-cartesiangrid" />;
  const XAxis = () => <div data-testid="recharts-xaxis" />;
  const YAxis = () => <div data-testid="recharts-yaxis" />;
  const Tooltip = () => <div data-testid="recharts-tooltip" />;
  const Legend = () => <div data-testid="recharts-legend" />;
  const Line = ({ dataKey }: { dataKey: string }) => <div data-testid={`recharts-line-${dataKey}`} />;
  return { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend };
});

vi.mock('@/hooks/crm/useBehavioralScore', () => {
  return {
    useScoreHistory: mockUseScoreHistory,
  };
});

import { ScoreEvolutionChart } from './ScoreEvolutionChart';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = createQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('ScoreEvolutionChart', () => {
  it('affiche le chargement quand isLoading=true', () => {
    mockUseScoreHistory.mockReturnValue({ data: null, isLoading: true });

    render(<ScoreEvolutionChart etablissementId="eta1" days={30} />, { wrapper: Wrapper });

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.getByTestId('card-title').textContent).toContain('Évolution du score (30j)');
    expect(screen.queryByText("Pas d'historique disponible (snapshots quotidiens à partir de demain).")).toBeNull();
    expect(screen.queryByTestId('recharts-linechart')).toBeNull();
  });

  it("affiche un graphique avec des valeurs métier formatées quand l'historique est présent", () => {
    const history = [
      { computed_at: '2026-01-02T00:00:00.000Z', score: 80, static_score: 55, behavioral_score: 25 },
      { computed_at: '2026-01-03T00:00:00.000Z', score: 82, static_score: 56, behavioral_score: 26 },
    ];

    mockUseScoreHistory.mockReturnValue({ data: history, isLoading: false });

    render(<ScoreEvolutionChart etablissementId="eta1" days={90} />, { wrapper: Wrapper });

    expect(screen.queryByText('Chargement…')).toBeNull();
    expect(screen.queryByText("Pas d'historique disponible (snapshots quotidiens à partir de demain).")).toBeNull();

    const chart = screen.getByTestId('recharts-linechart');
    const parsed = JSON.parse(chart.getAttribute('data-chart') ?? 'null') as Array<{
      date: string;
      Total: number;
      Statique: number;
      Comportemental: number;
    }>;

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ date: '02/01', Total: 80, Statique: 55, Comportemental: 25 });
    expect(parsed[1]).toEqual({ date: '03/01', Total: 82, Statique: 56, Comportemental: 26 });

    expect(screen.getByTestId('recharts-line-Total')).toBeInTheDocument();
    expect(screen.getByTestId('recharts-line-Statique')).toBeInTheDocument();
    expect(screen.getByTestId('recharts-line-Comportemental')).toBeInTheDocument();
  });

  it("affiche l'état vide quand aucun historique n'est disponible", () => {
    mockUseScoreHistory.mockReturnValue({ data: [], isLoading: false });

    render(<ScoreEvolutionChart etablissementId="eta2" />, { wrapper: Wrapper });

    expect(screen.getByText("Pas d'historique disponible (snapshots quotidiens à partir de demain).")).toBeInTheDocument();
    expect(screen.queryByText('Chargement…')).toBeNull();
    expect(screen.queryByTestId('recharts-linechart')).toBeNull();
    expect(screen.getByTestId('card-title').textContent).toContain('Évolution du score (90j)');
  });
});