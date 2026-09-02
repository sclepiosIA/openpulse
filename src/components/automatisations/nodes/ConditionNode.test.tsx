/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ConditionNode } from './ConditionNode';

type WorkflowIssue = { nodeId: string; message: string };
type WorkflowExec = { output?: { branch?: 'true' | 'false' } };

const {
  workflowState,
  getIssuesForNodeMock,
  getNodeRingClassMock,
  nodeStatusBadgeMock,
} = vi.hoisted(() => ({
  workflowState: {
    nodeStatuses: {} as Record<string, WorkflowExec | undefined>,
    validationIssues: [] as WorkflowIssue[],
  },
  getIssuesForNodeMock: vi.fn((issues: WorkflowIssue[], id: string) =>
    issues.filter((issue) => issue.nodeId === id),
  ),
  getNodeRingClassMock: vi.fn(() => 'ring-from-exec'),
  nodeStatusBadgeMock: vi.fn(
    ({
      execution,
      issues,
    }: {
      execution: WorkflowExec | undefined;
      issues: WorkflowIssue[];
    }) => (
      <div data-testid="node-status-badge">
        {JSON.stringify({ execution, issuesCount: issues.length })}
      </div>
    ),
  ),
}));

vi.mock('@/contexts/WorkflowExecutionContext', () => ({
  useWorkflowExecution: () => workflowState,
}));

vi.mock('../NodeStatusBadge', () => ({
  NodeStatusBadge: nodeStatusBadgeMock,
  getNodeRingClass: getNodeRingClassMock,
}));

vi.mock('@/lib/workflow/validateGraph', () => ({
  getIssuesForNode: getIssuesForNodeMock,
}));

vi.mock('@xyflow/react', () => ({
  Handle: ({
    type,
    position,
    id,
    className,
    style,
  }: {
    type: string;
    position: string;
    id?: string;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid={`handle-${type}${id ? `-${id}` : ''}`}
      data-position={position}
      data-class={className}
      data-left={style?.left ? String(style.left) : ''}
    />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
  },
}));

vi.mock('lucide-react', () => ({
  GitBranch: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="git-branch-icon" {...props} />,
}));

describe('ConditionNode', () => {
  beforeEach(() => {
    cleanup();
    workflowState.nodeStatuses = {};
    workflowState.validationIssues = [];
    getIssuesForNodeMock.mockClear();
    getNodeRingClassMock.mockClear();
    nodeStatusBadgeMock.mockClear();
    getNodeRingClassMock.mockReturnValue('ring-from-exec');
  });

  it('affiche le contenu métier, les handles et l’état de branche true sélectionné', () => {
    workflowState.nodeStatuses = {
      'node-1': {
        output: { branch: 'true' },
      },
    };
    workflowState.validationIssues = [
      { nodeId: 'node-1', message: 'missing check' },
      { nodeId: 'other', message: 'other issue' },
    ];

    const { container } = render(
      <ConditionNode
        id="node-1"
        selected={true}
        data={{
          label: 'Vérifier score',
          config: { field: 'score', operator: '>=', value: 10 },
        }}
        dragging={false}
        zIndex={1}
        selectable={true}
        deletable={true}
        isConnectable={true}
        xPos={0}
        yPos={0}
      />,
    );

    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Vérifier score')).toBeInTheDocument();
    expect(screen.getByText('score >= 10')).toBeInTheDocument();
    expect(screen.getByTestId('git-branch-icon')).toBeInTheDocument();

    const trueBranch = screen.getByText('✓ vrai ←');
    const falseBranch = screen.getByText('✗ faux');
    expect(trueBranch.className).toContain('font-bold');
    expect(falseBranch.className).not.toContain('font-bold');

    expect(screen.getByTestId('handle-target')).toHaveAttribute('data-position', 'top');
    expect(screen.getByTestId('handle-source-true')).toHaveAttribute('data-position', 'bottom');
    expect(screen.getByTestId('handle-source-true')).toHaveAttribute('data-left', '25%');
    expect(screen.getByTestId('handle-source-false')).toHaveAttribute('data-left', '75%');

    expect(getIssuesForNodeMock).toHaveBeenCalledWith(workflowState.validationIssues, 'node-1');
    expect(getNodeRingClassMock).toHaveBeenCalledWith(workflowState.nodeStatuses['node-1'], [
      { nodeId: 'node-1', message: 'missing check' },
    ]);

    expect(nodeStatusBadgeMock).toHaveBeenCalledTimes(1);
    const badge = screen.getByTestId('node-status-badge');
    expect(badge.textContent).toContain('"branch":"true"');
    expect(badge.textContent).toContain('"issuesCount":1');

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain('border-amber-500');
    expect(root?.className).toContain('ring-2');
    expect(root?.className).toContain('ring-from-exec');
  });

  it('met en avant la branche false et utilise le libellé par défaut sans ligne de config si field absent', () => {
    workflowState.nodeStatuses = {
      'node-2': {
        output: { branch: 'false' },
      },
    };

    const { container } = render(
      <ConditionNode
        id="node-2"
        selected={false}
        data={{ config: { operator: '=', value: 0 } }}
        dragging={false}
        zIndex={1}
        selectable={true}
        deletable={true}
        isConnectable={true}
        xPos={0}
        yPos={0}
      />,
    );

    expect(screen.getAllByText('Condition')).toHaveLength(2);
    expect(screen.getByText('✗ faux ←')).toBeInTheDocument();
    expect(screen.getByText('✓ vrai')).toBeInTheDocument();

    const falseBranch = screen.getByText('✗ faux ←');
    const trueBranch = screen.getByText('✓ vrai');
    expect(falseBranch.className).toContain('font-bold');
    expect(trueBranch.className).not.toContain('font-bold');

    expect(screen.queryByText(/ = 0$/)).not.toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain('border-amber-500/40');
    expect(root?.className).not.toContain('ring-2');
  });

  it('gère l’absence d’exécution et de config avec des valeurs par défaut cohérentes', () => {
    workflowState.nodeStatuses = {};
    workflowState.validationIssues = [{ nodeId: 'node-3', message: 'warn' }];
    getNodeRingClassMock.mockReturnValue('ring-issue-only');

    const { container } = render(
      <ConditionNode
        id="node-3"
        selected={false}
        data={{}}
        dragging={false}
        zIndex={1}
        selectable={true}
        deletable={true}
        isConnectable={true}
        xPos={0}
        yPos={0}
      />,
    );

    expect(screen.getAllByText('Condition')).toHaveLength(2);
    expect(screen.getByText('✓ vrai')).toBeInTheDocument();
    expect(screen.getByText('✗ faux')).toBeInTheDocument();
    expect(screen.queryByText('✓ vrai ←')).not.toBeInTheDocument();
    expect(screen.queryByText('✗ faux ←')).not.toBeInTheDocument();

    expect(getIssuesForNodeMock).toHaveBeenCalledWith(workflowState.validationIssues, 'node-3');
    expect(getNodeRingClassMock).toHaveBeenCalledWith(undefined, [{ nodeId: 'node-3', message: 'warn' }]);

    const badge = screen.getByTestId('node-status-badge');
    expect(badge.textContent).toContain('"issuesCount":1');

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain('ring-issue-only');
  });
});