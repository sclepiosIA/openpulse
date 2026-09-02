/**
 * Onglet "Endpoints" extrait de `AIUsageDashboard.tsx` (session 102).
 * Affiche : santé temps réel des 3 endpoints Azure (statut/latence/erreur),
 * stats par modèle (appels/coût/erreurs), chaîne de fallback GPT-5.4 → 5.2 → mini,
 * tableau des erreurs les plus fréquentes.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, Activity, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { MODEL_CONFIG } from "@/lib/aiRegistry";
import { formatCost } from "@/hooks/ai/useAIUsageStats";

interface Props {
  isMobile: boolean;
  healthLoading: boolean;
  healthData: any;
  stats: any;
  onTest: () => void;
}

export function AIUsageEndpointsTab({ isMobile, healthLoading, healthData, stats, onTest }: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Santé des endpoints Azure</h3>
        <Button size="sm" onClick={onTest} disabled={healthLoading}>
          {healthLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
          Tester
        </Button>
      </div>

      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-4")}>
        {(['gpt-5.4', 'gpt-5.2', 'gpt-5-mini'] as const).map(model => {
          const ep = healthData?.endpoints.find((e: any) => e.model === model);
          const modelStats = stats?.callsByModel.find((m: any) => m.model.includes(model.replace('.', '')));
          const errInfo = stats?.errorsByModel.get(model) || stats?.errorsByModel.get(model.replace('.', ''));
          const cfg = MODEL_CONFIG[model];
          return (
            <Card key={model}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{cfg?.label || model}</CardTitle>
                  {ep ? (
                    ep.status === 'ok' ? <Wifi className="h-4 w-4 text-green-500" /> :
                    ep.status === 'error' ? <WifiOff className="h-4 w-4 text-destructive" /> :
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-muted" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {ep && (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Statut</span>
                      <Badge variant={ep.status === 'ok' ? 'default' : ep.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {ep.status === 'ok' ? 'En ligne' : ep.status === 'error' ? 'Erreur' : 'Non configuré'}
                      </Badge>
                    </div>
                    {ep.latency_ms != null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latence</span>
                        <span className="font-mono">{ep.latency_ms}ms</span>
                      </div>
                    )}
                    {ep.error && <p className="text-destructive text-[10px] break-all">{ep.error.substring(0, 100)}</p>}
                  </div>
                )}
                <div className="border-t pt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Appels totaux</span>
                    <span className="font-mono">{modelStats?.count || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coût total</span>
                    <span className="font-mono text-emerald-700">{formatCost(modelStats?.cost || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Erreurs</span>
                    <span className="font-mono text-destructive">{errInfo?.count || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Chaîne de fallback</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 flex-wrap text-sm">
            <Badge className={cn(MODEL_CONFIG['gpt-5.4']?.bgColor, MODEL_CONFIG['gpt-5.4']?.color)} variant="outline">GPT-5.4</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge className={cn(MODEL_CONFIG['gpt-5.2']?.bgColor, MODEL_CONFIG['gpt-5.2']?.color)} variant="outline">GPT-5.2</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge className={cn(MODEL_CONFIG['gpt-5-mini']?.bgColor, MODEL_CONFIG['gpt-5-mini']?.color)} variant="outline">GPT-5 Mini</Badge>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Les fonctions utilisent GPT-5.4 par défaut et escaladent vers GPT-5.2 puis GPT-5 Mini en cas d'erreur.
          </p>
        </CardContent>
      </Card>

      {stats?.topErrors && stats.topErrors.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Erreurs les plus fréquentes</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Message d'erreur</TableHead>
                    <TableHead className="text-right">Occurrences</TableHead>
                    <TableHead className="text-right">Dernière</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topErrors.map((err: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-destructive max-w-[400px] truncate">{err.message}</TableCell>
                      <TableCell className="text-right font-mono">{err.count}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(new Date(err.lastSeen), 'dd/MM HH:mm', { locale: fr })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
