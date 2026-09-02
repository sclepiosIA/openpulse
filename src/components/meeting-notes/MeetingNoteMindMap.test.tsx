// @vitest-environment jsdom

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MeetingNoteMindMap } from './MeetingNoteMindMap';

const {
  FLOW_PROPS,
  mockGenerateMindMap,
  mockReactFlow,
  mockBackground,
  mockControls,
  mockMiniMap,
  mockUseNodesState,
  mockUseEdgesState,
  SESSION_WITH_DATA,
  SESSION_EMPTY,
  MINDMAP_RESULT,
} = vi.hoisted(() => {
  const FLOW_PROPS: { current: Record<string, unknown> | null } = { current: null };

  const MINDMAP_RESULT = {
    nodes: [
      {
        id: 'root-1',
        type: 'root',
        position: { x: 100, y: 50 },
        data: { label: 'Réunion équipe', color: '#123456' },
      },
      {
        id: 'topic-1',
        type: 'topic',
        position: { x: 50, y: 150 },
        data: { label: 'Sujet A', description: 'Point principal', color: '#abcdef' },
      },
      {
        id: 'decision-1',
        type: 'decision',
        position: { x: 250, y: 150 },
        data: { label: 'Décision', description: 'Go production', color: '#ff9900' },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'root-1',
        target: 'topic-1',
        animated: false,
      },
      {
        id: 'edge-2',
        source: 'root-1',
        target: 'decision-1',
        animated: true,
      },
    ],
  };

  const SESSION_WITH_DATA = {
    id: 'session-1',
    summary: 'Résumé de réunion',
    decisions: ['Go production'],
    next_steps: ['Préparer le déploiement'],
    participants: [],
  };

  const SESSION_EMPTY = {
    id: 'session-2',
    summary: '',
    decisions: [],
    next_steps: [],
    participants: [],
  };

  return {
    FLOW_PROPS,
    mockGenerateMindMap: vi.fn(() => MINDMAP_RESULT),
    mockReactFlow: vi.fn(),
    mockBackground: vi.fn(),
    mockControls: vi.fn(),
    mockMiniMap: vi.fn(),
    mockUseNodesState: vi.fn(),
    mockUseEdgesState: vi.fn(),
    SESSION_WITH_DATA,
    SESSION_EMPTY,
    MINDMAP_RESULT,
  };
});

vi.mock('@/lib/mindmap-generator', () => ({
  generateMindMap: mockGenerateMindMap,
}));

vi.mock('@xyflow/react/dist/style.css', () => ({}));

