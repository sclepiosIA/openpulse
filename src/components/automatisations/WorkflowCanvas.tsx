import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type NodeTypes,
  type DefaultEdgeOptions,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TriggerNode } from './nodes/TriggerNode';
import { ConditionNode } from './nodes/ConditionNode';
import { ActionNode } from './nodes/ActionNode';
import { DelayNode } from './nodes/DelayNode';
import { CanvasLegend } from './CanvasLegend';
import { useWorkflowExecution } from '@/contexts/WorkflowExecutionContext';

interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (nodes: Node[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onSelectNode: (node: Node | null) => void;
}

const ARROW = { type: MarkerType.ArrowClosed, width: 18, height: 18, color: 'hsl(var(--primary))' };

const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: true,
  markerEnd: ARROW,
  style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
};

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onSelectNode,
}: WorkflowCanvasProps) {
  const { nodeStatuses, executedEdgeIds } = useWorkflowExecution();

  const nodeTypes: NodeTypes = useMemo(
    () => ({
      trigger: TriggerNode,
      condition: ConditionNode,
      action: ActionNode,
      delay: DelayNode,
    }),
    []
  );

  // Normalise les edges chargées : ajoute markerEnd si absent + colorie selon exécution
  const decoratedEdges = useMemo(() => {
    return edges.map((e) => {
      const sourceStatus = nodeStatuses[e.source]?.status;
      const targetStatus = nodeStatuses[e.target]?.status;
      let stroke = 'hsl(var(--primary))';
      let opacity = 1;
      const wasExecuted = executedEdgeIds.has(e.id);

      if (targetStatus === 'failed') {
        stroke = 'hsl(var(--destructive))';
      } else if (wasExecuted && (targetStatus === 'success' || targetStatus === 'simulated')) {
        stroke = targetStatus === 'simulated' ? 'hsl(217 91% 60%)' : 'hsl(142 71% 45%)';
      } else if (Object.keys(nodeStatuses).length > 0 && !wasExecuted && !sourceStatus) {
        opacity = 0.35;
      }

      return {
        ...e,
        animated: e.animated ?? true,
        markerEnd: e.markerEnd ?? { ...ARROW, color: stroke },
        style: { ...(e.style || {}), strokeWidth: 2, stroke, opacity },
      };
    });
  }, [edges, nodeStatuses, executedEdgeIds]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => onNodesChange(applyNodeChanges(changes, nodes)),
    [nodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => onEdgesChange(applyEdgeChanges(changes, edges)),
    [edges, onEdgesChange]
  );

  const handleConnect = useCallback(
    (conn: Connection) =>
      onEdgesChange(
        addEdge(
          {
            ...conn,
            animated: true,
            markerEnd: ARROW,
            style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
          },
          edges
        )
      ),
    [edges, onEdgesChange]
  );

  return (
    <div className="flex-1 h-full relative">
      <CanvasLegend />
      <ReactFlow
        nodes={nodes}
        edges={decoratedEdges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={(_, node) => onSelectNode(node)}
        onPaneClick={() => onSelectNode(null)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable className="!bg-muted/50" />
      </ReactFlow>
    </div>
  );
}
