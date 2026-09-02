import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCsmPlaybooks,
  useCsmPlaybookExecutionsByEtablissement,
  useEvaluatePlaybooksForEtablissement,
  type CsmPlaybook,
} from '@/hooks/csm/useCsmPlaybooks';
import { Play, Activity, CheckCircle2, AlertCircle, Clock, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

interface Props {
  etablissementId: string;
}

export function CsmEtabPlaybooks({ etablissementId }: Props) {
  const { data: playbooks = [] } = useCsmPlaybooks();
  const evaluate = useEvaluatePlaybooksForEtablissement();

  const { data: executions = [], isLoading } = useCsmPlaybookExecutionsByEtablissement(etablissementId);

  const playbookById = new Map<string, CsmPlaybook>(playbooks.map(p => [p.id, p]));

  const running = executions.filter(e => e.status === 'pending' || e.status === 'running');
  const past = executions.filter(e => e.status === 'completed' || e.status === 'failed' || e.status === 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Playbooks CSM
          </h3>
          <p className="text-sm text-muted-foreground">
            Scénarios automatiques déclenchés par la santé du compte.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild size="sm">
            <Link to="/playbooks-csm">Configurer</Link>
          </Button>
          <Button
            size="sm"
            onClick={() => evaluate.mutate(etablissementId)}
            disabled={evaluate.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            Évaluer maintenant
          </Button>
        </div>
      </div>

      {/* Exécutions en cours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Exécutions en cours ({running.length})
          </CardTitle>
          <CardDescription>Playbooks actifs sur ce compte</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : running.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun playbook en cours.</p>
          ) : (
            <div className="space-y-2">
              {running.map(exec => {
                const pb = playbookById.get(exec.playbook_id);
                return (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{pb?.name ?? 'Playbook'}</div>
                      <div className="text-xs text-muted-foreground">
                        Étape {exec.current_step_order}
                        {exec.next_action_at && (
                          <> · prochaine action {format(new Date(exec.next_action_at), 'd MMM HH:mm', { locale: fr })}</>
                        )}
                      </div>
                    </div>
                    <Badge variant={exec.status === 'pending' ? 'secondary' : 'default'} className="shrink-0">
                      {exec.status === 'pending' ? <Clock className="h-3 w-3 mr-1" /> : <Activity className="h-3 w-3 mr-1" />}
                      {exec.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique ({past.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun playbook exécuté pour ce compte.</p>
          ) : (
            <div className="space-y-2">
              {past.slice(0, 20).map(exec => {
                const pb = playbookById.get(exec.playbook_id);
                const ok = exec.status === 'completed';
                return (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{pb?.name ?? 'Playbook'}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(exec.started_at), 'd MMM yyyy HH:mm', { locale: fr })}
                        {exec.last_error && <> · <span className="text-destructive">{exec.last_error}</span></>}
                      </div>
                    </div>
                    <Badge variant={ok ? 'default' : 'destructive'} className="shrink-0">
                      {ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                      {exec.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
