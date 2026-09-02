import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle2, XCircle, Loader2, Clock, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWorkflowRuns } from '@/hooks/workflows/useWorkflowRuns';
import { useWorkflowReplay } from '@/hooks/workflows/useWorkflowReplay';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import type { WorkflowRunStatus, WorkflowStepLog } from '@/types/workflow';

interface WorkflowRunsListProps {
  workflow_id?: string;
}

const statusIcon = (s: WorkflowRunStatus | WorkflowStepLog['status']) => {
  if (s === 'success') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === 'failed') return <XCircle className="h-4 w-4 text-destructive" />;
  if (s === 'running' || s === 'pending') return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
  if (s === 'scheduled') return <Clock className="h-4 w-4 text-amber-500" />;
  return <ChevronRight className="h-4 w-4 text-muted-foreground" />;
};

const statusVariant = (s: WorkflowRunStatus): 'default' | 'destructive' | 'secondary' | 'outline' => {
  if (s === 'success') return 'default';
  if (s === 'failed') return 'destructive';
  if (s === 'running' || s === 'pending' || s === 'paused') return 'secondary';
  return 'outline';
};

export function WorkflowRunsList({ workflow_id }: WorkflowRunsListProps) {
  const { data: runs, isLoading } = useWorkflowRuns(workflow_id);
  const qc = useQueryClient();
  const replayMut = useWorkflowReplay();

  const setStatus = async (id: string, status: WorkflowRunStatus) => {
    const { error } = await supabase.from('workflow_runs').update({ status: status as any }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'paused' ? 'Run mis en pause' : 'Run repris');
    qc.invalidateQueries({ queryKey: ['workflow_runs'] });

    if (status === 'running') {
      // Reprise depuis le dernier nœud non terminé
      const run = runs?.find(r => r.id === id);
      const lastStep = run?.steps_log?.slice().reverse().find(s => s.status !== 'failed');
      if (run && lastStep) {
        await supabase.functions.invoke('workflow-engine', {
          body: {
            workflow_id: run.workflow_id,
            run_id: id,
            resume_from_node: lastStep.node_id,
            trigger_payload: run.trigger_payload,
          },
        });
        qc.invalidateQueries({ queryKey: ['workflow_runs'] });
      }
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }
  if (!runs?.length) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Aucune exécution pour le moment.
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-3 pr-3">
        {runs.map((run) => (
          <Card key={run.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  {statusIcon(run.status)}
                  Run du {format(new Date(run.started_at), 'PPp', { locale: fr })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(run.status)} className="text-xs">{run.status}</Badge>
                  {run.status === 'running' && (
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setStatus(run.id, 'paused')}>
                      <Pause className="h-3 w-3 mr-1" /> Pause
                    </Button>
                  )}
                  {run.status === 'paused' && (
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setStatus(run.id, 'running')}>
                      <Play className="h-3 w-3 mr-1" /> Reprendre
                    </Button>
                  )}
                  {(run.status === 'success' || run.status === 'failed') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      disabled={replayMut.isPending}
                      onClick={() => replayMut.mutate(run.id)}
                      title="Rejouer cette exécution"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Rejouer
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {run.error && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded mb-2">{run.error}</p>
              )}
              <div className="space-y-1.5">
                {(run.steps_log || []).map((step, i) => (
                  <div key={`workflow-step-${run.id}-${step.node_id ?? i}`} className="flex items-start gap-2 text-xs">
                    {statusIcon(step.status)}
                    <div className="flex-1">
                      <span className="font-medium capitalize">{step.node_type}</span>
                      <span className="text-muted-foreground"> · {step.node_id}</span>
                      {step.error && (
                        <div className="text-destructive mt-0.5">{step.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {run.duration_ms != null && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Durée : {run.duration_ms} ms
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
