import React, { useMemo, Suspense, lazy } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Target, TrendingUp, Calendar, Euro, LayoutDashboard, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useAllEtablissements } from "@/hooks/crm/useProspects";
import { useTaches } from "@/hooks/tasks/useTaches";
import { useCurrentProfile } from "@/hooks/profile/useProfiles";
import { TasksActionPanel } from "@/components/dashboard/TasksActionPanel";
// Lazy load EmailIntelligenceHub to reduce initial bundle size
const EmailIntelligenceHub = lazy(() => import("@/components/dashboard/EmailIntelligenceHub"));
import { UnifiedPageHeader } from "@/components/layout/UnifiedPageHeader";
import { EmailUnreadBadge } from "@/components/email/EmailUnreadBadge";
import { NotificationBadge } from '@/components/layout/NotificationBadge';
import { calculateEtablissementValue } from "@/lib/valueCalculations";
import { useObjectifCASummary } from "@/hooks/billing/useObjectifsCA";
import { useUpcomingAppointments } from "@/hooks/bookings/useUpcomingAppointments";
import { AgendaWidget } from "@/components/dashboard/AgendaWidget";
import { PulseWidget } from "@/components/dashboard/PulseWidget";
import { EmailInboxWidget } from "@/components/dashboard/EmailInboxWidget";
import { NotesWidget } from "@/components/dashboard/NotesWidget";
import { useDashboardLayout, WidgetId, WidgetSize, DASHBOARD_TEMPLATES, DashboardTemplate } from "@/hooks/dashboard/useDashboardLayout";
import { DashboardWidgetGrid } from "@/components/dashboard/DashboardWidgetGrid";
import { DashboardCustomizeButton } from "@/components/dashboard/DashboardCustomizeButton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CommercialDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: allEtablissements, isError: isEtabError, refetch: refetchEtab } = useAllEtablissements();
  const { data: allTaches, isError: isTachesError, refetch: refetchTaches } = useTaches();
  const { data: currentProfile } = useCurrentProfile();
  const { data: objectifsCA, isLoading: objectifsLoading } = useObjectifCASummary();
  const { data: upcomingAppointments, isLoading: rdvLoading } = useUpcomingAppointments(7);

  // Dashboard layout management
  const dashboardLayout = useDashboardLayout('commercial');
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

  // Statistiques pipeline commercial
  const pipelineStats = useMemo(() => {
    if (!allEtablissements) return { 
      prospects: 0, 
      enNegociation: 0, 
      valeursProspects: 0, 
      recentProspects: [],
      hotProspects: []
    };
    
    const pipelineStatuts = ['Prospect', 'Contacté', 'Attente RDV', 'RDV pris', 'Attente post RDV', 
      'Dans les RDV', 'Etude émise', 'Dans les RDV post EME', 'Négociation', 'Contractualisation'];
    
    const prospects = allEtablissements.filter(e => pipelineStatuts.includes(e.statut));
    const enNegociation = allEtablissements.filter(e => ['Négociation', 'Contractualisation'].includes(e.statut));
    const valeursProspects = prospects.reduce((sum, e) => sum + calculateEtablissementValue(e), 0);
    
    const hotProspects = allEtablissements.filter(e => 
      ['Négociation', 'Contractualisation', 'Etude émise'].includes(e.statut)
    ).slice(0, 5);

    return {
      prospects: prospects.length,
      enNegociation: enNegociation.length,
      valeursProspects,
      recentProspects: prospects.slice(0, 5),
      hotProspects
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

  const prochainRDV = upcomingAppointments || [];

  const getStatusColor = (statut: string) => {
    const colors: Record<string, string> = {
      'Négociation': 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      'Contractualisation': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      'Etude émise': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    };
    return colors[statut] || 'bg-gray-100 text-foreground';
  };

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

  return (
    <div className="container mx-auto max-w-[100vw] overflow-x-hidden px-3 sm:px-6 lg:px-8 space-y-6 animate-fade-in">
      <UnifiedPageHeader 
        title="Commercial - Tableau de bord"
        subtitle="Suivi du pipeline et des objectifs commerciaux"
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

      {(isEtabError || isTachesError) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Erreur lors du chargement des données.</span>
            <Button variant="outline" size="sm" onClick={() => { refetchEtab(); refetchTaches(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs Commercial */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/prospects')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pipeline actif</p>
                <p className="text-xl font-bold">{pipelineStats.prospects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">En négociation</p>
                <p className="text-xl font-bold">{pipelineStats.enNegociation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                <Euro className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valeur pipeline</p>
                <p className="text-xl font-bold">{(pipelineStats.valeursProspects / 1000).toFixed(0)}k€</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RDV cette semaine</p>
                <p className="text-xl font-bold">{rdvLoading ? <Skeleton className="h-6 w-8" /> : prochainRDV.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Objectif CA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Objectif CA Annuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {objectifsLoading ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ) : objectifsCA ? (
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Réalisé: <strong>{(objectifsCA.realise / 1000).toFixed(0)}k€</strong></span>
                <span>Objectif: <strong>{(objectifsCA.cible / 1000).toFixed(0)}k€</strong></span>
              </div>
              <Progress value={objectifsCA.progression} className="h-4" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progression: {objectifsCA.progression}%</span>
                <span>Reste: {((objectifsCA.cible - objectifsCA.realise) / 1000).toFixed(0)}k€</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Aucun objectif défini pour cette année
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prospects chauds et RDV */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-500" />
              Prospects chauds
            </CardTitle>
            <CardDescription>Opportunités en phase avancée</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pipelineStats.hotProspects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun prospect en phase avancée
                </p>
              ) : (
                pipelineStats.hotProspects.map((etab) => (
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
                      <Badge className={getStatusColor(etab.statut)}>{etab.statut}</Badge>
                      <span className="text-xs font-medium">{(calculateEtablissementValue(etab) / 1000).toFixed(0)}k€</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/prospects')}>
              Voir tout le pipeline
            </Button>
          </CardContent>
        </Card>

        {/* Prochains RDV */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Prochains rendez-vous
            </CardTitle>
            <CardDescription>Vos RDV à venir</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rdvLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={`commercial-rdv-skeleton-${i}`} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : prochainRDV.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun RDV prévu cette semaine
                </p>
              ) : (
                prochainRDV.map((rdv) => (
                  <div 
                    key={rdv.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate('/calendrier')}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{rdv.title}</p>
                      <p className="text-xs text-muted-foreground">{rdv.formattedDate}</p>
                      {rdv.etablissement_nom && (
                        <p className="text-xs text-primary">{rdv.etablissement_nom}</p>
                      )}
                    </div>
                    <Badge variant="outline">{rdv.type}</Badge>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate('/calendrier')}>
                <Calendar className="h-4 w-4" />
                Calendrier
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Widgets personnalisables */}
      <DashboardWidgetGrid
        team="commercial"
        renderWidget={renderWidget}
        hideToolbar={true}
        externalState={dashboardLayout}
      />
    </div>
  );
}