vi.mock('@xyflow/react', () => {
  const ReactFlow = (props: Record<string, unknown>) => {
    FLOW_PROPS.current = props;
    mockReactFlow(props);
    return <div data-testid="react-flow">{props.children as React.ReactNode}</div>;
  };

  const Background = (props: Record<string, unknown>) => {
    mockBackground(props);
    return <div data-testid="background" />;
  };

  const Controls = (props: Record<string, unknown>) => {
    mockControls(props);
    return <div data-testid="controls" />;
  };

  const MiniMap = (props: Record<string, unknown>) => {
    mockMiniMap(props);
    return <div data-testid="minimap" />;
  };

  return {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState: mockUseNodesState,
    useEdgesState: mockUseEdgesState,
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

describe('MeetingNoteMindMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FLOW_PROPS.current = null;

    mockUseNodesState.mockImplementation((initialNodes: unknown) => [initialNodes, vi.fn(), vi.fn()]);
    mockUseEdgesState.mockImplementation((initialEdges: unknown) => [initialEdges, vi.fn(), vi.fn()]);
  });

  it('affiche le message vide quand il manque les données nécessaires', () => {
    const Wrapper = createWrapper();

    render(<MeetingNoteMindMap session={SESSION_EMPTY} />, { wrapper: Wrapper });

    expect(
      screen.getByText((content) => content.includes('Pas assez de données pour générer une mind map.'))
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('Le résumé, les décisions ou les actions sont nécessaires.')
      )
    ).toBeInTheDocument();

    expect(mockGenerateMindMap).toHaveBeenCalledTimes(1);
    expect(mockGenerateMindMap).toHaveBeenCalledWith(SESSION_EMPTY);
    expect(screen.queryByTestId('react-flow')).not.toBeInTheDocument();
  });

  it('génère et transmet les nodes et edges transformés à ReactFlow avec les composants enfants attendus', () => {
    const Wrapper = createWrapper();

    render(<MeetingNoteMindMap session={SESSION_WITH_DATA} />, { wrapper: Wrapper });

    expect(mockGenerateMindMap).toHaveBeenCalledTimes(1);
    expect(mockGenerateMindMap).toHaveBeenCalledWith(SESSION_WITH_DATA);

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('minimap')).toBeInTheDocument();

    expect(mockUseNodesState).toHaveBeenCalledTimes(1);
    expect(mockUseEdgesState).toHaveBeenCalledTimes(1);

    const flowProps = FLOW_PROPS.current;
    expect(flowProps).not.toBeNull();

    const props = flowProps as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<Record<string, unknown>>;
      fitView: boolean;
      fitViewOptions: { padding: number };
      minZoom: number;
      maxZoom: number;
      proOptions: { hideAttribution: boolean };
      nodeTypes: Record<string, unknown>;
    };

    expect(props.nodes).toEqual([
      {
        id: 'root-1',
        type: 'root',
        position: { x: 100, y: 50 },
        data: { label: 'Réunion équipe', color: '#123456' },
        draggable: true,
      },
      {
        id: 'topic-1',
        type: 'topic',
        position: { x: 50, y: 150 },
        data: { label: 'Sujet A', description: 'Point principal', color: '#abcdef' },
        draggable: true,
      },
      {
        id: 'decision-1',
        type: 'decision',
        position: { x: 250, y: 150 },
        data: { label: 'Décision', description: 'Go production', color: '#ff9900' },
        draggable: true,
      },
    ]);

    expect(props.edges).toEqual([
      {
        id: 'edge-1',
        source: 'root-1',
        target: 'topic-1',
        animated: false,
        style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
        type: 'smoothstep',
      },
      {
        id: 'edge-2',
        source: 'root-1',
        target: 'decision-1',
        animated: true,
        style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
        type: 'smoothstep',
      },
    ]);

    expect(props.fitView).toBe(true);
    expect(props.fitViewOptions).toEqual({ padding: 0.3 });
    expect(props.minZoom).toBe(0.3);
    expect(props.maxZoom).toBe(2);
    expect(props.proOptions).toEqual({ hideAttribution: true });
    expect(Object.keys(props.nodeTypes).sort()).toEqual(['action', 'decision', 'participant', 'root', 'topic']);

    expect(mockBackground).toHaveBeenCalledWith({ gap: 20, size: 1 });
    expect(mockControls).toHaveBeenCalledWith({ showInteractive: false });
    expect(mockMiniMap).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeStrokeWidth: 2,
        pannable: true,
        zoomable: true,
        className: '!bg-muted/50',
      })
    );

    expect(mockUseNodesState).toHaveBeenCalledWith([
      {
        id: 'root-1',
        type: 'root',
        position: { x: 100, y: 50 },
        data: { label: 'Réunion équipe', color: '#123456' },
        draggable: true,
      },
      {
        id: 'topic-1',
        type: 'topic',
        position: { x: 50, y: 150 },
        data: { label: 'Sujet A', description: 'Point principal', color: '#abcdef' },
        draggable: true,
      },
      {
        id: 'decision-1',
        type: 'decision',
        position: { x: 250, y: 150 },
        data: { label: 'Décision', description: 'Go production', color: '#ff9900' },
        draggable: true,
      },
    ]);

    expect(mockUseEdgesState).toHaveBeenCalledWith([
      {
        id: 'edge-1',
        source: 'root-1',
        target: 'topic-1',
        animated: false,
        style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
        type: 'smoothstep',
      },
      {
        id: 'edge-2',
        source: 'root-1',
        target: 'decision-1',
        animated: true,
        style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1.5 },
        type: 'smoothstep',
      },
    ]);

    expect(MINDMAP_RESULT.nodes).toHaveLength(3);
    expect(MINDMAP_RESULT.edges).toHaveLength(2);
  });
});