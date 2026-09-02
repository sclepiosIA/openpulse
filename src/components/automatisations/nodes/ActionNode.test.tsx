// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActionNode } from './ActionNode';

const {
  ACTION_LABELS,
  workflowState,
  EMPTY_ISSUES,
  SUCCESS_ISSUES,
  ERROR_ISSUES,
  SUCCESS_EXECUTION,
  ERROR_EXECUTION,
  mockUseWorkflowExecution,
  mockGetIssuesForNode,
  mockGetNodeRingClass,
  mockNodeStatusBadge,
} = vi.hoisted(() => {
  const labels = {
    send_email: 'Send Email',
    create_task: 'Create Task',
    notify_user: 'Notify User',
  } as Record<string, string>;

  const state = {
    nodeStatuses: {} as Record<string, unknown>,
    validationIssues: [] as Array<unknown>,
  };

  const emptyIssues: Array<unknown> = [];
  const successIssues = [{ message: 'minor issue' }] as Array<unknown>;
  const errorIssues = [{ message: 'blocking' }, { message: 'missing config' }] as Array<unknown>;
  const successExecution = { state: 'success', startedAt: 't1' };
  const errorExecution = { state: 'error', error: { message: 'x' } };

  return {
    ACTION_LABELS: labels,
    workflowState: state,
    EMPTY_ISSUES: emptyIssues,
    SUCCESS_ISSUES: successIssues,
    ERROR_ISSUES: errorIssues,
    SUCCESS_EXECUTION: successExecution,
    ERROR_EXECUTION: errorExecution,
    mockUseWorkflowExecution: vi.fn(() => state),
    mockGetIssuesForNode: vi.fn(() => emptyIssues),
    mockGetNodeRingClass: vi.fn(() => 'ring-from-mock'),
    mockNodeStatusBadge: vi.fn(),
  };
});

vi.mock('@/types/workflow', () => ({
  ACTION_LABELS,
}));

vi.mock('@/contexts/WorkflowExecutionContext', () => ({
  useWorkflowExecution: mockUseWorkflowExecution,
}));

vi.mock('@/lib/workflow/validateGraph', () => ({
  getIssuesForNode: mockGetIssuesForNode,
}));

vi.mock('../NodeStatusBadge', () => ({
  NodeStatusBadge: (props: { execution: unknown; issues: unknown }) => {
    mockNodeStatusBadge(props);
    return <div data-testid="node-status-badge">badge</div>;
  },
  getNodeRingClass: mockGetNodeRingClass,
}));

vi.mock('@xyflow/react', () => ({
  Handle: (props: {
    type: string;
    position: string;
    id?: string;
    className?: string;
    title?: string;
    style?: React.CSSProperties;
  }) => (
    <div
      data-testid={`handle-${props.type}${props.id ? `-${props.id}` : ''}`}
      data-position={props.position}
      data-title={props.title ?? ''}
      className={props.className}
      style={props.style}
    />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
  },
}));

vi.mock('lucide-react', () => ({
  Sparkles: (props: { className?: string }) => <svg data-testid="sparkles-icon" className={props.className} />,
}));

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

