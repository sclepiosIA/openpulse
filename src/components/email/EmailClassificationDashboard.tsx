import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CompactStats } from "@/components/ui/CompactStats";
import { useEmailClassificationStats } from "@/hooks/email/useEmailClassificationStats";
import { useManualEmailClassification } from "@/hooks/email/useManualEmailClassification";
import { DomainClassificationPanel } from "./DomainClassificationPanel";
import { GenericDomainEmailsList } from "./GenericDomainEmailsList";
import { EmailMaintenanceActions } from "./EmailMaintenanceActions";
import { EmailClassificationChart } from "./EmailClassificationChart";
import { EmailClassificationProgress } from "./EmailClassificationProgress";
import { CompleteTeamMappingsButton } from "./CompleteTeamMappingsButton";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Mail,
  Shield,
  Play,
  Building2,
  AtSign,
  Loader2,
  Lightbulb,
  Settings,
  Zap,
  ChevronDown,
} from "lucide-react";

export function EmailClassificationDashboard() {
  const { data: stats, isLoading } = useEmailClassificationStats();
  const classifyMutation = useManualEmailClassification();
  const navigate = useNavigate();

  // État pour le suivi de la progression
  const [progress, setProgress] = useState({
    total: 0,
    processed: 0,
    matched: 0,
    suggested: 0,
    hors: 0,
    interne: 0,
    elapsed: 0,
    isRunning: false,
  });

  const handleClassification = (batchSize: number, processAll: boolean) => {
    setProgress(prev => ({ ...prev, isRunning: true, total: stats?.unclassifiedCount || 0, elapsed: 0 }));
    
    classifyMutation.mutate(
      {
        batchSize,
        processAll,
        onProgress: (progressData) => {
          setProgress({
            total: progressData.total,
            processed: progressData.current,
            matched: progressData.matched,
            suggested: progressData.suggested,
            hors: 0,
            interne: 0,
            elapsed: progressData.elapsed || 0,
            isRunning: true,
          });
        },
      },
      {
        onSuccess: (data) => {
          setProgress(prev => ({
            total: data.total,
            processed: data.total,
            matched: data.matched,
            suggested: data.suggested,
            hors: data.hors || 0,
            interne: data.interne || 0,
            elapsed: prev.elapsed,
            isRunning: false,
          }));
        },
        onError: () => {
          setProgress(prev => ({ ...prev, isRunning: false }));
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Métriques principales et graphiques */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Classification des emails</CardTitle>
            </div>
            
            {/* Actions groupées */}
            <div className="flex items-center gap-2 flex-wrap">
              <CompleteTeamMappingsButton />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    disabled={classifyMutation.isPending}
                    size="default"
                  >
                    {classifyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Classification...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Classifier
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => handleClassification(100, false)}>
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">Rapide (100 emails)</div>
                      <div className="text-xs text-muted-foreground">Classification par lot</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleClassification(200, false)}>
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">Standard (200 emails)</div>
                      <div className="text-xs text-muted-foreground">Lot standard</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleClassification(100, true)}>
                    <div className="flex flex-col gap-1">
                      <div className="font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Complète (max 10 000)
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {stats?.unclassifiedCount 
                          ? `${stats.unclassifiedCount} non classés`
                          : 'Traiter tous'}
                      </div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progression en temps réel */}
          {progress.isRunning && (
            <EmailClassificationProgress
              total={progress.total}
              processed={progress.processed}
              matched={progress.matched}
              suggested={progress.suggested}
              hors={progress.hors}
              interne={progress.interne}
              isRunning={progress.isRunning}
            />
          )}

          {/* Stats inline compactes */}
          <CompactStats 
            items={[
              {
                label: "Taux auto",
                value: `${stats.autoMatchRate}%`,
                icon: <TrendingUp className="h-4 w-4" />,
                color: stats.autoMatchRate > 70 ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
              },
              {
                label: "En attente",
                value: stats.suggestionsPending,
                icon: <AlertCircle className="h-4 w-4" />,
                color: stats.suggestionsPending > 10 ? "text-amber-600 dark:text-amber-400" : ""
              },
              {
                label: "Confiance moy.",
                value: `${stats.avgConfidence}%`,
                icon: <Shield className="h-4 w-4" />,
                color: "text-green-600 dark:text-green-400"
              },
              {
                label: "Emails traités",
                value: stats.totalThreadsCount,
                icon: <Mail className="h-4 w-4" />,
              },
              {
                label: "Classés auto",
                value: stats.autoMatchedCount,
                icon: <CheckCircle className="h-4 w-4" />,
                color: "text-green-600 dark:text-green-400"
              }
            ]}
          />

          {/* Graphiques de visualisation */}
          <EmailClassificationChart
            autoMatchedCount={stats.autoMatchedCount}
            manuallyClassifiedCount={stats.manuallyClassifiedCount}
            unclassifiedCount={stats.unclassifiedCount}
            totalThreadsCount={stats.totalThreadsCount}
            autoMatchRate={stats.autoMatchRate}
            totalClassificationRate={stats.totalClassificationRate}
            totalClassifiedCount={stats.totalClassifiedCount}
            horsEtablissementCount={stats.horsEtablissementCount}
            etablissementCount={stats.etablissementCount}
            partenaireCount={stats.partenaireCount}
            groupeCount={stats.groupeCount}
            interneCount={stats.interneCount}
          />

          {/* Alerte si taux faible - version améliorée */}
          {stats.autoMatchRate < 30 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Taux de classification automatique faible
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  Configurez les domaines d'organisations pour améliorer la classification automatique.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="shrink-0"
                onClick={() => navigate('/gestion-email-domains')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sections pliables */}
      <Accordion type="multiple" defaultValue={["domains"]} className="space-y-4">

        {/* Domaines d'organisations */}
        <AccordionItem value="domains" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Domaines d'organisations</p>
                <p className="text-sm text-muted-foreground">Classifier les emails par domaine d'entreprise</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <DomainClassificationPanel />
          </AccordionContent>
        </AccordionItem>

        {/* Emails personnels */}
        <AccordionItem value="personal" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <AtSign className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Emails personnels (Gmail, Outlook, etc.)</p>
                <p className="text-sm text-muted-foreground">Affilier les emails de domaines publics</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <GenericDomainEmailsList />
          </AccordionContent>
        </AccordionItem>

        {/* Actions avancées */}
        <AccordionItem value="advanced" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Actions avancées</p>
                <p className="text-sm text-muted-foreground">Maintenance et réparation des emails</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <EmailMaintenanceActions />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
