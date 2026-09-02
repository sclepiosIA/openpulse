import { Component, useMemo, type ReactNode } from 'react';
// v5.1 Lot 3 — `react-grid-layout@2.2.3` n'exporte plus `WidthProvider`.
// L'ancien `WidthProvider(Responsive)` produisait l'erreur minifiée
// « na is not a function » sur /rapports-custom/:id. ResponsiveGridLayout
// est déjà responsive (useContainerWidth en interne).
import { ResponsiveGridLayout as ResponsiveGridLayoutBase } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { KpiBlock } from './widgets/KpiBlock';
import { BarChartBlock } from './widgets/BarChartBlock';
import { LineChartBlock } from './widgets/LineChartBlock';
import { DonutChartBlock } from './widgets/DonutChartBlock';
import { TableBlock } from './widgets/TableBlock';
import { FunnelBlock } from './widgets/FunnelBlock';
import { MarkdownBlock } from './widgets/MarkdownBlock';
import type { WidgetConfig, GridLayoutItem, DashboardFilters } from '@/types/report';
import { cn } from '@/lib/utils';
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResponsiveGridLayout = ResponsiveGridLayoutBase as any;

interface ReportGridProps {
  widgets: WidgetConfig[];
  layout: GridLayoutItem[];
  filters: DashboardFilters;
  editable?: boolean;
  selectedId?: string | null;
  onSelectWidget?: (id: string) => void;
  onLayoutChange?: (layout: GridLayoutItem[]) => void;
}

const toInt = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

// Defensive error boundary: react-grid-layout occasionally throws on
// malformed layouts ("na is not a function"). Fall back to a stacked
// grid so the dashboard stays usable.
class GridErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: unknown) { console.error('[ReportGrid] crash', err); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

export function ReportGrid({ widgets, layout, filters, editable, selectedId, onSelectWidget, onLayoutChange }: ReportGridProps) {
  // Defensive: react-grid-layout crashes ("na is not a function") if layout is null,
  // contains items missing required keys, or has non-numeric x/y/w/h. Coerce every
  // entry to a strict shape and synthesize a fallback item per widget without a layout.
  const safeLayout = useMemo<GridLayoutItem[]>(() => {
    const rawBase = Array.isArray(layout) ? layout.filter(Boolean) : [];
    const validWidgetIds = new Set(widgets.map(w => w.id));
    const base = rawBase
      .filter((l: any) => l && typeof l.i === 'string' && validWidgetIds.has(l.i))
      .map((l: any, idx: number) => ({
        i: String(l.i),
        x: toInt(l.x, (idx * 4) % 12),
        y: toInt(l.y, 0),
        w: Math.max(1, toInt(l.w, 4)),
        h: Math.max(1, toInt(l.h, 4)),
      })) as unknown as GridLayoutItem[];
    const known = new Set(base.map((l: any) => l.i));
    const synth = widgets
      .filter((w) => !known.has(w.id))
      .map((w, idx) => ({ i: w.id, x: (idx * 4) % 12, y: Infinity, w: 4, h: 6 }) as unknown as GridLayoutItem);
    return [...base, ...synth];
  }, [layout, widgets]);
  // v5.3 — fournir TOUS les breakpoints sinon findOrGenerateResponsiveLayout
  // crashe en "na is not a function" quand la résolution tombe sur xs/xxs.
  const layouts = useMemo(() => ({
    lg: safeLayout,
    md: safeLayout,
    sm: safeLayout,
    xs: safeLayout,
    xxs: safeLayout,
  }) as any, [safeLayout]);

  const fallbackGrid = (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {widgets.map((w) => (
        <div key={w.id} className="min-h-[160px]">{renderWidget(w, filters)}</div>
      ))}
    </div>
  );

  return (
    <GridErrorBoundary fallback={fallbackGrid}>
      <ResponsiveGridLayout
        className={cn('layout', editable && 'is-editable')}
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 12, sm: 8, xs: 4, xxs: 2 }}
        rowHeight={40}
        isDraggable={!!editable}
        isResizable={!!editable}
        onLayoutChange={(l: any) => onLayoutChange?.(l as GridLayoutItem[])}
        compactType="vertical"
        margin={[12, 12]}
      >
        {widgets.map((w) => (
          <div
            key={w.id}
            onClick={() => editable && onSelectWidget?.(w.id)}
            className={cn(
              'transition-all',
              editable && 'cursor-move',
              selectedId === w.id && 'ring-2 ring-primary rounded-lg'
            )}
          >
            {renderWidget(w, filters)}
          </div>
        ))}
      </ResponsiveGridLayout>
    </GridErrorBoundary>
  );
}

function renderWidget(w: WidgetConfig, filters: DashboardFilters) {
  // Isolate every widget so one broken data source doesn't take down the
  // whole report grid. Audit browser-use 2026-05-27 (rh) signalait
  // « certains widgets apparaissent en erreur » sur /rapports-custom/:id.
  return (
    <SectionErrorBoundary label={`Widget « ${w.title ?? w.type} » indisponible`}>
      {(() => {
        switch (w.type) {
          case 'kpi': return <KpiBlock widget={w} filters={filters} />;
          case 'bar_chart': return <BarChartBlock widget={w} filters={filters} />;
          case 'line_chart': return <LineChartBlock widget={w} filters={filters} />;
          case 'donut_chart': return <DonutChartBlock widget={w} filters={filters} />;
          case 'table': return <TableBlock widget={w} filters={filters} />;
          case 'funnel': return <FunnelBlock widget={w} filters={filters} />;
          case 'markdown': return <MarkdownBlock widget={w} />;
          default: return <div className="p-4 text-xs text-muted-foreground">Widget inconnu</div>;
        }
      })()}
    </SectionErrorBoundary>
  );
}
