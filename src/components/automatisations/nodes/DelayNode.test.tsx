/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DelayNode } from './DelayNode';

const {
  workflowState,
  useWorkflowExecutionMock,
  getIssuesForNodeMock,
  getNodeRingClassMock,
  nodeStatusBadgeMock,
} = vi.hoisted(() => ({
  workflowState: {
    nodeStatuses: {} as Record<string, unknown>,
    validationIssues: [] as Array<{ nodeId: string; message: string }>,
  },
  useWorkflowExecutionMock: vi.fn(() => ({
    nodeStatuses: {} as Record<string, unknown>,
    validationIssues: [] as Array<{ nodeId: string; message: string }>,
  })),
  getIssuesForNodeMock: vi.fn(
    (issues: Array<{ nodeId: string; message: string }>, nodeId: string) =>
      issues.filter((issue) => issue.nodeId === nodeId),
  ),
  getNodeRingClassMock: vi.fn(() => 'ring-from-mock'),
  nodeStatusBadgeMock: vi.fn(
    ({ execution, issues }: { execution: unknown; issues: Array<{ nodeId: string; message: string }> }) => (
      <div data-testid="node-status-badge">
        {JSON.stringify({ execution, issuesCount: issues.length })}
      </div>
    ),
  ),
}));

useWorkflowExecutionMock.mockImplementation(() => workflowState);

vi.mock('@/contexts/WorkflowExecutionContext', () => ({
  useWorkflowExecution: useWorkflowExecutionMock,
}));

vi.mock('@/lib/workflow/validateGraph', () => ({
  getIssuesForNode: getIssuesForNodeMock,
}));

vi.mock('../NodeStatusBadge', () => ({
  NodeStatusBadge: nodeStatusBadgeMock,
  getNodeRingClass: getNodeRingClassMock,
}));

vi.mock('@xyflow/react', () => ({
  Handle: ({
    type,
    position,
    className,
  }: {
    type: string;
    position: string;
    className?: string;
  }) => <div data-testid={`handle-${type}`} data-position={position} className={className} />,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
  },
}));

vi.mock('lucide-react', () => ({
  Clock: ({ className }: { className?: string }) => <svg data-testid="clock-icon" className={className} />,
}));

describe('DelayNode', () => {
  beforeEach(() => {
    workflowState.nodeStatuses = {};
    workflowState.validationIssues = [];
    useWorkflowExecutionMock.mockClear();
    getIssuesForNodeMock.mockClear();
    getNodeRingClassMock.mockClear();
    nodeStatusBadgeMock.mockClear();
    getNodeRingClassMock.mockReturnValue('ring-from-mock');
  });

  it('affiche le libellé par défaut et les handles, et applique les classes quand non sélectionné', () => {
    render(<DelayNode id="node-1" data={{}} selected={false} />);

    expect(screen.getByText('Délai')).toBeInTheDocument();
    expect(screen.getByText('Attendre 1 minutes')).toBeInTheDocument();
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    expect(screen.getByTestId('handle-target')).toHaveAttribute('data-position', 'top');
    expect(screen.getByTestId('handle-source')).toHaveAttribute('data-position', 'bottom');

    const container = screen.getByText('Attendre 1 minutes').closest('div[class*="relative"]');
    expect(container).toHaveClass('border-blue-500/40');
    expect(container).toHaveClass('ring-from-mock');
    expect(container).not.toHaveClass('border-blue-500', 'ring-2', 'ring-blue-500/30');

    expect(useWorkflowExecutionMock).toHaveBeenCalledTimes(1);
    expect(getIssuesForNodeMock).toHaveBeenCalledWith([], 'node-1');
    expect(getNodeRingClassMock).toHaveBeenCalledWith(undefined, []);
  });

  it('affiche la configuration métier fournie et transmet execution/issues aux dépendances', () => {
    const exec = { status: 'running', startedAt: 'now' };
    workflowState.nodeStatuses = { delayA: exec };
    workflowState.validationIssues = [
      { nodeId: 'delayA', message: 'missing something' },
      { nodeId: 'other', message: 'other issue' },
      { nodeId: 'delayA', message: 'another issue' },
    ];
    getNodeRingClassMock.mockReturnValue('ring-warning');

    render(<DelayNode id="delayA" data={{ config: { amount: 5, unit: 'heures' } }} selected={true} />);

    expect(screen.getByText('Attendre 5 heures')).toBeInTheDocument();

    const container = screen.getByText('Attendre 5 heures').closest('div[class*="relative"]');
    expect(container).toHaveClass('border-blue-500');
    expect(container).toHaveClass('ring-2');
    expect(container).toHaveClass('ring-blue-500/30');
    expect(container).toHaveClass('ring-warning');

    const expectedIssues = [
      { nodeId: 'delayA', message: 'missing something' },
      { nodeId: 'delayA', message: 'another issue' },
    ];

    expect(getIssuesForNodeMock).toHaveBeenCalledWith(workflowState.validationIssues, 'delayA');
    expect(getNodeRingClassMock).toHaveBeenCalledWith(exec, expectedIssues);

    expect(nodeStatusBadgeMock).toHaveBeenCalledTimes(1);
    const firstCallArgs = nodeStatusBadgeMock.mock.calls[0];
    expect(firstCallArgs[0]).toEqual(
      expect.objectContaining({
        execution: exec,
        issues: expectedIssues,
      }),
    );
    expect(firstCallArgs[1]).toEqual(expect.anything());

    expect(screen.getByTestId('node-status-badge')).toHaveTextContent('"issuesCount":2');
    expect(screen.getByTestId('node-status-badge')).toHaveTextContent('"status":"running"');
  });

  it('utilise les valeurs par défaut si config est absente et displayName est défini', () => {
    render(<DelayNode id="node-defaults" data={{ label: 'x' }} selected={false} />);

    expect(screen.getByText('Attendre 1 minutes')).toBeInTheDocument();
    expect(DelayNode.displayName).toBe('DelayNode');
  });
});