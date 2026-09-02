/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Edge, Node } from '@xyflow/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowCanvas } from './WorkflowCanvas';

const {
  WORKFLOW_STATE_LOADING,
  WORKFLOW_STATE_SUCCESS,
  WORKFLOW_STATE_ERROR,
  mockUseWorkflowExecution,
  mockApplyNodeChanges,
  mockApplyEdgeChanges,
  mockAddEdge,
  mockReactFlowProps,
  mockTriggerNode,
  mockConditionNode,
  mockActionNode,
  mockDelayNode,
  mockCanvasLegend,
} = vi.hoisted(() => {
  const WORKFLOW_STATE_LOADING = {
    nodeStatuses: {},
    executedEdgeIds: new Set<string>(),
    isLoading: true,
  };

  const WORKFLOW_STATE_SUCCESS = {
    nodeStatuses: {
      n1: { status: 'success' },
      n2: { status: 'simulated' },
      n3: { status: 'failed' },
    },
    executedEdgeIds: new Set<string>(['e1', 'e2']),
    isLoading: false,
  };

  const WORKFLOW_STATE_ERROR = {
    data: null,
    error: { message: 'x' },
    nodeStatuses: {},
    executedEdgeIds: new Set<string>(),
    isLoading: false,
    isError: true,
  };

  return {
    WORKFLOW_STATE_LOADING,
    WORKFLOW_STATE_SUCCESS,
    WORKFLOW_STATE_ERROR,
    mockUseWorkflowExecution: vi.fn(() => WORKFLOW_STATE_SUCCESS),
    mockApplyNodeChanges: vi.fn(),
    mockApplyEdgeChanges: vi.fn(),
    mockAddEdge: vi.fn(),
    mockReactFlowProps: vi.fn(),
    mockTriggerNode: vi.fn(() => React.createElement('div', { 'data-testid': 'trigger-node' })),
    mockConditionNode: vi.fn(() => React.createElement('div', { 'data-testid': 'condition-node' })),
    mockActionNode: vi.fn(() => React.createElement('div', { 'data-testid': 'action-node' })),
    mockDelayNode: vi.fn(() => React.createElement('div', { 'data-testid': 'delay-node' })),
    mockCanvasLegend: vi.fn(() => React.createElement('div', { 'data-testid': 'canvas-legend' }, 'Legend')),
  };
});

vi.mock('@/contexts/WorkflowExecutionContext', () => ({
  useWorkflowExecution: mockUseWorkflowExecution,
}));

vi.mock('./nodes/TriggerNode', () => ({
  TriggerNode: mockTriggerNode,
}));

vi.mock('./nodes/ConditionNode', () => ({
  ConditionNode: mockConditionNode,
}));

vi.mock('./nodes/ActionNode', () => ({
  ActionNode: mockActionNode,
}));

vi.mock('./nodes/DelayNode', () => ({
  DelayNode: mockDelayNode,
}));

vi.mock('./CanvasLegend', () => ({
  CanvasLegend: mockCanvasLegend,
}));

vi.mock('@xyflow/react/dist/style.css', () => ({}));