describe('ActionNode', () => {
  beforeEach(() => {
    workflowState.nodeStatuses = {};
    workflowState.validationIssues = EMPTY_ISSUES;

    mockUseWorkflowExecution.mockClear();
    mockUseWorkflowExecution.mockImplementation(() => workflowState);

    mockGetIssuesForNode.mockClear();
    mockGetIssuesForNode.mockImplementation(() => EMPTY_ISSUES);

    mockGetNodeRingClass.mockClear();
    mockGetNodeRingClass.mockImplementation(() => 'ring-from-mock');

    mockNodeStatusBadge.mockClear();
  });

  it('renders fallback label, default badges and handles when no action label is available', () => {
    const { container } = render(<ActionNode id="node-1" data={{}} selected={false} />, {
      wrapper: createWrapper(),
    });

    const headerLabel = screen.getByText('Action', {
      selector: 'span',
    });
    const titleLabel = screen.getByText('Action', {
      selector: 'div.text-sm.font-medium.text-foreground',
    });

    expect(headerLabel).toBeInTheDocument();
    expect(titleLabel).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(screen.getByText('err')).toBeInTheDocument();
    expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
    expect(screen.getByTestId('node-status-badge')).toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain('border-emerald-500/40');
    expect(root?.className).toContain('ring-from-mock');
    expect(root?.className).not.toContain('ring-2 ring-emerald-500/30');

    expect(screen.getByTestId('handle-target')).toHaveAttribute('data-position', 'top');
    expect(screen.getByTestId('handle-source-success')).toHaveAttribute('data-position', 'bottom');
    expect(screen.getByTestId('handle-source-success')).toHaveStyle({ left: '35%' });
    expect(screen.getByTestId('handle-source-error')).toHaveAttribute('data-title', "Branche d'erreur");
    expect(screen.getByTestId('handle-source-error')).toHaveStyle({ left: '70%' });

    expect(mockUseWorkflowExecution).toHaveBeenCalledTimes(1);
    expect(mockGetIssuesForNode).toHaveBeenCalledWith(EMPTY_ISSUES, 'node-1');
    expect(mockGetNodeRingClass).toHaveBeenCalledWith(undefined, EMPTY_ISSUES);
    expect(mockNodeStatusBadge).toHaveBeenCalledWith({ execution: undefined, issues: EMPTY_ISSUES });
  });

  it('renders selected success node with explicit label and passes execution data to badge helpers', () => {
    workflowState.nodeStatuses = { 'node-42': SUCCESS_EXECUTION };
    workflowState.validationIssues = [{ nodeId: 'node-42', message: 'minor issue' }];

    mockGetIssuesForNode.mockImplementation((allIssues: unknown, id: string) => {
      if (allIssues === workflowState.validationIssues && id === 'node-42') {
        return SUCCESS_ISSUES;
      }
      return EMPTY_ISSUES;
    });

    mockGetNodeRingClass.mockImplementation((exec: unknown, currentIssues: unknown) => {
      if (exec === SUCCESS_EXECUTION && currentIssues === SUCCESS_ISSUES) {
        return 'ring-success';
      }
      return 'ring-other';
    });

    const { container } = render(
      <ActionNode id="node-42" data={{ action_type: 'send_email', label: 'Custom Approval Email' }} selected={true} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Custom Approval Email')).toBeInTheDocument();
    expect(screen.queryByText('Send Email')).not.toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain('border-emerald-500');
    expect(root?.className).toContain('ring-2');
    expect(root?.className).toContain('ring-emerald-500/30');
    expect(root?.className).toContain('ring-success');

    expect(mockGetIssuesForNode).toHaveBeenCalledWith(workflowState.validationIssues, 'node-42');
    expect(mockGetNodeRingClass).toHaveBeenCalledWith(SUCCESS_EXECUTION, SUCCESS_ISSUES);
    expect(mockNodeStatusBadge).toHaveBeenCalledWith({ execution: SUCCESS_EXECUTION, issues: SUCCESS_ISSUES });
  });

  it('renders mapped action label when custom label is absent', () => {
    render(<ActionNode id="node-7" data={{ action_type: 'create_task' }} selected={false} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Create Task')).toBeInTheDocument();
    expect(
      screen.getByText('Action', {
        selector: 'span',
      })
    ).toBeInTheDocument();
  });

  it('renders error execution state and uses returned issues to compute error ring class', () => {
    workflowState.nodeStatuses = { 'node-err': ERROR_EXECUTION };
    workflowState.validationIssues = ERROR_ISSUES;

    mockGetIssuesForNode.mockImplementation((allIssues: unknown, id: string) => {
      if (allIssues === ERROR_ISSUES && id === 'node-err') {
        return ERROR_ISSUES;
      }
      return EMPTY_ISSUES;
    });

    mockGetNodeRingClass.mockImplementation((exec: unknown, currentIssues: unknown) => {
      if (exec === ERROR_EXECUTION && currentIssues === ERROR_ISSUES) {
        return 'ring-error';
      }
      return '';
    });

    const { container } = render(<ActionNode id="node-err" data={{ action_type: 'notify_user' }} selected={false} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByText('Notify User')).toBeInTheDocument();

    const root = container.firstElementChild;
    expect(root?.className).toContain('ring-error');
    expect(root?.className).toContain('border-emerald-500/40');

    expect(mockGetIssuesForNode).toHaveBeenCalledWith(ERROR_ISSUES, 'node-err');
    expect(mockGetNodeRingClass).toHaveBeenCalledWith(ERROR_EXECUTION, ERROR_ISSUES);
    expect(mockNodeStatusBadge).toHaveBeenCalledWith({ execution: ERROR_EXECUTION, issues: ERROR_ISSUES });
  });
});