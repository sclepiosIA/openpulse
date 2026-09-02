/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TriggerNode } from './TriggerNode';

const {
  workflowState,
  triggerLabels,
  getIssuesForNodeMock,
  getNodeRingClassMock,
  nodeStatusBadgeSpy,
  handleSpy,
  zapSpy,
} = vi.hoisted(() => ({
  workflowState: {
    nodeStatuses: {
      node1: { status: 'success', started_at: '2024-01-01', finished_at: '2024-01-01' },
      node2: { status: 'running' },
      node3: { status: 'idle' },
    } as Record<string, unknown>,
    validationIssues: [
      { nodeId: 'node1', message: 'Issue 1' },
      { nodeId: 'node3', message: 'Issue 3' },
    ] as Array<{ nodeId: string; message: string }>,
  },
  triggerLabels: {
    webhook: 'Webhook',
    schedule: 'Planifié',
    manual: 'Manuel',
  } as Record<string, string>,
  getIssuesForNodeMock: vi.fn(),
  getNodeRingClassMock: vi.fn(),
  nodeStatusBadgeSpy: vi.fn(),
  handleSpy: vi.fn(),
  zapSpy: vi.fn(),
}));

vi.mock('@/types/workflow', () => ({
  TRIGGER_LABELS: triggerLabels,
}));

vi.mock('@/contexts/WorkflowExecutionContext', () => ({
  useWorkflowExecution: () => workflowState,
}));

vi.mock('@/lib/workflow/validateGraph', () => ({
  getIssuesForNode: getIssuesForNodeMock,
}));

vi.mock('../NodeStatusBadge', () => ({
  NodeStatusBadge: (props: { execution: unknown; issues: unknown }) => {
    nodeStatusBadgeSpy(props);
    return <div data-testid="node-status-badge">badge</div>;
  },
  getNodeRingClass: getNodeRingClassMock,
}));

vi.mock('@xyflow/react', () => ({
  Position: {
    Bottom: 'bottom',
  },
  Handle: (props: { type: string; position: string; className?: string }) => {
    handleSpy(props);
    return <div data-testid="handle" data-type={props.type} data-position={props.position} className={props.className} />;
  },
}));

vi.mock('lucide-react', () => ({
  Zap: (props: { className?: string }) => {
    zapSpy(props);
    return <svg data-testid="zap-icon" className={props.className} />;
  },
}));

describe('TriggerNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIssuesForNodeMock.mockReturnValue([{ nodeId: 'node1', message: 'Issue 1' }]);
    getNodeRingClassMock.mockReturnValue('ring-exec-success');
  });

  it('affiche le label explicite, applique les classes de sélection et passe les bonnes données aux dépendances', () => {
    render(
      <TriggerNode
        id="node1"
        data={{ label: 'Mon déclencheur', trigger_type: 'webhook' }}
        selected={true}
        dragging={false}
        zIndex={1}
        selectable={true}
        deletable={true}
        isConnectable={true}
        sourcePosition="bottom"
        targetPosition="top"
        xPos={0}
        yPos={0}
      />
    );

    expect(screen.getByText('Déclencheur')).toBeInTheDocument();
    expect(screen.getByText('Mon déclencheur')).toBeInTheDocument();
    expect(screen.getByTestId('node-status-badge')).toBeInTheDocument();
    expect(screen.getByTestId('handle')).toBeInTheDocument();
    expect(screen.getByTestId('zap-icon')).toBeInTheDocument();

    const root = screen.getByText('Mon déclencheur').closest('div[class*="relative"]');
    expect(root).not.toBeNull();
    expect(root?.className).toContain('border-primary ring-2 ring-primary/30');
    expect(root?.className).toContain('ring-exec-success');

    expect(getIssuesForNodeMock).toHaveBeenCalledTimes(1);
    expect(getIssuesForNodeMock).toHaveBeenCalledWith(workflowState.validationIssues, 'node1');

    expect(getNodeRingClassMock).toHaveBeenCalledTimes(1);
    expect(getNodeRingClassMock).toHaveBeenCalledWith(
      workflowState.nodeStatuses.node1,
      [{ nodeId: 'node1', message: 'Issue 1' }]
    );

    expect(nodeStatusBadgeSpy).toHaveBeenCalledTimes(1);
    expect(nodeStatusBadgeSpy).toHaveBeenCalledWith({
      execution: workflowState.nodeStatuses.node1,
      issues: [{ nodeId: 'node1', message: 'Issue 1' }],
    });

    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(handleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'source',
        position: 'bottom',
        className: '!bg-primary !w-3 !h-3',
      })
    );

    expect(zapSpy).toHaveBeenCalledTimes(1);
    expect(zapSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'h-3.5 w-3.5 text-primary',
      })
    );
  });

  it('utilise le libellé du type de trigger si aucun label custom n’est fourni', () => {
    getIssuesForNodeMock.mockReturnValue([]);
    getNodeRingClassMock.mockReturnValue('ring-warning');

    render(
      <TriggerNode
        id="node2"
        data={{ trigger_type: 'schedule' }}
        selected={false}
        dragging={false}
        zIndex={1}
        selectable={true}
        deletable={true}
        isConnectable={true}
        sourcePosition="bottom"
        targetPosition="top"
        xPos={0}
        yPos={0}
      />
    );

    expect(screen.getByText('Planifié')).toBeInTheDocument();

    const root = screen.getByText('Planifié').closest('div[class*="relative"]');
    expect(root).not.toBeNull();
    expect(root?.className).toContain('border-primary/40');
    expect(root?.className).not.toContain('ring-2 ring-primary/30');
    expect(root?.className).toContain('ring-warning');

    expect(getIssuesForNodeMock).toHaveBeenCalledWith(workflowState.validationIssues, 'node2');
    expect(getNodeRingClassMock).toHaveBeenCalledWith(workflowState.nodeStatuses.node2, []);
    expect(nodeStatusBadgeSpy).toHaveBeenCalledWith({
      execution: workflowState.nodeStatuses.node2,
      issues: [],
    });
  });

  it('affiche "Trigger" si ni label ni trigger_type ne sont fournis', () => {
    getIssuesForNodeMock.mockReturnValue([{ nodeId: 'node3', message: 'Issue 3' }]);
    getNodeRingClassMock.mockReturnValue('ring-idle');

    render(
      <TriggerNode
        id="node3"
        data={{}}
        selected={false}
        dragging={false}
        zIndex={1}
        selectable={true}
        deletable={true}
        isConnectable={true}
        sourcePosition="bottom"
        targetPosition="top"
        xPos={0}
        yPos={0}
      />
    );

    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(getIssuesForNodeMock).toHaveBeenCalledWith(workflowState.validationIssues, 'node3');
    expect(getNodeRingClassMock).toHaveBeenCalledWith(
      workflowState.nodeStatuses.node3,
      [{ nodeId: 'node3', message: 'Issue 3' }]
    );
    expect(nodeStatusBadgeSpy).toHaveBeenCalledWith({
      execution: workflowState.nodeStatuses.node3,
      issues: [{ nodeId: 'node3', message: 'Issue 3' }],
    });
  });
});