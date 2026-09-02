import { useParams, useNavigate } from 'react-router-dom';
import { useCustomDashboard } from '@/hooks/dashboard/useCustomDashboards';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Share2, BarChart3, CalendarClock } from 'lucide-react';
import { ReportGrid } from '@/components/rapports-builder/ReportGrid';
import { GlobalFiltersBar } from '@/components/rapports-builder/panels/GlobalFiltersBar';
import { ExportMenu } from '@/components/rapports-builder/ExportMenu';
import { ShareDialog } from '@/components/rapports-builder/ShareDialog';
import { ScheduleDialog } from '@/components/rapports-builder/ScheduleDialog';
import { useState } from 'react';
import { ImmersivePageHeader } from '@/components/layout/ImmersivePageHeader';
import type { DashboardFilters } from '@/types/report';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { Skeleton } from '@/components/ui/skeleton';
import { PageDataState } from '@/components/common/PageDataState';
import { SectionErrorBoundary } from '@/components/common/SectionErrorBoundary';

export default function RapportBuilderView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: dashboard, isLoading, isError, error, refetch } = useCustomDashboard(id);
  usePageTitle(dashboard?.nom || 'Rapport');
  const [filters, setFilters] = useState<DashboardFilters>(dashboard?.filters_schema || {});
  const [shareOpen, setShareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

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

  const effectiveFilters = { ...dashboard.filters_schema, ...filters };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-background via-background to-muted/30">
      <ImmersivePageHeader
        icon={BarChart3}
        title={dashboard.nom}
        subtitle={dashboard.description || undefined}
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/rapports-custom')}>
            <ArrowLeft className="h-4 w-4 mr-1" />Retour
          </Button>
          <ExportMenu dashboard={dashboard} filters={effectiveFilters} />
          <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
            <CalendarClock className="h-3.5 w-3.5 mr-2" />Planifier
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3.5 w-3.5 mr-2" />Partager
          </Button>
          <Button size="sm" onClick={() => navigate(`/rapports-custom/${dashboard.id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />Éditer
          </Button>
        </div>
      </ImmersivePageHeader>

      <div className="container mx-auto px-4 py-4 space-y-4">
        <GlobalFiltersBar filters={effectiveFilters} onChange={setFilters} />

        {dashboard.widgets.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground mb-3">Ce rapport n'a pas encore de widgets</p>
            <Button onClick={() => navigate(`/rapports-custom/${dashboard.id}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" />Commencer à construire
            </Button>
          </div>
        ) : (
          <SectionErrorBoundary label="Impossible d'afficher ce rapport. Un widget contient peut-être une source de données invalide.">
            <ReportGrid widgets={dashboard.widgets} layout={dashboard.layout} filters={effectiveFilters} />
          </SectionErrorBoundary>
        )}
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} dashboard={dashboard} />
      <ScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} dashboard={dashboard} />
    </div>
  );
}
