import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

import {
  Brain,
  Zap,
  DollarSign,
  CheckCircle2,
  TrendingUp,
  Download,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  Layers,
  Server,
  BookOpen,
  Activity,
  FileText,
  Search
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  useAIUsageStats,
  formatTokens,
  formatCost,
  formatDuration,
  getProcessingTypeLabel
} from "@/hooks/ai/useAIUsageStats";
import { useAIEndpointsHealth } from "@/hooks/ai/useAIEndpointsHealth";
import {
  AI_FUNCTIONS_REGISTRY,
  type AIFunctionConfig,
  type AICategory
} from "@/lib/aiRegistry";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/ui/use-mobile";
import { cn } from "@/lib/utils";
import { PageDataState } from "@/components/shared/PageDataState";
import { AIUsageEndpointsTab } from "./ai-usage/AIUsageEndpointsTab";
import { KpiCard, PeriodCard } from "./ai-usage/AIUsageDashboardCards";
import {
  AIUsageRegistryTab,
  AIUsagePromptsTab,
  AIUsageFunctionDetailDialog
} from "./ai-usage/AIUsageRegistryAndPromptsTabs";

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
];

export default function AIUsageDashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: stats, isLoading, error, refetch } = useAIUsageStats();
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(false);
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useAIEndpointsHealth(healthCheckEnabled);
  const [selectedFunction, setSelectedFunction] = useState<AIFunctionConfig | null>(null);
  const [registryFilter, setRegistryFilter] = useState<AICategory | 'all'>('all');
  const [registrySearch, setRegistrySearch] = useState('');
  const [promptSearch, setPromptSearch] = useState('');
  const [costSearch, setCostSearch] = useState('');
  const [promptCategoryFilter, setPromptCategoryFilter] = useState<AICategory | 'all'>('all');

  const handleExportCSV = () => {
    if (!stats?.recentLogs) return;
    
    const headers = ['Date', 'Type', 'Modèle', 'Tokens Input', 'Tokens Output', 'Tokens Total', 'Coût ($)', 'Durée (ms)', 'Succès'];
    const rows = stats.recentLogs.map(log => [
      format(new Date(log.processed_at), 'dd/MM/yyyy HH:mm'),
      getProcessingTypeLabel(log.processing_type),
      log.model_used,
      log.prompt_tokens || 0,
      log.completion_tokens || 0,
      log.total_tokens || 0,
      log.estimated_cost != null ? log.estimated_cost.toFixed(6) : 'N/A',
      log.processing_duration_ms || 0,
      log.success ? 'Oui' : 'Non'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ai-usage-costs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const handleTestEndpoints = () => {
    setHealthCheckEnabled(true);
    if (healthData) refetchHealth();
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
        <PageDataState
          isLoading
          loadingLabel="Chargement des statistiques IA..."
          onRetry={() => refetch()}
        >
          {null}
        </PageDataState>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Erreur de chargement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Impossible de charger les statistiques IA.</p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dailyChartData = stats?.dailyStats.map(d => ({
    ...d,
    displayDate: format(new Date(d.date), 'dd/MM', { locale: fr }),
    costDisplay: Number(d.cost.toFixed(4)),
  })) || [];

  const pieData = stats?.callsByType.slice(0, 6).map(t => ({
    name: getProcessingTypeLabel(t.type),
    value: t.count,
    tokens: t.tokens,
    cost: t.cost,
  })) || [];

  const costByTypeData = stats?.callsByType.slice(0, 10).map(t => ({
    name: getProcessingTypeLabel(t.type),
    cost: Number(t.cost.toFixed(4)),
    count: t.count,
    avgCost: Number(t.avgCostPerCall.toFixed(6)),
  })) || [];

  // Registry filtering
  const filteredRegistry = AI_FUNCTIONS_REGISTRY.filter(fn => {
    if (registryFilter !== 'all' && fn.category !== registryFilter) return false;
    if (registrySearch) {
      const s = registrySearch.toLowerCase();
      return fn.label.toLowerCase().includes(s) || fn.id.toLowerCase().includes(s) || fn.description.toLowerCase().includes(s);
    }
    return true;
  });

  // Prompts filtering
  const filteredPrompts = AI_FUNCTIONS_REGISTRY.filter(fn => {
    if (promptCategoryFilter !== 'all' && fn.category !== promptCategoryFilter) return false;
    if (promptSearch) {
      const s = promptSearch.toLowerCase();
      return fn.label.toLowerCase().includes(s) || fn.systemPromptPreview.toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/parametres')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className={cn("font-bold flex items-center gap-2", isMobile ? "text-xl" : "text-2xl sm:text-3xl")}>
              <Brain className="w-7 h-7 text-primary" />
              Centre de contrôle IA
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gestion complète des API, endpoints, paramètres et prompts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-5")}>
        <KpiCard title="Coût total" value={formatCost(stats?.estimatedCost || 0)} sub="Toutes les données" icon={DollarSign} color="text-emerald-600" bgColor="bg-emerald-50" />
        <KpiCard title="Appels totaux" value={stats?.totalCalls.toLocaleString() || '0'} sub={`+${stats?.callsToday} aujourd'hui`} icon={Zap} color="text-primary" bgColor="bg-primary/10" />
        <KpiCard title="Tokens utilisés" value={formatTokens(stats?.totalTokens || 0)} sub={`Moy. ${formatCost(stats?.avgCostPerCall || 0)}/appel`} icon={TrendingUp} color="text-fuchsia-600" bgColor="bg-fuchsia-50" />
        <KpiCard title="Taux succès" value={`${stats?.successRate.toFixed(1)}%`} sub={`Moy. ${formatDuration(stats?.avgProcessingTime || 0)}`} icon={CheckCircle2} color="text-green-600" bgColor="bg-green-50" />
        <KpiCard title="Fonctions IA" value={AI_FUNCTIONS_REGISTRY.length.toString()} sub={`${stats?.callsByModel.length || 0} modèles`} icon={Server} color="text-sky-600" bgColor="bg-sky-50" className={isMobile ? "col-span-2" : ""} />
      </div>

      {/* Coûts par période */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PeriodCard title="Aujourd'hui" calls={stats?.callsToday} tokens={stats?.tokensToday} cost={stats?.costToday} />
        <PeriodCard title="Cette semaine" calls={stats?.callsThisWeek} tokens={stats?.tokensThisWeek} cost={stats?.costThisWeek} />
        <PeriodCard title="Ce mois" calls={stats?.callsThisMonth} tokens={stats?.tokensThisMonth} cost={stats?.costThisMonth} />
      </div>

      <Tabs defaultValue="costs">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="costs" className="gap-1"><DollarSign className="h-3.5 w-3.5" />Coûts</TabsTrigger>
          <TabsTrigger value="usage" className="gap-1"><Zap className="h-3.5 w-3.5" />Usage</TabsTrigger>
          <TabsTrigger value="threads" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" />Top conversations</TabsTrigger>
          <TabsTrigger value="models" className="gap-1"><Server className="h-3.5 w-3.5" />Modèles</TabsTrigger>
          <TabsTrigger value="registry" className="gap-1"><BookOpen className="h-3.5 w-3.5" />Registre</TabsTrigger>
          <TabsTrigger value="endpoints" className="gap-1"><Activity className="h-3.5 w-3.5" />Endpoints</TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1"><FileText className="h-3.5 w-3.5" />Prompts</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1"><Layers className="h-3.5 w-3.5" />Appels</TabsTrigger>
        </TabsList>

        {/* ==================== ONGLET COÛTS ==================== */}
        <TabsContent value="costs" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Évolution des coûts (7 jours)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="displayDate" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`$${value.toFixed(4)}`, 'Coût']} />
                      <Area type="monotone" dataKey="costDisplay" stroke="hsl(152, 69%, 40%)" fill="hsl(152, 69%, 40%)" fillOpacity={0.15} name="Coût" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Coût par fonction IA</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costByTypeData} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={100} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number, name: string) => [name === 'cost' ? `$${value.toFixed(4)}` : value, name === 'cost' ? 'Coût total' : 'Appels']} />
                      <Bar dataKey="cost" fill="hsl(152, 69%, 40%)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2 space-y-2">
              <CardTitle className="text-base">Détail des coûts par type</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une fonction IA…"
                  value={costSearch}
                  onChange={(e) => setCostSearch(e.target.value)}
                  className="pl-9 h-9 max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fonction IA</TableHead>
                      <TableHead className="text-right">Appels</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Coût total</TableHead>
                      <TableHead className="text-right">Coût/appel</TableHead>
                      <TableHead className="text-right">Durée moy.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const s = costSearch.trim().toLowerCase();
                      const rows = stats?.callsByType.filter(t =>
                        !s ||
                        t.type.toLowerCase().includes(s) ||
                        getProcessingTypeLabel(t.type).toLowerCase().includes(s)
                      ) ?? [];
                      if (rows.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                              {s ? 'Aucune fonction ne correspond à votre recherche.' : 'Aucune donnée disponible.'}
                            </TableCell>
                          </TableRow>
                        );
                      }
                      return rows.map(t => (
                        <TableRow key={t.type}>
                          <TableCell><Badge variant="outline" className="font-normal">{getProcessingTypeLabel(t.type)}</Badge></TableCell>
                          <TableCell className="text-right font-mono">{t.count}</TableCell>
                          <TableCell className="text-right font-mono">{formatTokens(t.tokens)}</TableCell>
                          <TableCell className="text-right font-mono font-medium text-emerald-700">{formatCost(t.cost)}</TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">{formatCost(t.avgCostPerCall)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{formatDuration(t.avgDuration)}</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ONGLET USAGE ==================== */}
        <TabsContent value="usage" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Appels / jour (7 jours)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="displayDate" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="calls" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} name="Appels" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Répartition par type</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number, _name: string, props: unknown) => {
                        const p = props as { payload?: { name?: string; tokens?: number; cost?: number } };
                        return [`${value} appels — ${formatTokens(p.payload?.tokens || 0)} tokens — ${formatCost(p.payload?.cost || 0)}`, p.payload?.name || ''];
                      }} />
                      <Legend verticalAlign="bottom" formatter={(_value, entry: unknown) => {
                        const e = entry as { payload?: { name?: string } };
                        return <span className="text-xs">{e.payload?.name || ''}</span>;
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ==================== ONGLET TOP THREADS ==================== */}
        <TabsContent value="threads" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Top 10 threads les plus consommateurs
                </CardTitle>
                <Badge variant="secondary">{stats?.topThreadConsumers?.length || 0} threads</Badge>
              </div>
              <CardDescription>Threads email ayant consommé le plus de tokens IA (toutes les données)</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Sujet</TableHead>
                      <TableHead className="text-right">Passages</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Coût estimé</TableHead>
                      <TableHead className="text-right">Dernier traitement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.topThreadConsumers?.map((t, i) => (
                      <TableRow key={t.threadId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i < 3 && <Badge variant="destructive" className="text-[10px] px-1">{i + 1}</Badge>}
                            <span className="text-sm truncate max-w-[300px]" title={t.subject}>{t.subject}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <Badge variant={t.passages > 5 ? 'destructive' : t.passages > 2 ? 'secondary' : 'outline'} className="text-xs">
                            {t.passages}x
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatTokens(t.totalTokens)}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-emerald-700">{formatCost(t.estimatedCost)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground font-mono">
                          {t.lastProcessed ? format(new Date(t.lastProcessed), 'dd/MM HH:mm', { locale: fr }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!stats?.topThreadConsumers || stats.topThreadConsumers.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Aucune donnée de consommation par thread
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="models" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Consommation par modèle</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modèle</TableHead>
                      <TableHead className="text-right">Appels</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Coût total</TableHead>
                      <TableHead className="text-right">% du coût</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.callsByModel.map(m => (
                      <TableRow key={m.model}>
                        <TableCell><Badge variant="outline" className="font-mono text-xs">{m.model}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{m.count}</TableCell>
                        <TableCell className="text-right font-mono">{formatTokens(m.tokens)}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-emerald-700">{formatCost(m.cost)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {stats.estimatedCost > 0 ? `${((m.cost / stats.estimatedCost) * 100).toFixed(1)}%` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <AIUsageRegistryTab
          filteredRegistry={filteredRegistry}
          registryFilter={registryFilter}
          setRegistryFilter={setRegistryFilter}
          registrySearch={registrySearch}
          setRegistrySearch={setRegistrySearch}
          stats={stats}
          setSelectedFunction={setSelectedFunction}
        />

        {/* ==================== ONGLET ENDPOINTS ==================== */}
        <TabsContent value="endpoints" className="mt-4 space-y-4">
          <AIUsageEndpointsTab
            isMobile={isMobile}
            healthLoading={healthLoading}
            healthData={healthData}
            stats={stats}
            onTest={handleTestEndpoints}
          />
        </TabsContent>

        <AIUsagePromptsTab
          filteredPrompts={filteredPrompts}
          promptCategoryFilter={promptCategoryFilter}
          setPromptCategoryFilter={setPromptCategoryFilter}
          promptSearch={promptSearch}
          setPromptSearch={setPromptSearch}
        />

        {/* ==================== ONGLET DERNIERS APPELS ==================== */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Derniers appels IA</CardTitle>
                <Badge variant="secondary">{stats?.recentLogs.length || 0} derniers</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Modèle</TableHead>
                      <TableHead className="text-right">In/Out</TableHead>
                      <TableHead className="text-right">Coût</TableHead>
                      <TableHead className="text-right">Durée</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.recentLogs.slice(0, 30).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {format(new Date(log.processed_at), 'dd/MM HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal text-xs">{getProcessingTypeLabel(log.processing_type)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{log.model_used}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          <span className="text-sky-600">{formatTokens(log.prompt_tokens || 0)}</span>
                          <span className="text-muted-foreground mx-0.5">/</span>
                          <span className="text-fuchsia-600">{formatTokens(log.completion_tokens || 0)}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium text-emerald-700">
                          {log.estimated_cost != null ? formatCost(log.estimated_cost) : formatCost(
                            ((log.prompt_tokens || 0) / 1000) * 0.01 + ((log.completion_tokens || 0) / 1000) * 0.03
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatDuration(log.processing_duration_ms || 0)}</TableCell>
                        <TableCell className="text-center">
                          {log.success ? <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" /> : <AlertTriangle className="w-4 h-4 text-destructive mx-auto" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AIUsageFunctionDetailDialog
        selectedFunction={selectedFunction}
        setSelectedFunction={setSelectedFunction}
        stats={stats}
      />
    </div>
  );
}

