import React, { useEffect, useMemo, Suspense, lazy, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Factory, Heart, Calendar, CheckCircle2, TrendingUp, TrendingDown, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCsmDashboardEtablissements } from "@/hooks/crm/useProspects";
import { useDashboardTaskSummaries } from "@/hooks/tasks/useTaches";
import { useCurrentProfile } from "@/hooks/profile/useProfiles";
import { TasksActionPanel } from "@/components/dashboard/TasksActionPanel";
// Lazy load EmailIntelligenceHub to reduce initial bundle size
const EmailIntelligenceHub = lazy(() => import("@/components/dashboard/EmailIntelligenceHub"));
import { UnifiedPageHeader } from "@/components/layout/UnifiedPageHeader";
import { EmailUnreadBadge } from "@/components/email/EmailUnreadBadge";
import { NotificationBadge } from '@/components/layout/NotificationBadge';
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useNPSStats } from "@/hooks/analytics/useNPSStats";
import { PortfolioHealthCard } from "@/components/dashboard/PortfolioHealthCard";
import { AgendaWidget } from "@/components/dashboard/AgendaWidget";
import { PulseWidget } from "@/components/dashboard/PulseWidget";
import { EmailInboxWidget } from "@/components/dashboard/EmailInboxWidget";
import { NotesWidget } from "@/components/dashboard/NotesWidget";
import { useDashboardLayout, WidgetId, WidgetSize, DASHBOARD_TEMPLATES, DashboardTemplate } from "@/hooks/dashboard/useDashboardLayout";
import { DashboardWidgetGrid } from "@/components/dashboard/DashboardWidgetGrid";
import { DashboardCustomizeButton } from "@/components/dashboard/DashboardCustomizeButton";
import { FullDashboardSkeleton } from "@/components/shared/FullDashboardSkeleton";

