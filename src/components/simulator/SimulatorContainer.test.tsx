// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SimulatorContainer } from './SimulatorContainer';

const {
  simulatorState,
  setActiveTabMock,
  updateParamMock,
  updateConfigurationMock,
  updateAnalyticsParamMock,
} = vi.hoisted(() => {
  const setActiveTab = vi.fn();
  const updateParam = vi.fn();
  const updateConfiguration = vi.fn();
  const updateAnalyticsParam = vi.fn();

  return {
    setActiveTabMock: setActiveTab,
    updateParamMock: updateParam,
    updateConfigurationMock: updateConfiguration,
    updateAnalyticsParamMock: updateAnalyticsParam,
    simulatorState: {
      activeTab: 'simulation' as 'simulation' | 'devis' | 'analytics',
      setActiveTab,
      params: {
        passages: 1200,
        baseline: 0.12,
        dpiType: 'dpi-a',
        centerType: 'centre-a',
      },
      configuration: {
        optionA: true,
      },
      analyticsParams: {
        period: 'monthly',
      },
      simulationResults: {
        totalGainDiff: 125000,
      },
      quoteResults: {
        paliers: [
          { roiNet: -10 },
          { roiNet: 0 },
          { roiNet: 10 },
          { roiNet: 2500 },
        ],
      },
      analyticsResults: {
        series: [1, 2, 3],
      },
      updateParam,
      updateConfiguration,
      updateAnalyticsParam,
    },
  };
});

vi.mock('@/hooks/quote/useSimulatorState', () => ({
  useSimulatorState: vi.fn(() => simulatorState),
}));

vi.mock('@/components/ui/tabs', () => {
  type TabsProps = {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  };
  type TabsContentProps = {
    value: string;
    className?: string;
    children: React.ReactNode;
  };
  type TriggerProps = {
    value: string;
    className?: string;
    children: React.ReactNode;
  };

  const Tabs = ({ children }: TabsProps) => <div data-testid="tabs-root">{children}</div>;
  const TabsList = ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="tabs-list">{children}</div>
  );
  const TabsTrigger = ({ value, children }: TriggerProps) => (
    <button type="button" data-testid={`tab-trigger-${value}`} onClick={() => simulatorState.setActiveTab(value)}>
      {children}
    </button>
  );
  const TabsContent = ({ value, children }: TabsContentProps) =>
    simulatorState.activeTab === value ? <div data-testid={`tab-content-${value}`}>{children}</div> : null;

  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string; variant?: string }) => (
    <span data-testid={`badge-${className?.includes('bg-green-500') ? 'gain' : className?.includes('bg-green-100') ? 'roi' : 'generic'}`}>
      {children}
    </span>
  ),
}));

vi.mock('lucide-react', () => ({
  Calculator: () => <svg data-testid="icon-calculator" />,
  FileText: () => <svg data-testid="icon-filetext" />,
  BarChart3: () => <svg data-testid="icon-barchart3" />,
  TrendingUp: () => <svg data-testid="icon-trendingup" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
}));

vi.mock('./SimulatorMainParams', () => ({
  SimulatorMainParams: ({ params }: { params: { passages: number } }) => (
    <div data-testid="simulator-main-params">passages:{params.passages}</div>
  ),
}));

vi.mock('./SimulatorAdvancedParams', () => ({
  SimulatorAdvancedParams: ({ params }: { params: { dpiType: string } }) => (
    <div data-testid="simulator-advanced-params">dpi:{params.dpiType}</div>
  ),
}));

vi.mock('./SimulationResultsPanel', () => ({
  SimulationResultsPanel: ({ results }: { results: { totalGainDiff: number } | null }) => (
    <div data-testid="simulation-results-panel">gain:{results ? results.totalGainDiff : 'none'}</div>
  ),
}));

vi.mock('./QuoteConfigPanel', () => ({
  QuoteConfigPanel: ({ configuration }: { configuration: { optionA: boolean } }) => (
    <div data-testid="quote-config-panel">config:{String(configuration.optionA)}</div>
  ),
}));

vi.mock('./QuoteProjectionsTable', () => ({
  QuoteProjectionsTable: ({
    results,
    etablissementNom,
  }: {
    results: { paliers: Array<{ roiNet: number }> };
    params: { passages: number };
    etablissementNom?: string;
  }) => <div data-testid="quote-projections-table">roi:{results.paliers[3]?.roiNet}-etab:{etablissementNom ?? 'none'}</div>,
}));

