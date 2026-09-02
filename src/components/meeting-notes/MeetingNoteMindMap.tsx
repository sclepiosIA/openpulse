import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { TranscriptionSessionWithDetails } from '@/types/transcription';
import { generateMindMap, type MindMapNode } from '@/lib/mindmap-generator';

// Custom node component
function MindMapNodeComponent({ data }: { data: MindMapNode['data'] }) {
  return (
    <div
      className="px-4 py-2 rounded-xl border shadow-sm max-w-[200px] text-center"
      style={{
        borderColor: data.color || 'hsl(var(--border))',
        backgroundColor: data.color ? `${data.color}15` : 'hsl(var(--card))',
      }}
    >
      <div className="text-sm font-medium text-foreground leading-tight">{data.label}</div>
      {data.description && (
        <div className="text-[10px] text-muted-foreground mt-1">{data.description}</div>
      )}
    </div>
  );
}

function RootNodeComponent({ data }: { data: MindMapNode['data'] }) {
  return (
    <div
      className="px-6 py-3 rounded-2xl border-2 shadow-lg text-center"
      style={{
        borderColor: data.color || 'hsl(var(--primary))',
        backgroundColor: data.color ? `${data.color}20` : 'hsl(var(--primary) / 0.1)',
      }}
    >
      <div className="text-base font-bold text-foreground">{data.label}</div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  root: RootNodeComponent,
  topic: MindMapNodeComponent,
  decision: MindMapNodeComponent,
  action: MindMapNodeComponent,
  participant: MindMapNodeComponent,
};

interface MeetingNoteMindMapProps {
  session: TranscriptionSessionWithDetails;
}

export function MeetingNoteMindMap({ session }: MeetingNoteMindMapProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const mindMap = generateMindMap(session);
    const rfNodes: Node[] = mindMap.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
      draggable: true,
    }));
    const rfEdges: Edge[] = mindMap.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.animated,
      style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
      type: 'smoothstep',
    }));
    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [session]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (!session.summary && !session.decisions?.length && !session.next_steps?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Pas assez de données pour générer une mind map.
        <br />Le résumé, les décisions ou les actions sont nécessaires.
      </div>
    );
  }

  return (
    <div className="w-full h-[500px] md:h-[600px] rounded-xl border bg-background overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeStrokeWidth={2}
          pannable
          zoomable
          className="!bg-muted/50"
        />
      </ReactFlow>
    </div>
  );
}
