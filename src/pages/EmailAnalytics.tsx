import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Mail, TrendingUp, Clock, CheckCircle, AlertCircle, Brain, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEmailAnalytics } from "@/hooks/email/useEmailAnalytics";
import { PageDataState } from "@/components/common/PageDataState";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface VolumeDataDay {
  date: string;
  received: number;
  sent: number;
}

interface AIProcessingLog {
  processed_at: string;
  total_tokens: number | null;
  processing_duration_ms: number | null;
  success: boolean;
}

export default function EmailAnalytics() {
  const { volumeData, commercialData, aiQualityData, threadsData, isLoading, isError, refetch } = useEmailAnalytics();
  
  const typedVolumeData = (volumeData || []) as VolumeDataDay[];
  const typedAILogs = (aiQualityData?.recentLogs || []) as AIProcessingLog[];

  const suggestionsPieData = commercialData ? [
    { name: 'Acceptées', value: commercialData.suggestions.accepted },
    { name: 'Rejetées', value: commercialData.suggestions.rejected },
    { name: 'En attente', value: commercialData.suggestions.pending },
  ] : [];

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 sm:px-4 lg:px-6 py-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Analytics des Communications</h1>
        <p className="text-muted-foreground mt-2">
          Tableau de bord des métriques emails et performance de l'IA
        </p>
      </div>

      <PageDataState isLoading={isLoading && !volumeData} isError={isError} onRetry={() => refetch()}>
      <Tabs defaultValue="volume" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volume">Volumétrie</TabsTrigger>
          <TabsTrigger value="commercial">Performance Commerciale</TabsTrigger>
          <TabsTrigger value="ai">Qualité IA</TabsTrigger>
        </TabsList>

        <TabsContent value="volume" className="space-y-4 animate-fade-in">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emails reçus (30j)</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {typedVolumeData.reduce((sum: number, day: VolumeDataDay) => sum + day.received, 0) || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emails envoyés (30j)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {typedVolumeData.reduce((sum: number, day: VolumeDataDay) => sum + day.sent, 0) || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Threads actifs</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{threadsData?.length || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Moy. par jour</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {typedVolumeData.length ? Math.round(
                    typedVolumeData.reduce((sum: number, day: VolumeDataDay) => sum + day.received + day.sent, 0) / typedVolumeData.length
                  ) : 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Volumétrie emails (30 derniers jours)</CardTitle>
              <CardDescription>Emails reçus et envoyés par jour</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={typedVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'dd/MM', { locale: fr })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date), 'dd MMMM yyyy', { locale: fr })}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="received" stroke="hsl(var(--primary))" name="Reçus" />
                  <Line type="monotone" dataKey="sent" stroke="hsl(var(--secondary))" name="Envoyés" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-4 animate-fade-in">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Établissements créés</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{commercialData?.totalEtablissements || 0}</div>
                <p className="text-xs text-muted-foreground">Depuis emails (30j)</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taux conversion</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{commercialData?.conversionRate || 0}%</div>
                <p className="text-xs text-muted-foreground">Suggestions acceptées</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suggestions totales</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{commercialData?.suggestions.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {commercialData?.suggestions.pending || 0} en attente
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Confiance moy.</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{commercialData?.avgConfidence || 0}%</div>
                <p className="text-xs text-muted-foreground">IA</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Répartition des suggestions IA</CardTitle>
              <CardDescription>Statut des suggestions (30 derniers jours)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={suggestionsPieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {suggestionsPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 animate-fade-in">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Temps traitement moy.</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiQualityData?.avgProcessingTime || 0}ms</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tokens consommés</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(aiQualityData?.totalTokens || 0).toLocaleString('fr-FR')}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Coût estimé</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${aiQualityData?.estimatedCost || 0}</div>
                <p className="text-xs text-muted-foreground">Azure OpenAI</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taux succès</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiQualityData?.successRate || 100}%</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Logs récents de traitement IA</CardTitle>
              <CardDescription>10 derniers traitements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {typedAILogs.map((log: AIProcessingLog) => (
                  <div key={log.processed_at} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(log.processed_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.total_tokens || 0} tokens - {log.processing_duration_ms || 0}ms
                      </p>
                    </div>
                    <div className={`text-sm ${log.success ? 'text-green-600' : 'text-red-600'}`}>
                      {log.success ? 'Succès' : 'Échec'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </PageDataState>
    </div>
  );
}