vi.mock('./QuoteValidationPanel', () => ({
  QuoteValidationPanel: ({
    etablissementId,
    etablissementNom,
  }: {
    results: unknown;
    etablissementId?: string;
    etablissementNom?: string;
  }) => <div data-testid="quote-validation-panel">validate:{etablissementId}-{etablissementNom}</div>,
}));

vi.mock('./AnalyticsDashboard', () => ({
  AnalyticsDashboard: ({ analyticsParams }: { params: unknown; analyticsParams: { period: string }; results: unknown; onUpdateAnalyticsParam: (k: string, v: string) => void }) => (
    <div data-testid="analytics-dashboard">period:{analyticsParams.period}</div>
  ),
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

describe('SimulatorContainer', () => {
  beforeEach(() => {
    simulatorState.activeTab = 'simulation';
    simulatorState.simulationResults = { totalGainDiff: 125000 };
    simulatorState.quoteResults = {
      paliers: [{ roiNet: -10 }, { roiNet: 0 }, { roiNet: 10 }, { roiNet: 2500 }],
    };
    simulatorState.analyticsResults = { series: [1, 2, 3] };
    setActiveTabMock.mockClear();
    updateParamMock.mockClear();
    updateConfigurationMock.mockClear();
    updateAnalyticsParamMock.mockClear();
  });

  it('affiche l’en-tête, le gain formaté et le contenu de l’onglet simulation par défaut', () => {
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <SimulatorContainer
          initialPassages={1200}
          initialBaseline={0.12}
          initialDPIType="dpi-a"
          initialCenterType="centre-a"
        />
      </Wrapper>,
    );

    expect(screen.getByText('Simulateur de Valorisation')).toBeInTheDocument();
    expect(
      screen.getByText("Calculez le potentiel de gains liés à l'optimisation de votre taux UHCD"),
    ).toBeInTheDocument();
    expect(screen.getByTestId('badge-gain')).toHaveTextContent(/\+125\s000 €/);
    expect(screen.getByTestId('tab-content-simulation')).toBeInTheDocument();
    expect(screen.getByTestId('simulator-main-params')).toHaveTextContent('passages:1200');
    expect(screen.getByTestId('simulator-advanced-params')).toHaveTextContent('dpi:dpi-a');
    expect(screen.getByTestId('simulation-results-panel')).toHaveTextContent('gain:125000');
  });

  it('déclenche le changement d’onglet vers devis et affiche le badge ROI+ ainsi que les panneaux devis en mode établissement', () => {
    const Wrapper = createWrapper();

    const { rerender } = render(
      <Wrapper>
        <SimulatorContainer mode="etablissement" etablissementId="etab-1" etablissementNom="Clinique A" />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('tab-trigger-devis'));
    expect(setActiveTabMock).toHaveBeenCalledWith('devis');

    simulatorState.activeTab = 'devis';

    rerender(
      <Wrapper>
        <SimulatorContainer mode="etablissement" etablissementId="etab-1" etablissementNom="Clinique A" />
      </Wrapper>,
    );

    expect(screen.getByTestId('badge-roi')).toHaveTextContent('ROI+');
    expect(screen.getByTestId('tab-content-devis')).toBeInTheDocument();
    expect(screen.getByTestId('quote-config-panel')).toHaveTextContent('config:true');
    expect(screen.getByTestId('quote-projections-table')).toHaveTextContent('roi:2500-etab:Clinique A');
    expect(screen.getByTestId('quote-validation-panel')).toHaveTextContent('validate:etab-1-Clinique A');
  });

  it('affiche l’onglet analytics et masque le gain potentiel quand il n’y a pas de gains', () => {
    const Wrapper = createWrapper();
    simulatorState.activeTab = 'analytics';
    simulatorState.simulationResults = { totalGainDiff: 0 };

    render(
      <Wrapper>
        <SimulatorContainer />
      </Wrapper>,
    );

    expect(screen.getByTestId('tab-content-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('analytics-dashboard')).toHaveTextContent('period:monthly');
    expect(screen.queryByTestId('badge-gain')).not.toBeInTheDocument();
  });
});