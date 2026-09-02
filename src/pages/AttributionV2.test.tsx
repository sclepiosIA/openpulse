import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttributionV2Page from './AttributionV2';

const { SAMPLE_DATA, mockUseAttributionV2, mockRefetch, mockSupabaseFrom } = vi.hoisted(() => {
  const SAMPLE_DATA = {
    totals: {
      touchpoints: 12345,
      etablissements: 34,
      signed: 5,
      attributed_value: 98765,
    },
    computed_at: '2024-01-02T15:04:00Z',
    channels: [
      {
        channel: 'Email',
        touchpoints: 1000,
        etablissements: 20,
        signed: 2,
        conversion_rate: 20,
        attributed_value: 50000,
        value_per_touch: 50,
      },
      {
        channel: 'Organic',
        touchpoints: 2345,
        etablissements: 14,
        signed: 3,
        conversion_rate: 5,
        attributed_value: 48765,
        value_per_touch: 20,
      },
    ],
  };

  const mockUseAttributionV2 = vi.fn();
  const mockRefetch = vi.fn();

  const mockSupabaseFrom = vi.fn(() => {
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      lte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (onFulfilled: any) => Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: () => undefined,
    };
    return builder;
  });

  return { SAMPLE_DATA, mockUseAttributionV2, mockRefetch, mockSupabaseFrom };
});

vi.mock('@/hooks/crm/useAttributionV2', () => {
  return {
    useAttributionV2: (...args: any[]) => {
      return mockUseAttributionV2(...args);
    },
  };
});

vi.mock('@/hooks/shared/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/components/common/PageDataState', () => {
  return {
    PageDataState: ({ isLoading, isError, error, onRetry, loadingFallback, children }: any) => {
      if (isLoading) {
        return React.createElement('div', {}, loadingFallback);
      }
      if (isError) {
        return React.createElement(
          'div',
          { 'data-testid': 'error' },
          React.createElement('div', {}, error?.message ?? 'error'),
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => {
                if (typeof onRetry === 'function') onRetry();
              },
            },
            'Retry'
          )
        );
      }
      return React.createElement('div', {}, children);
    },
  };
});

vi.mock('@/components/ui/card', () => {
  const Card = ({ children, className }: any) => React.createElement('div', { 'data-testid': 'card', className }, children);
  const CardContent = ({ children, className }: any) => React.createElement('div', { 'data-testid': 'card-content', className }, children);
  const CardHeader = ({ children, className }: any) => React.createElement('div', { 'data-testid': 'card-header', className }, children);
  const CardTitle = ({ children, className }: any) => React.createElement('div', { 'data-testid': 'card-title', className }, children);
  const CardDescription = ({ children, className }: any) => React.createElement('div', { 'data-testid': 'card-desc', className }, children);
  return { Card, CardContent, CardHeader, CardTitle, CardDescription };
});

vi.mock('@/components/ui/tabs', () => {
  const Tabs = ({ children }: any) => React.createElement('div', { 'data-testid': 'tabs' }, children);
  const TabsList = ({ children }: any) => React.createElement('div', { 'data-testid': 'tabs-list' }, children);
  const TabsTrigger = ({ children, value, onClick }: any) =>
    React.createElement('button', { type: 'button', 'data-testid': `tabs-trigger-${value}`, onClick }, children);
  return { Tabs, TabsList, TabsTrigger };
});

vi.mock('@/components/ui/badge', () => {
  return {
    Badge: ({ children, className }: any) => React.createElement('span', { 'data-testid': 'badge', className }, children),
  };
});

vi.mock('@/components/ui/skeleton', () => {
  return {
    Skeleton: ({ className }: any) => React.createElement('div', { 'data-testid': 'skeleton', className }, null),
  };
});

vi.mock('lucide-react', () => {
  const Icon = ({ 'data-icon': name, className }: any) => React.createElement('svg', { 'data-testid': `icon-${name || 'icon'}`, className });
  return {
    Target: (props: any) => Icon({ 'data-icon': 'Target', ...props }),
    TrendingUp: (props: any) => Icon({ 'data-icon': 'TrendingUp', ...props }),
    Users: (props: any) => Icon({ 'data-icon': 'Users', ...props }),
    CheckCircle2: (props: any) => Icon({ 'data-icon': 'CheckCircle2', ...props }),
  };
});

