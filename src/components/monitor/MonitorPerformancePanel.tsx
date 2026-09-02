import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, AlertCircle, User } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useTopSlowRoutes, useTopUsersWithErrors } from "@/hooks/monitoring/useMonitorPerformance";

function ratingForLcp(p75: number): { label: string; tone: string } {
  if (p75 <= 2500) return { label: "Bon", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (p75 <= 4000) return { label: "À améliorer", tone: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Mauvais", tone: "bg-red-100 text-red-700 border-red-200" };
}

export function MonitorPerformancePanel() {
  const { data: slowRoutes, isLoading: loadingRoutes, error: routesErr } = useTopSlowRoutes(24, "LCP");
  const { data: topUsers, isLoading: loadingUsers, error: usersErr } = useTopUsersWithErrors(7);

  const maxP75 = slowRoutes && slowRoutes.length > 0 ? Math.max(...slowRoutes.map((r) => r.p75 || 0)) : 1;
  const maxErrors = topUsers && topUsers.length > 0 ? Math.max(...topUsers.map((u) => u.error_count || 0)) : 1;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Top 10 routes lentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Top 10 routes lentes (P75 LCP — 24h)
          </CardTitle>
          <CardDescription className="text-xs">
            Largest Contentful Paint au 75e percentile · seuil Web Vitals : ≤ 2,5 s bon · ≤ 4 s à améliorer
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRoutes ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`monitor-routes-skeleton-${i}`} className="h-12 w-full" />)}
            </div>
          ) : routesErr ? (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Erreur de chargement
            </div>
          ) : !slowRoutes || slowRoutes.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Pas encore assez d'échantillons Web Vitals sur 24 h (sampling 10 %).
            </div>
          ) : (
            <div className="space-y-3">
              {slowRoutes.map((r) => {
                const rating = ratingForLcp(r.p75);
                return (
                  <div key={r.route} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-mono truncate max-w-[60%]" title={r.route}>{r.route}</code>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-[10px] ${rating.tone}`}>{rating.label}</Badge>
                        <span className="text-xs font-semibold tabular-nums">{Math.round(r.p75)} ms</span>
                      </div>
                    </div>
                    <Progress value={(r.p75 / maxP75) * 100} className="h-1.5" />
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span>{r.samples} échantillons</span>
                      <span>P95 {Math.round(r.p95)} ms</span>
                      <span>Moy. {Math.round(r.avg_value)} ms</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top 10 utilisateurs en erreur */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Top 10 utilisateurs en erreur (7j)
          </CardTitle>
          <CardDescription className="text-xs">
            Comptes les plus impactés par des erreurs frontend
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`monitor-users-skeleton-${i}`} className="h-12 w-full" />)}
            </div>
          ) : usersErr ? (
            <div className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Erreur de chargement
            </div>
          ) : !topUsers || topUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Aucune erreur utilisateur sur 7 jours.
            </div>
          ) : (
            <div className="space-y-3">
              {topUsers.map((u) => (
                <div key={u.user_id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs truncate max-w-[55%]" title={u.user_email ?? u.user_id}>
                      {u.user_email ?? u.user_id.slice(0, 8) + '…'}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">{u.distinct_types} types</Badge>
                      <span className="text-xs font-semibold tabular-nums">{u.error_count}</span>
                    </div>
                  </div>
                  <Progress value={(u.error_count / maxErrors) * 100} className="h-1.5" />
                  <div className="text-[10px] text-muted-foreground">
                    Dernière erreur {formatDistanceToNow(new Date(u.last_error_at), { addSuffix: true, locale: fr })}
                    {' · '}
                    {format(new Date(u.last_error_at), 'dd/MM HH:mm', { locale: fr })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