vi.mock('@xyflow/react', async () => {
  const ReactModule = await import('react');

  return {
    MarkerType: {
      ArrowClosed: 'ArrowClosed',
    },
    applyNodeChanges: mockApplyNodeChanges,
    applyEdgeChanges: mockApplyEdgeChanges,
    addEdge: mockAddEdge,
    Background: () => ReactModule.createElement('div', { 'data-testid': 'background' }),
    Controls: () => ReactModule.createElement('div', { 'data-testid': 'controls' }),
    MiniMap: () => ReactModule.createElement('div', { 'data-testid': 'minimap' }),
    ReactFlow: (props: {
      nodes: Node[];
      edges: Edge[];
      onNodeClick: (_event: unknown, node: Node) => void;
      onPaneClick: () => void;
      onNodesChange: (changes: Array<{ id: string; type: string }>) => void;
      onEdgesChange: (changes: Array<{ id: string; type: string }>) => void;
      onConnect: (connection: { source: string; target: string }) => void;
      children: React.ReactNode;
    }) => {
      mockReactFlowProps(props);
      return ReactModule.createElement(
        'div',
        { 'data-testid': 'react-flow' },
        ReactModule.createElement('div', { 'data-testid': 'edges-json' }, JSON.stringify(props.edges)),
        ReactModule.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'node-click',
            onClick: () => props.onNodeClick({}, props.nodes[0]),
          },
          'node-click'
        ),
        ReactModule.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'pane-click',
            onClick: () => props.onPaneClick(),
          },
          'pane-click'
        ),
        ReactModule.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'nodes-change',
            onClick: () => props.onNodesChange([{ id: 'n1', type: 'position' }]),
          },
          'nodes-change'
        ),
        ReactModule.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'edges-change',
            onClick: () => props.onEdgesChange([{ id: 'e1', type: 'remove' }]),
          },
          'edges-change'
        ),
        ReactModule.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'connect',
            onClick: () => props.onConnect({ source: 'n1', target: 'n2' }),
          },
          'connect'
        ),
        props.children
      );
    },
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('WorkflowCanvas', () => {
  const nodes: Node[] = [
    { id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Start' }, type: 'trigger' },
    { id: 'n2', position: { x: 100, y: 50 }, data: { label: 'Check' }, type: 'condition' },
    { id: 'n3', position: { x: 200, y: 100 }, data: { label: 'Action' }, type: 'action' },
    { id: 'n4', position: { x: 300, y: 150 }, data: { label: 'Delay' }, type: 'delay' },
  ];

  const edges: Edge[] = [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n4', target: 'n1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkflowExecution.mockReturnValue(WORKFLOW_STATE_SUCCESS);
    mockApplyNodeChanges.mockReturnValue([{ id: 'n1', position: { x: 10, y: 20 }, data: { label: 'Moved' } }]);
    mockApplyEdgeChanges.mockReturnValue([{ id: 'e9', source: 'n1', target: 'n3' }]);
    mockAddEdge.mockReturnValue([{ id: 'new-edge', source: 'n1', target: 'n2' }]);
  });

  it('affiche le canvas avec ses sous-composants et décore les edges selon les statuts exécutés', () => {
    render(
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onSelectNode={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('canvas-legend')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();

    const renderedEdges = JSON.parse(screen.getByTestId('edges-json').textContent || '[]') as Array<{
      id: string;
      animated: boolean;
      markerEnd: { type: string; width: number; height: number; color: string };
      style: { strokeWidth: number; stroke: string; opacity: number };
    }>;

    expect(renderedEdges).toHaveLength(3);

    expect(renderedEdges[0]).toMatchObject({
      id: 'e1',
      animated: true,
      markerEnd: {
        type: 'ArrowClosed',
        width: 18,
        height: 18,
        color: 'hsl(217 91% 60%)',
      },
      style: {
        strokeWidth: 2,
        stroke: 'hsl(217 91% 60%)',
        opacity: 1,
      },
    });

    expect(renderedEdges[1]).toMatchObject({
      id: 'e2',
      animated: true,
      markerEnd: {
        type: 'ArrowClosed',
        width: 18,
        height: 18,
        color: 'hsl(var(--destructive))',
      },
      style: {
        strokeWidth: 2,
        stroke: 'hsl(var(--destructive))',
        opacity: 1,
      },
    });

    expect(renderedEdges[2]).toMatchObject({
      id: 'e3',
      animated: true,
      markerEnd: {
        type: 'ArrowClosed',
        width: 18,
        height: 18,
        color: 'hsl(var(--primary))',
      },
      style: {
        strokeWidth: 2,
        stroke: 'hsl(var(--primary))',
        opacity: 0.35,
      },
    });

    expect(mockReactFlowProps).toHaveBeenCalled();
    const lastCall = mockReactFlowProps.mock.calls.at(-1);
    expect(lastCall?.[0].defaultEdgeOptions).toEqual({
      animated: true,
      markerEnd: {
        type: 'ArrowClosed',
        width: 18,
        height: 18,
        color: 'hsl(var(--primary))',
      },
      style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
    });
  });

  it('gère un état de chargement sans erreur et conserve le rendu du canvas', () => {
    mockUseWorkflowExecution.mockReturnValue(WORKFLOW_STATE_LOADING);

    render(
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onSelectNode={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();

    const renderedEdges = JSON.parse(screen.getByTestId('edges-json').textContent || '[]') as Array<{
      id: string;
      style: { stroke: string; opacity: number };
      markerEnd: { color: string };
      animated: boolean;
    }>;

    expect(renderedEdges[0]).toMatchObject({
      id: 'e1',
      animated: true,
      markerEnd: { color: 'hsl(var(--primary))' },
      style: { stroke: 'hsl(var(--primary))', opacity: 1 },
    });
    expect(renderedEdges[1]).toMatchObject({
      id: 'e2',
      animated: true,
      markerEnd: { color: 'hsl(var(--primary))' },
      style: { stroke: 'hsl(var(--primary))', opacity: 1 },
    });
  });

  it('tolère un état de type erreur du contexte et continue à fournir des edges décorées par défaut', () => {
    mockUseWorkflowExecution.mockReturnValue(WORKFLOW_STATE_ERROR);

    render(
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onSelectNode={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    const renderedEdges = JSON.parse(screen.getByTestId('edges-json').textContent || '[]') as Array<{
      id: string;
      style: { stroke: string; opacity: number };
      markerEnd: { color: string };
    }>;

    expect(renderedEdges).toHaveLength(3);
    expect(renderedEdges.every((edge) => edge.style.stroke === 'hsl(var(--primary))')).toBe(true);
    expect(renderedEdges.every((edge) => edge.style.opacity === 1)).toBe(true);
    expect(renderedEdges.every((edge) => edge.markerEnd.color === 'hsl(var(--primary))')).toBe(true);
  });

  it('propage la sélection de node et le clic sur le canvas', () => {
    const onSelectNode = vi.fn();

    render(
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={vi.fn()}
        onEdgesChange={vi.fn()}
        onSelectNode={onSelectNode}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByTestId('node-click'));
    expect(onSelectNode).toHaveBeenCalledWith(nodes[0]);

    fireEvent.click(screen.getByTestId('pane-click'));
    expect(onSelectNode).toHaveBeenCalledWith(null);
  });

  it('applique les changements de nodes via applyNodeChanges puis appelle onNodesChange avec le résultat', () => {
    const onNodesChange = vi.fn();

    render(
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={vi.fn()}
        onSelectNode={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByTestId('nodes-change'));

    expect(mockApplyNodeChanges).toHaveBeenCalledWith([{ id: 'n1', type: 'position' }], nodes);
    expect(onNodesChange).toHaveBeenCalledWith([{ id: 'n1', position: { x: 10, y: 20 }, data: { label: 'Moved' } }]);
  });

  it('applique les changements de edges via applyEdgeChanges puis appelle onEdgesChange avec le résultat', () => {
    const onEdgesChange = vi.fn();

    render(
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={vi.fn()}
        onEdgesChange={onEdgesChange}
        onSelectNode={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByTestId('edges-change'));

    expect(mockApplyEdgeChanges).toHaveBeenCalledWith([{ id: 'e1', type: 'remove' }], edges);
    expect(onEdgesChange).toHaveBeenCalledWith([{ id: 'e9', source: 'n1', target: 'n3' }]);
  });

  it('ajoute une connexion avec les options métier attendues puis appelle onEdgesChange', () => {
    const onEdgesChange = vi.fn();

    render(
      <WorkflowCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={vi.fn()}
        onEdgesChange={onEdgesChange}
        onSelectNode={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByTestId('connect'));

    expect(mockAddEdge).toHaveBeenCalledWith(
      {
        source: 'n1',
        target: 'n2',
        animated: true,
        markerEnd: {
          type: 'ArrowClosed',
          width: 18,
          height: 18,
          color: 'hsl(var(--primary))',
        },
        style: { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
      },
      edges
    );
    expect(onEdgesChange).toHaveBeenCalledWith([{ id: 'new-edge', source: 'n1', target: 'n2' }]);
  });
});