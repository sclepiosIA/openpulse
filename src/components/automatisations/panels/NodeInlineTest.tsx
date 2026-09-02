import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FlaskConical, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useWorkflowDryRun } from '@/hooks/workflows/useWorkflowDryRun';
import { toast } from 'sonner';

interface NodeInlineTestProps {
  workflowId: string;
  nodeId: string;
  nodeType: string;
  triggerPayload?: Record<string, unknown>;
}

export function NodeInlineTest({ workflowId, nodeId, nodeType, triggerPayload }: NodeInlineTestProps) {
  const dryRunMut = useWorkflowDryRun();
  const [result, setResult] = useState<{ status: string; output?: any; error?: string } | null>(null);

  const handleTest = async () => {
    setResult(null);
    try {
      const res = await dryRunMut.mutateAsync({
        workflow_id: workflowId,
        trigger_payload: triggerPayload ?? { manual: true },
      });
      const step = res.steps_log?.find((s: any) => s.node_id === nodeId);
      if (step) {
        setResult({ status: step.status, output: step.output, error: step.error });
      } else {
        setResult({ status: 'skipped', error: 'Ce nœud n\'a pas été atteint durant le test.' });
      }
    } catch (e: any) {
      toast.error(`Test échoué : ${e.message}`);
    }
  };

  return (
    <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold flex items-center gap-1">
          <FlaskConical className="h-3 w-3" /> Test rapide
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs"
          disabled={dryRunMut.isPending}
          onClick={handleTest}
        >
          {dryRunMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Tester ce nœud
        </Button>
      </div>
      {result && (
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-1">
            {result.status === 'success' || result.status === 'simulated' ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            ) : (
              <XCircle className="h-3 w-3 text-destructive" />
            )}
            <span className="font-medium capitalize">{result.status}</span>
          </div>
          {result.error && (
            <p className="text-destructive bg-destructive/10 p-1.5 rounded text-[10px]">{result.error}</p>
          )}
          {result.output && (
            <pre className="bg-muted/50 p-1.5 rounded text-[10px] overflow-x-auto max-h-24">
              {JSON.stringify(result.output, null, 2)}
            </pre>
          )}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">
        Exécute un dry-run complet et affiche le résultat de ce nœud.
      </p>
    </div>
  );
}