export function CSMDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mountSecondaryWidgets, setMountSecondaryWidgets] = useState(false);
  const { data: allEtablissements, isLoading: etabLoading } = useCsmDashboardEtablissements();
  const { data: allTaches } = useDashboardTaskSummaries();
  const { data: currentProfile } = useCurrentProfile();
  const { data: npsStats, isLoading: npsLoading } = useNPSStats();

  // Dashboard layout management
  const dashboardLayout = useDashboardLayout('csm');
  const {
    isEditMode,
    isSaving,
    startEdit,
    cancelEdit,
    saveLayout,
    resetToDefault,
    openWidgetSelector,
    applyTemplate,
  } = dashboardLayout;

  // Build templates list for DashboardCustomizeButton
  const templates = Object.entries(DASHBOARD_TEMPLATES).map(([id, t]: [string, DashboardTemplate]) => ({
    id,
    name: t.name,
    description: t.description
  }));

  // Établissements en production
  const productionStats = useMemo(() => {
    if (!allEtablissements) return { total: 0, actifs: [], alertesSante: [], renouvellements: [] };
    
    const production = allEtablissements.filter(e => e.statut === 'Production');
    
    const alertesSante = production.filter(e => false);

    const renouvellements = production.filter(e => {
      if (!e.date_fin_contrat) return false;
      const daysUntilRenewal = differenceInDays(new Date(e.date_fin_contrat), new Date());
      return daysUntilRenewal > 0 && daysUntilRenewal <= 60;
    });

    return {
      total: production.length,
      actifs: production.slice(0, 5),
      alertesSante,
      renouvellements
    };
  }, [allEtablissements]);

  // Tâches urgentes
  const urgentTasks = useMemo(() => {
    if (!allTaches) return [];
    const today = new Date();
    return allTaches.filter(task => {
      if (task.statut === 'Terminé' || !task.echeance) return false;
      const echeance = new Date(task.echeance);
      const diffDays = Math.ceil((echeance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0;
    }).sort((a, b) => new Date(a.echeance!).getTime() - new Date(b.echeance!).getTime());
  }, [allTaches]);

  // Mes tâches
  const myTasks = useMemo(() => {
    if (!allTaches || !currentProfile) return [];
    return allTaches.filter(t => t.responsable_id === currentProfile.id && t.statut !== 'Terminé');
  }, [allTaches, currentProfile]);

  const myTasksProgress = useMemo(() => {
    if (!allTaches || !currentProfile) return 0;
    const myAllTasks = allTaches.filter(t => t.responsable_id === currentProfile.id);
    const completed = myAllTasks.filter(t => t.statut === 'Terminé').length;
    return myAllTasks.length > 0 ? Math.round((completed / myAllTasks.length) * 100) : 0;
  }, [allTaches, currentProfile]);

  const npsScore = npsStats?.npsScore || 0;
  const npsEvolution = npsStats?.evolution || 0;

  useEffect(() => {
    const timer = window.setTimeout(() => setMountSecondaryWidgets(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  // Render widget based on ID
  const renderWidget = (widgetId: WidgetId, size: WidgetSize): React.ReactNode => {
    switch (widgetId) {
      case 'tasks_panel':
        return (
          <TasksActionPanel
            urgentTasks={urgentTasks}
            myTasks={myTasks}
            allTasks={allTaches || []}
            myTasksProgress={myTasksProgress}
            globalProgress={allTaches && allTaches.length > 0 ? Math.round((allTaches.filter(t => t.statut === 'Terminé').length / allTaches.length) * 100) : 0}
          />
        );
      case 'email_intel':
        return (
          <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Chargement...</div>}>
            <EmailIntelligenceHub />
          </Suspense>
        );
      case 'agenda_widget':
        return <AgendaWidget maxItems={5} />;
      case 'pulse_widget':
        return <PulseWidget maxItems={5} />;
      case 'email_inbox_widget':
        return <EmailInboxWidget maxItems={5} />;
      case 'notes_widget':
        return <NotesWidget />;
      default:
        return null;
    }
  };

  const isInitialDashboardLoading = etabLoading && !allEtablissements;

  // Skeleton initial limité aux KPIs client : les widgets below-fold chargent ensuite
  // indépendamment pour réduire le TTI perçu du dashboard CSM.
  if (isInitialDashboardLoading) {
    return <FullDashboardSkeleton />;
  }

  return (
    <div className="container mx-auto max-w-[100vw] overflow-x-hidden px-3 sm:px-6 lg:px-8 space-y-6 animate-fade-in">
      <UnifiedPageHeader 
        title="CSM - Tableau de bord"
        subtitle="Suivi de la satisfaction et de la santé client"
        icon={LayoutDashboard}
        sticky={false}
        actions={
          <>
            <EmailUnreadBadge />
            <NotificationBadge />
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['dashboard'] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DashboardCustomizeButton
              isEditMode={isEditMode}
              isSaving={isSaving}
              actions={{
                startEdit,
                cancelEdit,
                saveLayout,
                resetToDefault,
                openWidgetSelector,
                applyTemplate
              }}
              templates={templates}
            />
          </>
        }
      />

      {/* KPIs CSM */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/production')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                <Factory className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">En production</p>
                <p className="text-xl font-bold">{productionStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NPS Moyen</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold">{npsLoading ? '...' : npsScore.toFixed(1)}/10</p>
                  {!npsLoading && npsEvolution !== 0 && (
                    <span className={`text-xs flex items-center ${npsEvolution > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {npsEvolution > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(npsEvolution).toFixed(0)}%
                    </span>
                  )}
                </div>
                {npsStats && (
                  <p className="text-xs text-muted-foreground">{npsStats.totalRepondants} répondants</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Renouvellements</p>
                <p className="text-xl font-bold">{productionStats.renouvellements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`bg-gradient-to-br ${productionStats.alertesSante.length > 0 ? 'from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800' : 'from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${productionStats.alertesSante.length > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                <Heart className={`h-5 w-5 ${productionStats.alertesSante.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alertes santé</p>
                <p className="text-xl font-bold">{productionStats.alertesSante.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clients et renouvellements */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5" />
              Clients en production
            </CardTitle>
            <CardDescription>Établissements actifs à suivre</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {productionStats.actifs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun client en production
                </p>
              ) : (
                productionStats.actifs.map((etab) => (
                  <div 
                    key={etab.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/etablissements/${etab.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{etab.nom}</p>
                      <p className="text-xs text-muted-foreground">{etab.ville}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3 text-green-500" />
                        <span className="text-xs">8.5</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {productionStats.total > 5 && (
              <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/production')}>
                Voir tous les clients ({productionStats.total})
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Prochains renouvellements
            </CardTitle>
            <CardDescription>Contrats à renouveler dans les 60 jours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {productionStats.renouvellements.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucun renouvellement à venir
                  </p>
                </div>
              ) : (
                productionStats.renouvellements.map((etab) => (
                  <div 
                    key={etab.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/etablissements/${etab.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{etab.nom}</p>
                      <p className="text-xs text-muted-foreground">
                        Échéance: {etab.date_fin_contrat ? format(new Date(etab.date_fin_contrat), 'dd MMM yyyy', { locale: fr }) : 'N/A'}
                      </p>
                    </div>
                    <Badge variant={differenceInDays(new Date(etab.date_fin_contrat!), new Date()) < 30 ? "destructive" : "secondary"}>
                      J-{differenceInDays(new Date(etab.date_fin_contrat!), new Date())}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Santé globale du portefeuille */}
      <PortfolioHealthCard etablissements={allEtablissements || []} />

      {/* Widgets personnalisables */}
      {mountSecondaryWidgets ? (
        <DashboardWidgetGrid
          team="csm"
          renderWidget={renderWidget}
          hideToolbar={true}
          externalState={dashboardLayout}
        />
      ) : null}
    </div>
  );
}
