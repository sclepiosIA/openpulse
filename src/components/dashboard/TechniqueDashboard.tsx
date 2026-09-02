import React, { useMemo, Suspense, lazy } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FALLBACK_DEPLOIEMENT_STATUTS } from "@/config/referenceDataDefaults";
import { useStatutsEtablissement } from "@/hooks/system/useReferenceData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Truck, FlaskConical, Headphones, AlertTriangle, Clock, CheckCircle2, LayoutDashboard } from "lucide-react";
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
import { differenceInDays } from "date-fns";
import { AgendaWidget } from "@/components/dashboard/AgendaWidget";
import { PulseWidget } from "@/components/dashboard/PulseWidget";
import { EmailInboxWidget } from "@/components/dashboard/EmailInboxWidget";
import { NotesWidget } from "@/components/dashboard/NotesWidget";
import { useDashboardLayout, WidgetId, WidgetSize, DASHBOARD_TEMPLATES, DashboardTemplate } from "@/hooks/dashboard/useDashboardLayout";
import { DashboardWidgetGrid } from "@/components/dashboard/DashboardWidgetGrid";
import { DashboardCustomizeButton } from "@/components/dashboard/DashboardCustomizeButton";

export function TechniqueDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: allEtablissements } = useAllEtablissements();
  const { data: allTaches } = useTaches();
  const { data: currentProfile } = useCurrentProfile();
  const { data: statutsRef } = useStatutsEtablissement();

  // Dashboard layout management
  const dashboardLayout = useDashboardLayout('technique');
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

  // Établissements en déploiement
  const deploiementStats = useMemo(() => {
    if (!allEtablissements) return { total: 0, enCours: [], alertes: [] };
    
    const deploiementStatuts: string[] = statutsRef.length > 0
      ? statutsRef.filter(s => s.metadata?.phase === 'deploiement').map(s => s.label)
      : [...FALLBACK_DEPLOIEMENT_STATUTS];
    const enDeploiement = allEtablissements.filter(e => deploiementStatuts.includes(e.statut));
    
    const alertes = enDeploiement.filter(e => {
      if (!e.created_at) return false;
      const daysSinceStart = differenceInDays(new Date(), new Date(e.created_at));
      return daysSinceStart > 60;
    });

    return {
      total: enDeploiement.length,
      enCours: enDeploiement.slice(0, 5),
      alertes
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

  const supportStats = useMemo(() => ({
    ouverts: 12,
    enCours: 5,
    resolus7j: 23
  }), []);

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
        title="Technique - Tableau de bord"
        subtitle="Suivi des déploiements, R&D et support"
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

      {/* KPIs Technique */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/deploiement')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">En déploiement</p>
                <p className="text-xl font-bold">{deploiementStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/rd')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">R&D Actif</p>
                <p className="text-xl font-bold">Sprint 12</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/support')}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                <Headphones className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tickets ouverts</p>
                <p className="text-xl font-bold">{supportStats.ouverts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={`bg-gradient-to-br ${deploiementStats.alertes.length > 0 ? 'from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800' : 'from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${deploiementStats.alertes.length > 0 ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50'}`}>
                <AlertTriangle className={`h-5 w-5 ${deploiementStats.alertes.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Alertes</p>
                <p className="text-xl font-bold">{deploiementStats.alertes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Déploiements en cours */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Déploiements en cours
            </CardTitle>
            <CardDescription>Établissements en phase de déploiement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deploiementStats.enCours.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucun déploiement en cours
                </p>
              ) : (
                deploiementStats.enCours.map((etab) => (
                  <div 
                    key={etab.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/etablissements/${etab.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{etab.nom}</p>
                      <p className="text-xs text-muted-foreground">{etab.ville}</p>
                    </div>
                    <Badge variant="outline" className="ml-2">{etab.statut}</Badge>
                  </div>
                ))
              )}
            </div>
            {deploiementStats.total > 5 && (
              <Button variant="ghost" className="w-full mt-4" onClick={() => navigate('/deploiement')}>
                Voir tous les déploiements ({deploiementStats.total})
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              Support Technique
            </CardTitle>
            <CardDescription>État des tickets de support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">En attente</span>
                </div>
                <Badge variant="secondary">{supportStats.ouverts}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">En cours de traitement</span>
                </div>
                <Badge variant="secondary">{supportStats.enCours}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Résolus (7 jours)</span>
                </div>
                <Badge variant="secondary">{supportStats.resolus7j}</Badge>
              </div>
              
              <div className="pt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>Taux de résolution</span>
                  <span>{Math.round((supportStats.resolus7j / (supportStats.resolus7j + supportStats.ouverts)) * 100)}%</span>
                </div>
                <Progress value={Math.round((supportStats.resolus7j / (supportStats.resolus7j + supportStats.ouverts)) * 100)} className="h-2" />
              </div>
            </div>
            
            <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/support')}>
              Accéder au support
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Widgets personnalisables */}
      <DashboardWidgetGrid
        team="technique"
        renderWidget={renderWidget}
        hideToolbar={true}
        externalState={dashboardLayout}
      />
    </div>
  );
}
