import { render, screen, fireEvent } from '@testing-library/react';
import Forecasting from './Forecasting';

const { FORECAST_DATA, mockUseSalesForecast, mockToast, mockRefetch } = vi.hoisted(() => {
  const mockToast = vi.fn();
  const mockRefetch = vi.fn();
  const FORECAST_DATA = {
    kpis: { weighted: 1000, raw: 2000 },
    previous_period: { weighted: 800 },
    range: { start: '2024-01-01', end: '2024-12-31' },
    by_quarter: [
      { quarter: 'T1 2024', raw: 500, weighted: 250, won: 100, target: 600, count: 3 },
    ],
    by_commercial: [
      { user_id: 'u1', display_name: 'Alice Martin', raw: 300, weighted: 150, won: 50, deals_count: 2 },
      { user_id: null, display_name: 'Sans commercial', raw: 100, weighted: 50, won: 0, deals_count: 1 },
    ],
    by_phase: [
      { statut: 'proposal', label: 'Proposition', raw: 400, weighted: 200, probability: 50, count: 2 },
    ],
    by_phase_group: [
      { phase_group: 'Négociation', raw: 200, weighted: 100, count: 1 },
    ],
    top_deals: [
      { nom: 'Deal Top', deal_value: 900, weighted_value: 450, statut: 'proposal', probability: 50, closing_date: '2024-06-30' },
    ],
    hot_deals: [
      { nom: 'Deal Chaud', deal_value: 700, weighted_value: 560, statut: 'negotiation', probability: 80, closing_date: '2024-03-31' },
    ],
    at_risk_deals: [
      { nom: 'Deal Risque', deal_value: 300, weighted_value: 90, statut: 'proposal', probability: 30, closing_date: '2023-12-31' },
    ],
  };
  return { FORECAST_DATA, mockUseSalesForecast: vi.fn(), mockToast, mockRefetch };
});

vi.mock('@/hooks/crm/useSalesForecast', () => ({
  useSalesForecast: mockUseSalesForecast,
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/lib/formatters', () => ({
  safeNum: (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  },
}));

vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      <div>{actions}</div>
    </header>
  ),
}));

vi.mock('@/components/layout/ImmersivePageBackground', () => ({
  ImmersivePageBackground: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: ({
    isLoading,
    isError,
    loadingFallback,
    children,
  }: {
    isLoading: boolean;
    isError: boolean;
    loadingFallback?: React.ReactNode;
    children?: React.ReactNode;
  }) => {
    if (isError) return <div data-testid="page-error">Erreur</div>;
    if (isLoading) return <div data-testid="page-loading">{loadingFallback}</div>;
    return <div data-testid="page-content">{children}</div>;
  },
}));

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/forecasting/ForecastKPIs', () => ({
  ForecastKPIs: () => <div data-testid="forecast-kpis" />,
}));
vi.mock('@/components/forecasting/ForecastByQuarter', () => ({
  ForecastByQuarter: () => <div data-testid="forecast-by-quarter" />,
}));
vi.mock('@/components/forecasting/ForecastByCommercial', () => ({
  ForecastByCommercial: ({ data }: { data: Array<{ display_name: string }> }) => (
    <div data-testid="forecast-by-commercial">{data.map((c) => c.display_name).join('|')}</div>
  ),
}));
vi.mock('@/components/forecasting/ForecastByPhase', () => ({
  ForecastByPhase: () => <div data-testid="forecast-by-phase" />,
}));
vi.mock('@/components/forecasting/ForecastTopDeals', () => ({
  ForecastTopDeals: () => <div data-testid="forecast-top-deals" />,
}));
vi.mock('@/components/forecasting/CommercialFilterPopover', () => ({
  CommercialFilterPopover: () => <div data-testid="commercial-filter" />,
}));
vi.mock('@/components/forecasting/ForecastV2Panel', () => ({
  ForecastV2Panel: () => <div data-testid="forecast-v2-panel" />,
}));

describe('Forecasting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le fallback de chargement quand isLoading est true', () => {
    mockUseSalesForecast.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<Forecasting />);

    expect(screen.getByTestId('page-loading')).toBeTruthy();
    expect(screen.getAllByTestId('skeleton').length).toBe(6);
    expect(screen.queryByTestId('page-content')).toBeNull();
  });

  it('affiche le contenu en cas de succès avec le titre et la recherche', () => {
    mockUseSalesForecast.mockReturnValue({
      data: FORECAST_DATA,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Forecasting />);

    expect(screen.getByText('Prévisions des ventes')).toBeTruthy();
    expect(screen.getByTestId('page-content')).toBeTruthy();
    expect(screen.getByTestId('forecast-kpis')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Rechercher un commercial, un établissement…'),
    ).toBeTruthy();
    expect(screen.getByText('Trimestres')).toBeTruthy();
    expect(screen.getByText('Commerciaux')).toBeTruthy();
    const commercial = screen.getByTestId('forecast-by-commercial');
    expect(commercial.textContent).toContain('Alice Martin');
    expect(commercial.textContent).toContain('Sans commercial');
  });

  it('filtre les commerciaux via la recherche', () => {
    mockUseSalesForecast.mockReturnValue({
      data: FORECAST_DATA,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<Forecasting />);

    const input = screen.getByPlaceholderText('Rechercher un commercial, un établissement…');
    fireEvent.change(input, { target: { value: 'alice' } });

    const commercial = screen.getByTestId('forecast-by-commercial');
    expect(commercial.textContent).toContain('Alice Martin');
    expect(commercial.textContent).not.toContain('Sans commercial');
  });

  it("affiche l'état d'erreur quand le hook renvoie une erreur", () => {
    mockUseSalesForecast.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'x' },
      refetch: mockRefetch,
    });

    render(<Forecasting />);

    expect(screen.getByTestId('page-error')).toBeTruthy();
    expect(screen.queryByTestId('forecast-kpis')).toBeNull();
    expect(screen.queryByTestId('page-content')).toBeNull();
  });

  it("déclenche l'export CSV et affiche un toast", () => {
    mockUseSalesForecast.mockReturnValue({
      data: FORECAST_DATA,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const createObjectURL = vi.fn(() => 'blob:fake-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(Object.create(URL), { createObjectURL, revokeObjectURL }));

    render(<Forecasting />);

    fireEvent.click(screen.getByText('Export CSV'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
    expect(mockToast).toHaveBeenCalledWith({ title: 'Export CSV téléchargé' });

    vi.unstubAllGlobals();
  });
});