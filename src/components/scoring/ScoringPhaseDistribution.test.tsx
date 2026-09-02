import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScoringPhaseDistribution } from './ScoringPhaseDistribution';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className}>loading</div>,
}));

vi.mock('recharts', () => {
  const Pie = ({ children, data }: { children: React.ReactNode; data: Array<{ statut: string; count: number }> }) => (
    <div data-testid="pie">
      pie
      <div data-testid="pie-data">{JSON.stringify(data)}</div>
      {children}
    </div>
  );
  const Cell = ({ fill, ...rest }: { fill: string; [k: string]: unknown }) => (
    <div data-testid="cell" data-fill={fill} data-key={rest['data-key'] ?? rest['key']} />
  );
  const Tooltip = (props: unknown) => <div data-testid="tooltip">{JSON.stringify(props)}</div>;
  const Legend = (props: unknown) => <div data-testid="legend">{JSON.stringify(props)}</div>;
  const PieChart = ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>;
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  );
  return {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
  };
});

vi.mock('lucide-react', () => ({
  PieChart: ({ className }: { className?: string }) => <svg data-testid="pie-icon" className={className} />,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('ScoringPhaseDistribution', () => {
  it('affiche le skeleton en mode chargement', () => {
    renderWithClient(<ScoringPhaseDistribution loading data={[{ statut: 'En cours', count: 3 }]} />);

    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('h-[280px] w-full');
    expect(screen.getByTestId('card-title')).toHaveTextContent('Répartition par statut');
    expect(screen.getByTestId('pie-icon')).toBeInTheDocument();
  });

  it('affiche le message "Aucun prospect." quand aucune donnée ou uniquement des counts à 0', () => {
    const { rerender } = renderWithClient(<ScoringPhaseDistribution data={[]} loading={false} />);

    expect(screen.getByText('Aucun prospect.')).toBeInTheDocument();

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: 0, gcTime: 0 },
              mutations: { retry: 0 },
            },
          })
        }
      >
        <ScoringPhaseDistribution
          data={[
            { statut: 'Nouveau', count: 0 },
            { statut: 'Contacté', count: 0 },
          ]}
          loading={false}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText('Aucun prospect.')).toBeInTheDocument();
  });

  it('affiche le graphique quand des données valides sont fournies', () => {
    const sampleData = [
      { statut: 'Nouveau', count: 5 },
      { statut: 'Contacté', count: 3 },
      { statut: 'Qualifié', count: 2 },
      { statut: 'Sans intérêt', count: 0 },
    ];

    renderWithClient(<ScoringPhaseDistribution data={sampleData} loading={false} />);

    expect(screen.queryByText('Aucun prospect.')).not.toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();

    const pieDataNode = screen.getByTestId('pie-data');
    const parsed = JSON.parse(pieDataNode.textContent ?? '[]');
    expect(parsed).toEqual([
      { statut: 'Nouveau', count: 5 },
      { statut: 'Contacté', count: 3 },
      { statut: 'Qualifié', count: 2 },
    ]);

    const cells = screen.getAllByTestId('cell');
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveAttribute('data-fill', 'hsl(217 91% 60%)');
    expect(cells[1]).toHaveAttribute('data-fill', 'hsl(142 76% 36%)');
    expect(cells[2]).toHaveAttribute('data-fill', 'hsl(38 92% 50%)');
  });
});