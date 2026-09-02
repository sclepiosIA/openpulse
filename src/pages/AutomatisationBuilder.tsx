import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Node, Edge } from '@xyflow/react';
import { ArrowLeft, Save, Play, History, Loader2, FlaskConical, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/shared/use-toast';
import { useWorkflow, useUpdateWorkflow, useTriggerWorkflowManual } from '@/hooks/workflows/useWorkflows';
import { WorkflowCanvas } from '@/components/automatisations/WorkflowCanvas';
import { NodeLibrary } from '@/components/automatisations/panels/NodeLibrary';
import { NodeConfigPanel } from '@/components/automatisations/panels/NodeConfigPanel';
import { WorkflowRunsList } from '@/components/automatisations/WorkflowRunsList';
import { AIWorkflowGenerator } from '@/components/automatisations/AIWorkflowGenerator';
import { DryRunDialog } from '@/components/automatisations/DryRunDialog';
import { WorkflowVersionsDialog } from '@/components/automatisations/WorkflowVersionsDialog';
import { WorkflowImportExportMenu } from '@/components/automatisations/WorkflowImportExportMenu';
import { WorkflowExecutionProvider, useWorkflowExecution, type NodeExecution } from '@/contexts/WorkflowExecutionContext';
import { useWorkflowDryRun } from '@/hooks/workflows/useWorkflowDryRun';
import { validateWorkflowGraph } from '@/lib/workflow/validateGraph';
import { usePageTitle } from '@/hooks/shared/usePageTitle';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PageDataState } from '@/components/common/PageDataState';