vi.mock('recharts', () => {
  const Container = ({ children }: any) => React.createElement('div', { 'data-testid': 'responsive-container' }, children);
  const Chart = ({ children }: any) => React.createElement('div', { 'data-testid': 'bar-chart' }, children);
  const Simple = ({ children }: any) => React.createElement('div', {}, children);
  const Tooltip = (props: any) => React.createElement('div', { 'data-testid': 'tooltip' }, null);
  const Legend = (props: any) => React.createElement('div', { 'data-testid': 'legend' }, null);
  return {
    ResponsiveContainer: Container,
    BarChart: Chart,
    Bar: Simple,
    XAxis: Simple,
    YAxis: Simple,
    Tooltip,
    CartesianGrid: Simple,
    Legend,
  };
});

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: mockSupabaseFrom,
    },
  };
});

vi.mock('react-router-dom', () => {
  return {
    useNavigate: () => vi.fn(),
    MemoryRouter: ({ children }: any) => React.createElement('div', {}, children),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function normalizeSpaces(s: string) {
  return s.replace(/\u00A0|\u202F/g, ' ').replace(/\s+/g, ' ').trim();
}

function getByTextNormalized(expected: string) {
  const expectedNorm = normalizeSpaces(expected);
  return screen.getByText((content) => normalizeSpaces(content) === expectedNorm);
}

describe('AttributionV2Page', () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state with skeletons and heading', () => {
    mockUseAttributionV2.mockReturnValue({ data: null, isLoading: true, error: null, refetch: mockRefetch });

    render(
      React.createElement(QueryClientProvider, { client: qc }, React.createElement(AttributionV2Page))
    );

    expect(screen.getByText('Attribution multi-touch v2')).toBeInTheDocument();
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders data KPI, chart title and table rows when data is available', () => {
    mockUseAttributionV2.mockReturnValue({ data: SAMPLE_DATA, isLoading: false, error: null, refetch: mockRefetch });

    render(
      React.createElement(QueryClientProvider, { client: qc }, React.createElement(AttributionV2Page))
    );

    // KPI: Touchpoints formatted in fr-FR (may contain NBSP), compare normalized
    const expectedTouchpoints = SAMPLE_DATA.totals.touchpoints.toLocaleString('fr-FR');
    const nodeTouch = getByTextNormalized(expectedTouchpoints);
    expect(nodeTouch).toBeInTheDocument();

    // KPI: Valeur attribuée formatted in EUR without decimals
    const expectedEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
      SAMPLE_DATA.totals.attributed_value
    );
    const nodeEur = getByTextNormalized(expectedEur);
    expect(nodeEur).toBeInTheDocument();

    // Chart title exists
    expect(screen.getByText('Valeur attribuée par canal')).toBeInTheDocument();

    // Table contains channel rows and per-channel formatted values
    expect(screen.getByText('Email')).toBeInTheDocument();

    const firstChannelEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
      SAMPLE_DATA.channels[0].attributed_value
    );
    const nodeChannelEur = getByTextNormalized(firstChannelEur);
    expect(nodeChannelEur).toBeInTheDocument();

    // Conversion percentage styling/class check for first channel (20% => text-success)
    const conversionNode = screen.getByText((content) => normalizeSpaces(content) === '20%');
    expect(conversionNode).toBeInTheDocument();
    expect(String(conversionNode.className)).toContain('text-success');
  });

  it('renders error state and calls refetch when retry clicked', async () => {
    mockUseAttributionV2.mockReturnValue({ data: null, isLoading: false, error: { message: 'boom' }, refetch: mockRefetch });

    render(
      React.createElement(QueryClientProvider, { client: qc }, React.createElement(AttributionV2Page))
    );

    const errorNode = screen.getByTestId('error');
    expect(errorNode).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('Retry'));
    });

    expect(mockRefetch).toHaveBeenCalled();
  });
});