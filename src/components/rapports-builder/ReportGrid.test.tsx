/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReportGrid } from './ReportGrid';

const {
  AUTH_STATE,
  mockFrom,
  mockNavigate,
  toastSuccess,
  toastError,
  kpiSpy,
  barSpy,
  lineSpy,
  donutSpy,
  tableSpy,
  funnelSpy,
  markdownSpy,
  cnSpy,
  sectionBoundarySpy,
  responsivePropsSpy,
  QUERY_SUCCESS,
  QUERY_ERROR,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  QUERY_SUCCESS: { data: null, error: null },
  QUERY_ERROR: { data: null, error: { message: 'x' } },
  mockFrom: vi.fn(() => {
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
      single: vi.fn(async () => QUERY_SUCCESS),
      maybeSingle: vi.fn(async () => QUERY_SUCCESS),
      then: (
        onFulfilled?: ((value: typeof QUERY_SUCCESS) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => Promise.resolve(QUERY_SUCCESS).then(onFulfilled ?? undefined, onRejected ?? undefined),
      catch: (onRejected?: ((reason: unknown) => unknown) | null) =>
        Promise.resolve(QUERY_SUCCESS).catch(onRejected ?? undefined),
    };
    return builder;
  }),
  mockNavigate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  kpiSpy: vi.fn(),
  barSpy: vi.fn(),
  lineSpy: vi.fn(),
  donutSpy: vi.fn(),
  tableSpy: vi.fn(),
  funnelSpy: vi.fn(),
  markdownSpy: vi.fn(),
  cnSpy: vi.fn((...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' ')),
  sectionBoundarySpy: vi.fn(),
  responsivePropsSpy: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
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
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => cnSpy(...args),
}));

vi.mock('@/components/common/SectionErrorBoundary', () => ({
  SectionErrorBoundary: ({ children, label }: { children: React.ReactNode; label: string }) => {
    sectionBoundarySpy(label);
    return <div data-testid={`section-${label}`}>{children}</div>;
  },
}));

vi.mock('./widgets/KpiBlock', () => ({
  KpiBlock: ({ widget, filters }: { widget: { id: string; title?: string }; filters: { range?: string } }) => {
    kpiSpy(widget, filters);
    return <div data-testid={`widget-${widget.id}`}>KPI:{widget.title}:{filters.range}</div>;
  },
}));

vi.mock('./widgets/BarChartBlock', () => ({
  BarChartBlock: ({ widget, filters }: { widget: { id: string; title?: string }; filters: { range?: string } }) => {
    barSpy(widget, filters);
    return <div data-testid={`widget-${widget.id}`}>BAR:{widget.title}:{filters.range}</div>;
  },
}));

vi.mock('./widgets/LineChartBlock', () => ({
  LineChartBlock: ({ widget, filters }: { widget: { id: string; title?: string }; filters: { range?: string } }) => {
    lineSpy(widget, filters);
    return <div data-testid={`widget-${widget.id}`}>LINE:{widget.title}:{filters.range}</div>;
  },
}));

vi.mock('./widgets/DonutChartBlock', () => ({
  DonutChartBlock: ({ widget, filters }: { widget: { id: string; title?: string }; filters: { range?: string } }) => {
    donutSpy(widget, filters);
    return <div data-testid={`widget-${widget.id}`}>DONUT:{widget.title}:{filters.range}</div>;
  },
}));

vi.mock('./widgets/TableBlock', () => ({
  TableBlock: ({ widget, filters }: { widget: { id: string; title?: string }; filters: { range?: string } }) => {
    tableSpy(widget, filters);
    return <div data-testid={`widget-${widget.id}`}>TABLE:{widget.title}:{filters.range}</div>;
  },
}));

vi.mock('./widgets/FunnelBlock', () => ({
  FunnelBlock: ({ widget, filters }: { widget: { id: string; title?: string }; filters: { range?: string } }) => {
    funnelSpy(widget, filters);
    return <div data-testid={`widget-${widget.id}`}>FUNNEL:{widget.title}:{filters.range}</div>;
  },
}));

vi.mock('./widgets/MarkdownBlock', () => ({
  MarkdownBlock: ({ widget }: { widget: { id: string; title?: string } }) => {
    markdownSpy(widget);
    return <div data-testid={`widget-${widget.id}`}>MARKDOWN:{widget.title}</div>;
  },
}));

