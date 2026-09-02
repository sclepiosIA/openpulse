/**
 * JarvisAgentAnalytics - Dashboard de performance des agents
 * 
 * JARVIS 6.0: Affiche les métriques et KPIs de chaque agent
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity,
  Clock,
  CheckCircle,
  Star,
  Users,
  Zap,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { invokeEdge } from "@/services/edgeFunctions";
import { useAuth } from '@/hooks/shared/useAuth';
import { cn } from '@/lib/utils';
import { JARVIS_AGENTS } from '@/lib/jarvis-agents-config';
import type { AgentId } from '@/types/jarvis-agents';

interface AgentMetrics {
  agentId: string;
  totalInteractions: number;
  avgResponseTimeMs: number;
  successRate: number;
  satisfactionScore: number | null;
  topTools: { name: string; count: number }[];
  recentActivity: { date: string; count: number }[];
  domainKPIs: Record<string, number | string>;
}

interface TeamTotals {
  totalInteractions: number;
  avgResponseTimeMs: number;
  avgSuccessRate: number;
  avgSatisfaction: number | null;
}

const AGENT_COLORS: Record<string, string> = {
  sophia: 'bg-pink-500',
  marcus: 'bg-blue-500',
  olivia: 'bg-emerald-500',
  noah: 'bg-purple-500',
  emma: 'bg-amber-500',
  alex: 'bg-cyan-500',
};

export function JarvisAgentAnalytics() {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<AgentId | 'all'>('all');
  const [period, setPeriod] = useState(30);

  const { data, isLoading, error } = useQuery({
    queryKey: ['jarvis-agent-metrics', user?.id, period],
    queryFn: async () => {
      const data = await invokeEdge<any>('jarvis-agent-metrics', { userId: user?.id, days: period });
      return data as { metrics: AgentMetrics[]; teamTotals: TeamTotals };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={`jarvis-agent-analytics-skeleton-${i}`} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-4">
        <CardContent className="pt-6 text-center text-muted-foreground">
          Erreur lors du chargement des métriques
        </CardContent>
      </Card>
    );
  }

  const { metrics = [], teamTotals } = data || {};

  return (
    <div className="space-y-6 p-4">
      {/* Team Overview */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Performance de l'équipe JARVIS</CardTitle>
                <CardDescription>Derniers {period} jours</CardDescription>
              </div>
            </div>
            <Tabs value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
              <TabsList className="h-8">
                <TabsTrigger value="7" className="text-xs px-2">7j</TabsTrigger>
                <TabsTrigger value="30" className="text-xs px-2">30j</TabsTrigger>
                <TabsTrigger value="90" className="text-xs px-2">90j</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Activity}
              label="Interactions"
              value={teamTotals?.totalInteractions || 0}
              color="text-primary"
            />
            <MetricCard
              icon={Clock}
              label="Temps moyen"
              value={`${teamTotals?.avgResponseTimeMs || 0}ms`}
              color="text-amber-500"
            />
            <MetricCard
              icon={CheckCircle}
              label="Taux succès"
              value={`${Math.round((teamTotals?.avgSuccessRate || 0) * 100)}%`}
              color="text-emerald-500"
            />
            <MetricCard
              icon={Star}
              label="Satisfaction"
              value={teamTotals?.avgSatisfaction ? `${teamTotals.avgSatisfaction}/5` : 'N/A'}
              color="text-yellow-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((agent, index) => (
          <AgentMetricCard key={agent.agentId} metrics={agent} index={index} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: any; 
  label: string; 
  value: string | number; 
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
      <Icon className={cn('h-5 w-5', color)} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}

function AgentMetricCard({ metrics, index }: { metrics: AgentMetrics; index: number }) {
  const agent = JARVIS_AGENTS[metrics.agentId as AgentId];
  if (!agent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="h-full hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={cn('text-white', AGENT_COLORS[agent.id])}>
                {agent.emoji}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base">{agent.name}</CardTitle>
              <CardDescription className="text-xs truncate">
                {agent.shortDescription}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {metrics.totalInteractions} int.
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Performance metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Temps réponse
              </div>
              <p className="text-sm font-medium">{metrics.avgResponseTimeMs}ms</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3" />
                Succès
              </div>
              <p className="text-sm font-medium">{Math.round(metrics.successRate * 100)}%</p>
            </div>
          </div>

          {/* Success rate progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Taux de succès</span>
              <span className="font-medium">{Math.round(metrics.successRate * 100)}%</span>
            </div>
            <Progress 
              value={metrics.successRate * 100} 
              className="h-1.5"
            />
          </div>

          {/* Domain KPIs */}
          {Object.keys(metrics.domainKPIs).length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                KPIs Métier
              </p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(metrics.domainKPIs).slice(0, 4).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="text-muted-foreground capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>{' '}
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top tools */}
          {metrics.topTools.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Outils favoris
              </p>
              <div className="flex flex-wrap gap-1">
                {metrics.topTools.slice(0, 3).map(tool => (
                  <Badge key={tool.name} variant="secondary" className="text-[10px] py-0">
                    {tool.name.replace(/_/g, ' ')} ({tool.count})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
