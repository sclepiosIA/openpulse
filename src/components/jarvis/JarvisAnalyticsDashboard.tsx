/**
 * JarvisAnalyticsDashboard - Dashboard des statistiques Jarvis - Premium Immersive
 * 
 * V12.2: Ajout du monitoring Azure GPT-5
 * V15.0: Ajout du monitoring des outils Jarvis
 */

import { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Brain,
  Zap,
  Target,
  BookOpen,
  Server,
  Wrench,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { useJarvisLearning } from '@/hooks/jarvis/useJarvisLearning';
import { JarvisAzureMonitoring } from './JarvisAzureMonitoring';
import { JarvisToolsMonitoringDashboard } from './JarvisToolsMonitoringDashboard';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; isPositive: boolean };
}

function StatCard({ title, value, description, icon, color, trend }: StatCardProps) {
  return (
    <Card className={cn("relative overflow-hidden border-border/50 bg-gradient-to-br", color)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="p-2.5 bg-background/80 rounded-xl ring-1 ring-border/50 shadow-sm">
            {icon}
          </div>
        </div>
        {trend && (
          <div className={cn(
            "absolute bottom-2 right-2 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg",
            trend.isPositive 
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}>
            <TrendingUp className={cn("h-3 w-3", !trend.isPositive && "rotate-180")} />
            {Math.abs(trend.value)}%
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function JarvisAnalyticsDashboard() {
  const { insights, isLoading } = useJarvisLearning();
  const [activeTab, setActiveTab] = useState('learning');

  const stats = useMemo(() => {
    if (!insights || insights.patterns.length === 0) {
      return {
        totalActions: 0,
        approvalRate: 0,
        avgConfidence: 0,
        timeSaved: 0,
        topActionType: 'Aucune',
        peakHour: 'N/A',
      };
    }

    const totalActions = insights.patterns.reduce((sum, p) => sum + p.total_count, 0);
    const weightedApproval = insights.patterns.reduce(
      (sum, p) => sum + p.approval_rate * p.total_count, 
      0
    ) / totalActions;
    const weightedConfidence = insights.patterns.reduce(
      (sum, p) => sum + p.avg_confidence_approved * p.total_count,
      0
    ) / totalActions;

    const topPattern = insights.patterns[0];
    const peakHour = insights.peak_usage_hours[0];

    const approvedActions = Math.round(totalActions * weightedApproval);
    const timeSaved = approvedActions * 2;

    return {
      totalActions,
      approvalRate: Math.round(weightedApproval * 100),
      avgConfidence: Math.round(weightedConfidence * 100),
      timeSaved,
      topActionType: topPattern?.action_type || 'N/A',
      peakHour: peakHour !== undefined ? `${peakHour}h` : 'N/A',
    };
  }, [insights]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={`jarvis-analytics-skeleton-${i}`} className="h-20 bg-muted/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Tabs pour basculer entre Learning, Outils et Azure Monitoring */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="learning" className="gap-2 text-xs">
              <Brain className="h-3.5 w-3.5" />
              Apprentissage
            </TabsTrigger>
            <TabsTrigger value="tools" className="gap-2 text-xs">
              <Wrench className="h-3.5 w-3.5" />
              Outils
            </TabsTrigger>
            <TabsTrigger value="azure" className="gap-2 text-xs">
              <Server className="h-3.5 w-3.5" />
              Azure GPT-5
            </TabsTrigger>
          </TabsList>

          {/* Learning Tab */}
          <TabsContent value="learning" className="space-y-6 mt-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl ring-1 ring-primary/20">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Analytics Jarvis</h3>
                <p className="text-xs text-muted-foreground">
                  Performance et apprentissage
                </p>
              </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Actions traitées"
            value={stats.totalActions}
            description="Total historique"
            icon={<Zap className="h-4 w-4 text-amber-500" />}
            color="from-amber-500/10 to-amber-500/5"
          />
          <StatCard
            title="Taux d'approbation"
            value={`${stats.approvalRate}%`}
            description="Actions validées"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            color="from-emerald-500/10 to-emerald-500/5"
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Confiance moyenne"
            value={`${stats.avgConfidence}%`}
            description="Score IA"
            icon={<Brain className="h-4 w-4 text-purple-500" />}
            color="from-purple-500/10 to-purple-500/5"
          />
          <StatCard
            title="Temps économisé"
            value={`${stats.timeSaved}m`}
            description="Estimation"
            icon={<Clock className="h-4 w-4 text-sky-500" />}
            color="from-sky-500/10 to-sky-500/5"
          />
        </div>

        {/* Seuil optimal */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500/15 to-pink-500/5 ring-1 ring-pink-500/20">
                <Target className="h-4 w-4 text-pink-500" />
              </div>
              Seuil de confiance optimal
            </CardTitle>
            <CardDescription className="text-xs">
              Basé sur votre historique d'approbations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recommandé</span>
                <span className="font-bold text-primary">{Math.round((insights?.optimal_threshold || 0.85) * 100)}%</span>
              </div>
              <Progress 
                value={(insights?.optimal_threshold || 0.85) * 100} 
                className="h-2.5"
              />
              <p className="text-xs text-muted-foreground">
                Les actions au-dessus de ce seuil ont {stats.approvalRate}% de chances d'être approuvées
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Patterns par type d'action */}
        {insights && insights.patterns.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Performance par type
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.patterns.slice(0, 5).map((pattern, index) => (
                <motion.div
                  key={`${pattern.action_type}_${pattern.trigger_type}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-background">
                      {getActionIcon(pattern.action_type)}
                    </Badge>
                    <span className="text-sm font-medium">{getActionLabel(pattern.action_type)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {pattern.total_count} actions
                    </span>
                    <Badge 
                      variant={pattern.approval_rate > 0.7 ? 'default' : 'secondary'}
                      className={cn(
                        "text-xs",
                        pattern.approval_rate > 0.7 && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      )}
                    >
                      {Math.round(pattern.approval_rate * 100)}%
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Sources les plus utiles */}
        {insights && insights.most_useful_sources.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 ring-1 ring-cyan-500/20">
                  <BookOpen className="h-4 w-4 text-cyan-500" />
                </div>
                Sources KB les plus utiles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.most_useful_sources.slice(0, 5).map((source, index) => (
                <motion.div 
                  key={source.article_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <span className="truncate flex-1 mr-2">{source.title}</span>
                  <Badge variant="secondary" className="text-xs bg-muted/50">
                    {source.usage_count}×
                  </Badge>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Suggestions d'amélioration */}
        {insights && insights.suggestions.length > 0 && (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                Suggestions d'optimisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {insights.suggestions.map((suggestion, index) => (
                  <li key={`jarvis-suggestion-${index}-${suggestion.slice(0, 20)}`} className="text-xs text-muted-foreground flex gap-2 items-start">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Heures de pointe */}
        {insights && insights.peak_usage_hours.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Heures d'utilisation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {insights.peak_usage_hours.map(hour => (
                  <Badge 
                    key={hour} 
                    variant="outline"
                    className="bg-muted/30"
                  >
                    {hour}h - {hour + 1}h
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Vos heures les plus actives avec Jarvis
              </p>
            </CardContent>
          </Card>
        )}
          </TabsContent>

          {/* Tools Monitoring Tab */}
          <TabsContent value="tools" className="mt-4 -mx-4">
            <JarvisToolsMonitoringDashboard />
          </TabsContent>

          {/* Azure Monitoring Tab */}
          <TabsContent value="azure" className="mt-4">
            <JarvisAzureMonitoring />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

function getActionIcon(actionType: string): string {
  switch (actionType) {
    case 'send_email': return '📧';
    case 'create_task': return '✅';
    case 'update_status': return '🔄';
    case 'close_ticket': return '🎫';
    case 'schedule_meeting': return '📅';
    case 'draft_response': return '✏️';
    case 'summarize': return '📝';
    case 'analyze': return '🔍';
    case 'remind': return '⏰';
    default: return '🤖';
  }
}

function getActionLabel(actionType: string): string {
  switch (actionType) {
    case 'send_email': return 'Envoi email';
    case 'create_task': return 'Création tâche';
    case 'update_status': return 'Mise à jour';
    case 'close_ticket': return 'Clôture ticket';
    case 'schedule_meeting': return 'Planification';
    case 'draft_response': return 'Brouillon';
    case 'summarize': return 'Résumé';
    case 'analyze': return 'Analyse';
    case 'remind': return 'Rappel';
    default: return actionType;
  }
}