vi.mock('react-grid-layout', () => ({
  ResponsiveGridLayout: (props: {
    children: React.ReactNode;
    className?: string;
    layouts: Record<string, Array<{ i: string; x: number; y: number; w: number; h: number }>>;
    isDraggable?: boolean;
    isResizable?: boolean;
    onLayoutChange?: (layout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void;
  }) => {
    responsivePropsSpy(props);
    return (
      <div
        data-testid="responsive-grid"
        data-classname={props.className}
        data-draggable={String(!!props.isDraggable)}
        data-resizable={String(!!props.isResizable)}
      >
        <button
          type="button"
          data-testid="trigger-layout-change"
          onClick={() => props.onLayoutChange?.(props.layouts.lg)}
        >
          trigger
        </button>
        {props.children}
      </div>
    );
  },
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

describe('ReportGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides a stable react-query wrapper for hooks: loading then success then error', async () => {
    const Wrapper = createWrapper();

    const useProbe = (mode: 'success' | 'error') => {
      const [state, setState] = React.useState<{
        isLoading: boolean;
        isError: boolean;
        data: typeof QUERY_SUCCESS | null;
        error: { message: string } | null;
      }>({
        isLoading: true,
        isError: false,
        data: null,
        error: null,
      });

      React.useEffect(() => {
        Promise.resolve().then(() => {
          if (mode === 'success') {
            setState({
              isLoading: false,
              isError: false,
              data: QUERY_SUCCESS,
              error: null,
            });
          } else {
            setState({
              isLoading: false,
              isError: true,
              data: null,
              error: QUERY_ERROR.error,
            });
          }
        });
      }, [mode]);

      return state;
    };

    const { result, rerender } = renderHook(({ mode }: { mode: 'success' | 'error' }) => useProbe(mode), {
      initialProps: { mode: 'success' as const },
      wrapper: Wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual(QUERY_SUCCESS);

    rerender({ mode: 'error' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toEqual({ message: 'x' });
  });

  it('renders all widget types, sanitizes layout, applies editable/selected state and forwards callbacks', () => {
    const widgets = [
      { id: 'k1', type: 'kpi', title: 'CA' },
      { id: 'b1', type: 'bar_chart', title: 'Ventes' },
      { id: 'l1', type: 'line_chart', title: 'Tendance' },
      { id: 'd1', type: 'donut_chart', title: 'Répartition' },
      { id: 't1', type: 'table', title: 'Détails' },
      { id: 'f1', type: 'funnel', title: 'Pipeline' },
      { id: 'm1', type: 'markdown', title: 'Notes' },
      { id: 'u1', type: 'unknown', title: 'Mystère' },
    ] as const;

    const layout = [
      { i: 'k1', x: '2', y: '3', w: '5', h: '6' },
      { i: 'b1', x: 'bad', y: 1, w: 0, h: -4 },
      { i: 'ghost', x: 1, y: 1, w: 1, h: 1 },
      null,
    ] as unknown as Array<{ i: string; x: unknown; y: unknown; w: unknown; h: unknown }>;

    const filters = { range: 'last-30-days' };
    const onSelectWidget = vi.fn();
    const onLayoutChange = vi.fn();

    const Wrapper = createWrapper();

    render(
      <ReportGrid
        widgets={widgets as unknown as []}
        layout={layout as unknown as []}
        filters={filters}
        editable
        selectedId="b1"
        onSelectWidget={onSelectWidget}
        onLayoutChange={onLayoutChange}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByTestId('responsive-grid')).toHaveAttribute('data-classname', 'layout is-editable');
    expect(screen.getByTestId('responsive-grid')).toHaveAttribute('data-draggable', 'true');
    expect(screen.getByTestId('responsive-grid')).toHaveAttribute('data-resizable', 'true');

    expect(screen.getByTestId('widget-k1')).toHaveTextContent('KPI:CA:last-30-days');
    expect(screen.getByTestId('widget-b1')).toHaveTextContent('BAR:Ventes:last-30-days');
    expect(screen.getByTestId('widget-l1')).toHaveTextContent('LINE:Tendance:last-30-days');
    expect(screen.getByTestId('widget-d1')).toHaveTextContent('DONUT:Répartition:last-30-days');
    expect(screen.getByTestId('widget-t1')).toHaveTextContent('TABLE:Détails:last-30-days');
    expect(screen.getByTestId('widget-f1')).toHaveTextContent('FUNNEL:Pipeline:last-30-days');
    expect(screen.getByTestId('widget-m1')).toHaveTextContent('MARKDOWN:Notes');
    expect(screen.getByText('Widget inconnu')).toBeInTheDocument();

    expect(kpiSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'k1', title: 'CA' }), filters);
    expect(barSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1', title: 'Ventes' }), filters);
    expect(lineSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1', title: 'Tendance' }), filters);
    expect(donutSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', title: 'Répartition' }), filters);
    expect(tableSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', title: 'Détails' }), filters);
    expect(funnelSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'f1', title: 'Pipeline' }), filters);
    expect(markdownSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', title: 'Notes' }));

    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « CA » indisponible');
    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « Ventes » indisponible');
    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « Tendance » indisponible');
    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « Répartition » indisponible');
    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « Détails » indisponible');
    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « Pipeline » indisponible');
    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « Notes » indisponible');
    expect(sectionBoundarySpy).toHaveBeenCalledWith('Widget « Mystère » indisponible');

    const firstCall = responsivePropsSpy.mock.calls[0]?.[0] as {
      layouts: Record<string, Array<{ i: string; x: number; y: number; w: number; h: number }>>;
    };

    expect(firstCall.layouts.lg).toEqual([
      { i: 'k1', x: 2, y: 3, w: 5, h: 6 },
      { i: 'b1', x: 4, y: 1, w: 1, h: 1 },
      { i: 'l1', x: 0, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'd1', x: 4, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 't1', x: 8, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'f1', x: 0, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'm1', x: 4, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'u1', x: 8, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
    ]);
    expect(firstCall.layouts.md).toEqual(firstCall.layouts.lg);
    expect(firstCall.layouts.sm).toEqual(firstCall.layouts.lg);
    expect(firstCall.layouts.xs).toEqual(firstCall.layouts.lg);
    expect(firstCall.layouts.xxs).toEqual(firstCall.layouts.lg);

    const widgetContainers = screen.getAllByText(/^(KPI|BAR|LINE|DONUT|TABLE|FUNNEL|MARKDOWN):|Widget inconnu$/).map((node) => node.parentElement);
    fireEvent.click(widgetContainers[1] as HTMLElement);
    expect(onSelectWidget).toHaveBeenCalledWith('b1');

    fireEvent.click(screen.getByTestId('trigger-layout-change'));
    expect(onLayoutChange).toHaveBeenCalledWith([
      { i: 'k1', x: 2, y: 3, w: 5, h: 6 },
      { i: 'b1', x: 4, y: 1, w: 1, h: 1 },
      { i: 'l1', x: 0, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'd1', x: 4, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 't1', x: 8, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'f1', x: 0, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'm1', x: 4, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
      { i: 'u1', x: 8, y: Number.POSITIVE_INFINITY, w: 4, h: 6 },
    ]);

    expect(cnSpy).toHaveBeenCalledWith('layout', 'is-editable');
    expect(cnSpy).toHaveBeenCalledWith('transition-all', 'cursor-move', 'ring-2 ring-primary rounded-lg');
  });

  it('does not select widget when not editable and keeps base class only', () => {
    const widgets = [{ id: 'k1', type: 'kpi', title: 'CA' }];
    const filters = { range: 'today' };
    const onSelectWidget = vi.fn();

    const Wrapper = createWrapper();

    render(
      <ReportGrid
        widgets={widgets as unknown as []}
        layout={[]}
        filters={filters}
        editable={false}
        selectedId={null}
        onSelectWidget={onSelectWidget}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByTestId('responsive-grid')).toHaveAttribute('data-classname', 'layout');
    expect(screen.getByTestId('responsive-grid')).toHaveAttribute('data-draggable', 'false');
    expect(screen.getByTestId('responsive-grid')).toHaveAttribute('data-resizable', 'false');

    fireEvent.click(screen.getByTestId('widget-k1').parentElement as HTMLElement);
    expect(onSelectWidget).not.toHaveBeenCalled();
  });

  it('falls back to stacked grid when react-grid-layout render throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const widgets = [
      { id: 'k1', type: 'kpi', title: 'CA' },
      { id: 'm1', type: 'markdown', title: 'Texte' },
    ];
    const filters = { range: 'month' };

    const Wrapper = createWrapper();

    responsivePropsSpy.mockImplementation(() => {
      throw new Error('boom');
    });

    render(
      <ReportGrid
        widgets={widgets as unknown as []}
        layout={[]}
        filters={filters}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByTestId('widget-k1')).toHaveTextContent('KPI:CA:month');
    expect(screen.getByTestId('widget-m1')).toHaveTextContent('MARKDOWN:Texte');
    expect(consoleError).toHaveBeenCalledWith('[ReportGrid] crash', expect.any(Error));

    consoleError.mockRestore();
  });
});