function BuilderInner() {
  usePageTitle('Éditeur de workflow');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: workflow, isLoading, isError, error, refetch } = useWorkflow(id);
  const updateMut = useUpdateWorkflow();
  const triggerMut = useTriggerWorkflowManual();
  const dryRunMut = useWorkflowDryRun();

  const {
    setNodeStatuses,
    setExecutedEdgeIds,
    setValidationIssues,
    clearStatuses,
    lastRunMeta,
    setLastRunMeta,
    nodeStatuses,
  } = useWorkflowExecution();

  const [nom, setNom] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dryRunOpen, setDryRunOpen] = useState(false);

  useEffect(() => {
    if (workflow) {
      setNom(workflow.nom);
      setNodes((workflow.graph.nodes || []) as unknown as Node[]);
      setEdges((workflow.graph.edges || []) as unknown as Edge[]);
    }
  }, [workflow]);

  // Validation statique en continu (debounced via useMemo)
  useEffect(() => {
    const issues = validateWorkflowGraph(nodes, edges);
    setValidationIssues(issues);
  }, [nodes, edges, setValidationIssues]);

  const triggerType = (workflow?.trigger_type ?? 'manual') as any;

  const handleAddNode = useCallback((type: 'condition' | 'action' | 'delay') => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: { x: 250 + Math.random() * 100, y: 250 + nodes.length * 80 },
      data: { label: type === 'action' ? 'Nouvelle action' : type === 'condition' ? 'Nouvelle condition' : 'Délai', config: {} },
    };
    setNodes((n) => [...n, newNode]);
  }, [nodes.length]);

  const handleUpdateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data } : n)));
    setSelected((s) => (s && s.id === nodeId ? { ...s, data } : s));
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelected(null);
  }, []);

  const handleSave = async () => {
    if (!id) return;
    if (nodes.length > 50) {
      toast({ title: 'Limite dépassée', description: 'Maximum 50 nœuds par workflow.', variant: 'destructive' });
      return;
    }
    const triggers = nodes.filter((n) => n.type === 'trigger');
    if (triggers.length !== 1) {
      toast({ title: 'Workflow invalide', description: 'Le workflow doit contenir exactement un déclencheur.', variant: 'destructive' });
      return;
    }
    await updateMut.mutateAsync({
      id,
      nom,
      graph: { nodes: nodes as never, edges: edges as never } as never,
    });
    toast({ title: 'Workflow enregistré' });
  };

  const handleRunNow = async () => {
    if (!id) return;
    await handleSave();
    triggerMut.mutate({ workflow_id: id, payload: { manual: true, started_at: new Date().toISOString() } });
  };

  const applyExecutionResult = useCallback(
    (stepsLog: Array<any>, isDryRun: boolean, runId: string) => {
      const statuses: Record<string, NodeExecution> = {};
      stepsLog.forEach((s) => {
        statuses[s.node_id] = {
          status: s.status,
          error: s.error,
          output: s.output,
          branch: s.output?.branch,
        };
      });
      setNodeStatuses(statuses);

      // Edges effectivement empruntées : pour chaque step, edges sortantes consommées
      const executed = new Set<string>();
      stepsLog.forEach((s) => {
        const out = edges.filter((e) => {
          if (e.source !== s.node_id) return false;
          if (s.node_type === 'condition' && s.output?.branch && e.sourceHandle) {
            return e.sourceHandle === s.output.branch;
          }
          return true;
        });
        out.forEach((e) => {
          if (statuses[e.target]) executed.add(e.id);
        });
      });
      setExecutedEdgeIds(executed);
      setLastRunMeta({ run_id: runId, is_dry_run: isDryRun, at: new Date().toISOString() });
    },
    [edges, setNodeStatuses, setExecutedEdgeIds, setLastRunMeta]
  );

  const handleLaunchDryRun = async (payload: Record<string, unknown>) => {
    if (!id) return;
    // Sauvegarde silencieuse pour que le moteur lise le graph à jour
    await updateMut.mutateAsync({
      id,
      nom,
      graph: { nodes: nodes as never, edges: edges as never } as never,
    });
    try {
      const result = await dryRunMut.mutateAsync({ workflow_id: id, trigger_payload: payload });
      applyExecutionResult(result.steps_log, true, result.run_id);
      setDryRunOpen(false);
      const failed = result.steps_log.filter((s) => s.status === 'failed').length;
      const ok = result.steps_log.filter((s) => s.status === 'success' || s.status === 'simulated').length;
      toast({
        title: failed === 0 ? '✅ Test réussi' : `⚠️ Test : ${failed} erreur(s)`,
        description: `${ok} étape(s) OK · ${failed} échec(s)`,
        variant: failed === 0 ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Échec du test', description: e.message, variant: 'destructive' });
    }
  };

  const hasOverlay = useMemo(() => Object.keys(nodeStatuses).length > 0, [nodeStatuses]);

  if (isLoading || isError || !workflow) {
    return (
      <PageDataState
        isLoading={isLoading}
        isError={isError || (!isLoading && !workflow)}
        error={error ?? (!workflow ? new Error('Workflow introuvable') : undefined)}
        onRetry={() => refetch()}
        loadingFallback={
          <div className="flex items-center justify-center h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <></>
      </PageDataState>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/automatisations')} aria-label="Retour">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="max-w-md font-medium"
          placeholder="Nom du workflow"
        />
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <AIWorkflowGenerator
            hasExistingNodes={nodes.length > 0}
            onGenerated={(newNodes, newEdges) => {
              setNodes(newNodes);
              setEdges(newEdges);
              setSelected(null);
              clearStatuses();
            }}
          />
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" /> Historique
              </Button>
            </SheetTrigger>
            <SheetContent className="sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Historique d'exécution</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <WorkflowRunsList workflow_id={id} />
              </div>
            </SheetContent>
          </Sheet>
          <WorkflowVersionsDialog
            workflow_id={id!}
            onRestored={() => {
              // Recharger le workflow après restauration
              window.location.reload();
            }}
          />
          <WorkflowImportExportMenu
            workflowId={id!}
            nom={nom}
            description={workflow?.description}
            triggerType={triggerType}
            triggerConfig={workflow?.trigger_config as Record<string, unknown> | undefined}
            nodes={nodes}
            edges={edges}
          />
          <Button variant="outline" size="sm" onClick={() => setDryRunOpen(true)}>
            <FlaskConical className="h-4 w-4 mr-2" /> Tester
          </Button>
          <Button variant="outline" size="sm" onClick={handleRunNow} disabled={triggerMut.isPending}>
            <Play className="h-4 w-4 mr-2" /> Lancer maintenant
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
            <Save className="h-4 w-4 mr-2" /> Enregistrer
          </Button>
        </div>
      </header>

      {/* Bandeau résultat de test */}
      {hasOverlay && lastRunMeta && (
        <div className="border-b bg-muted/40 px-4 py-2 flex items-center gap-3 text-xs">
          <Badge variant={lastRunMeta.is_dry_run ? 'secondary' : 'default'} className="gap-1">
            {lastRunMeta.is_dry_run ? <FlaskConical className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {lastRunMeta.is_dry_run ? 'Mode test' : 'Exécution réelle'}
          </Badge>
          <span className="text-muted-foreground">
            {format(new Date(lastRunMeta.at), 'PPp', { locale: fr })}
          </span>
          <span className="text-muted-foreground">·</span>
          <span>
            {Object.values(nodeStatuses).filter((n) => n.status === 'success' || n.status === 'simulated').length} OK ·{' '}
            <span className="text-destructive">
              {Object.values(nodeStatuses).filter((n) => n.status === 'failed').length} échec(s)
            </span>
          </span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={clearStatuses}>
            <X className="h-3 w-3 mr-1" /> Effacer le test
          </Button>
        </div>
      )}

      {/* Body 3 colonnes */}
      <div className="flex-1 flex overflow-hidden">
        <NodeLibrary onAddNode={handleAddNode} />
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          onSelectNode={setSelected}
        />
        <NodeConfigPanel
          node={selected}
          onUpdate={handleUpdateNode}
          onDelete={handleDeleteNode}
          onClose={() => setSelected(null)}
          triggerType={triggerType}
        />
      </div>

      <DryRunDialog
        open={dryRunOpen}
        onOpenChange={setDryRunOpen}
        triggerType={triggerType}
        onLaunch={handleLaunchDryRun}
        isPending={dryRunMut.isPending}
      />
    </div>
  );
}

export default function AutomatisationBuilder() {
  return (
    <WorkflowExecutionProvider>
      <BuilderInner />
    </WorkflowExecutionProvider>
  );
}
