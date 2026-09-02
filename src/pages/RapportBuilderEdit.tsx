import { useParams, useNavigate } from 'react-router-dom';
import { useCustomDashboard, useUpdateDashboard } from '@/hooks/dashboard/useCustomDashboards';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Eye, BarChart3 } from 'lucide-react';
import { ReportGrid } from '@/components/rapports-builder/ReportGrid';
import { BlockLibrary } from '@/components/rapports-builder/panels/BlockLibrary';
import { BlockConfigPanel } from '@/components/rapports-builder/panels/BlockConfigPanel';
import { useEffect, useState } from 'react';
import {
  WIDGET_DEFAULT_SIZE, MAX_WIDGETS_PER_DASHBOARD,
  type WidgetConfig, type WidgetType, type GridLayoutItem, type DashboardFilters,
} from '@/types/report';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { PageDataState } from '@/components/common/PageDataState';

function genId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function RapportBuilderEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: dashboard, isLoading, isError, error, refetch } = useCustomDashboard(id);
  const update = useUpdateDashboard();
  usePageTitle(dashboard ? `Édition · ${dashboard.nom}` : 'Édition rapport');

  const [nom, setNom] = useState('');
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [layout, setLayout] = useState<GridLayoutItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters] = useState<DashboardFilters>({});

  useEffect(() => {
    if (dashboard) {
      setNom(dashboard.nom);
      setWidgets(dashboard.widgets);
      setLayout(dashboard.layout);
    }
  }, [dashboard]);

  const handleAddBlock = (type: WidgetType) => {
    if (widgets.length >= MAX_WIDGETS_PER_DASHBOARD) {
      toast.error(`Limite de ${MAX_WIDGETS_PER_DASHBOARD} widgets atteinte`);
      return;
    }
    const newId = genId();
    const size = WIDGET_DEFAULT_SIZE[type];
    const yMax = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    const newWidget: WidgetConfig = { id: newId, type, title: `Nouveau ${type}` };
    const newLayoutItem: GridLayoutItem = { i: newId, x: 0, y: yMax, ...size };
    setWidgets([...widgets, newWidget]);
    setLayout([...layout, newLayoutItem]);
    setSelectedId(newId);
  };

  const handleUpdateWidget = (patch: Partial<WidgetConfig>) => {
    setWidgets(widgets.map(w => w.id === selectedId ? { ...w, ...patch } : w));
  };

  const handleDeleteWidget = () => {
    if (!selectedId) return;
    setWidgets(widgets.filter(w => w.id !== selectedId));
    setLayout(layout.filter(l => l.i !== selectedId));
    setSelectedId(null);
  };

  const handleDuplicateWidget = () => {
    if (!selectedId) return;
    if (widgets.length >= MAX_WIDGETS_PER_DASHBOARD) {
      toast.error(`Limite de ${MAX_WIDGETS_PER_DASHBOARD} widgets atteinte`);
      return;
    }
    const src = widgets.find(w => w.id === selectedId);
    const srcLayout = layout.find(l => l.i === selectedId);
    if (!src || !srcLayout) return;
    const newId = genId();
    const yMax = layout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    setWidgets([...widgets, { ...src, id: newId, title: `${src.title} (copie)` }]);
    setLayout([...layout, { ...srcLayout, i: newId, x: 0, y: yMax }]);
    setSelectedId(newId);
    toast.success('Widget dupliqué');
  };

  const handleSave = async () => {
    if (!dashboard) return;
    await update.mutateAsync({
      id: dashboard.id,
      patch: { nom, widgets, layout },
    });
    toast.success('Rapport sauvegardé');
  };

  if (isLoading || isError || !dashboard) {
    return (
      <PageDataState
        isLoading={isLoading}
        isError={isError || (!isLoading && !dashboard)}
        error={error ?? (!dashboard ? new Error('Rapport introuvable') : undefined)}
        onRetry={() => refetch()}
        loadingFallback={<div className="p-6 space-y-3"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-96 w-full" /></div>}
      >
        <></>
      </PageDataState>
    );
  }

  const selectedWidget = widgets.find(w => w.id === selectedId) || null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="h-14 border-b flex items-center px-4 gap-3 bg-card">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/rapports-custom/${dashboard.id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Retour
        </Button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <BarChart3 className="h-4 w-4 text-primary shrink-0" />
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="h-8 max-w-md text-sm font-medium border-transparent hover:border-input focus:border-input"
          />
          <span className="text-xs text-muted-foreground">{widgets.length}/{MAX_WIDGETS_PER_DASHBOARD} widgets</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/rapports-custom/${dashboard.id}`)}>
          <Eye className="h-3.5 w-3.5 mr-2" />Aperçu
        </Button>
        <Button size="sm" onClick={handleSave} disabled={update.isPending}>
          <Save className="h-3.5 w-3.5 mr-2" />Enregistrer
        </Button>
      </div>

      {/* Layout 3 colonnes */}
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-60 border-r shrink-0 bg-card/50">
          <BlockLibrary onAdd={handleAddBlock} />
        </aside>
        <main className="flex-1 overflow-auto bg-muted/20 p-4">
          {widgets.length === 0 ? (
            <div className="h-full flex items-center justify-center border-2 border-dashed rounded-lg text-sm text-muted-foreground">
              Cliquez sur un bloc à gauche pour commencer
            </div>
          ) : (
            <ReportGrid
              widgets={widgets}
              layout={layout}
              filters={filters}
              editable
              selectedId={selectedId}
              onSelectWidget={setSelectedId}
              onLayoutChange={setLayout}
            />
          )}
        </main>
        <aside className="w-72 border-l shrink-0 bg-card/50">
          <BlockConfigPanel
            widget={selectedWidget}
            onUpdate={handleUpdateWidget}
            onDelete={handleDeleteWidget}
            onDuplicate={handleDuplicateWidget}
          />
        </aside>
      </div>
    </div>
  );
}
