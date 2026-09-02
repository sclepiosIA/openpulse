import React, { type ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkflowExecutionProvider, useWorkflowExecution, type NodeExecution } from './WorkflowExecutionContext';

const { VALIDATION_ISSUES, NODE_STATUSES, EDGE_IDS, RUN_META } = vi.hoisted(() => ({
  VALIDATION_ISSUES: [
    { nodeId: 'node-b', message: 'Missing mapping' },
    { nodeId: 'node-c', message: 'Waiting dependency' },
  ],
  NODE_STATUSES: {
    'node-a': {
      status: 'success' as const,
      durationMs: 125,
      output: { records: 3, label: 'done' },
    },
    'node-b': {
      status: 'failed' as const,
      error: 'boom',
      branch: 'false' as const,
    },
    'node-c': {
      status: 'scheduled' as const,
      output: null,
    },
  } satisfies Record<string, NodeExecution>,
  EDGE_IDS: new Set(['edge-1', 'edge-2']),
  RUN_META: {
    run_id: 'run-42',
    is_dry_run: false,
    at: '2024-06-01T10:00:00.000Z',
  },
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

const createWrapper = (withProvider: boolean) => {
  const queryClient = createQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    const content = withProvider ? (
      <WorkflowExecutionProvider>{children}</WorkflowExecutionProvider>
    ) : (
      children
    );

    return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
  };
};

describe('WorkflowExecutionContext', () => {
  it('returns safe fallback values when used outside provider', async () => {
    const wrapper = createWrapper(false);
    const { result } = renderHook(() => useWorkflowExecution(), { wrapper });

    expect(result.current.nodeStatuses).toEqual({});
    expect(result.current.validationIssues).toEqual([]);
    expect(result.current.executedEdgeIds).toEqual(new Set());
    expect(result.current.lastRunMeta).toBeNull();
    expect(typeof result.current.setNodeStatuses).toBe('function');
    expect(typeof result.current.setValidationIssues).toBe('function');
    expect(typeof result.current.setExecutedEdgeIds).toBe('function');
    expect(typeof result.current.setLastRunMeta).toBe('function');
    expect(typeof result.current.clearStatuses).toBe('function');

    await act(async () => {
      result.current.setNodeStatuses({
        n1: { status: 'success', durationMs: 12, output: { ok: true } },
      });
      result.current.setValidationIssues([{ nodeId: 'n1', message: 'issue' }]);
      result.current.setExecutedEdgeIds(new Set(['e1']));
      result.current.setLastRunMeta({
        run_id: 'run-1',
        is_dry_run: true,
        at: '2024-01-01T00:00:00.000Z',
      });
      result.current.clearStatuses();
    });

    expect(result.current.nodeStatuses).toEqual({});
    expect(result.current.validationIssues).toEqual([]);
    expect(result.current.executedEdgeIds).toEqual(new Set());
    expect(result.current.lastRunMeta).toBeNull();

    await waitFor(() => {
      expect(result.current.executedEdgeIds.size).toBe(0);
    });
  });

  it('stores and exposes execution state through provider', async () => {
    const wrapper = createWrapper(true);
    const { result } = renderHook(() => useWorkflowExecution(), { wrapper });

    expect(result.current.nodeStatuses).toEqual({});
    expect(result.current.validationIssues).toEqual([]);
    expect(result.current.executedEdgeIds.size).toBe(0);
    expect(result.current.lastRunMeta).toBeNull();

    await act(async () => {
      result.current.setNodeStatuses(NODE_STATUSES);
      result.current.setValidationIssues(VALIDATION_ISSUES);
      result.current.setExecutedEdgeIds(EDGE_IDS);
      result.current.setLastRunMeta(RUN_META);
    });

    expect(result.current.nodeStatuses).toEqual(NODE_STATUSES);
    expect(result.current.nodeStatuses['node-a']).toEqual({
      status: 'success',
      durationMs: 125,
      output: { records: 3, label: 'done' },
    });
    expect(result.current.nodeStatuses['node-a']?.status).toBe('success');
    expect(result.current.nodeStatuses['node-a']?.durationMs).toBe(125);
    expect(result.current.nodeStatuses['node-a']?.output).toEqual({ records: 3, label: 'done' });
    expect(result.current.nodeStatuses['node-b']?.status).toBe('failed');
    expect(result.current.nodeStatuses['node-b']?.error).toBe('boom');
    expect(result.current.nodeStatuses['node-b']?.branch).toBe('false');
    expect(result.current.nodeStatuses['node-c']?.status).toBe('scheduled');
    expect(result.current.nodeStatuses['node-c']?.output).toBeNull();

    expect(result.current.validationIssues).toEqual(VALIDATION_ISSUES);
    expect(result.current.validationIssues).toHaveLength(2);
    expect(result.current.validationIssues[0]).toEqual({ nodeId: 'node-b', message: 'Missing mapping' });
    expect(result.current.validationIssues[1]).toEqual({ nodeId: 'node-c', message: 'Waiting dependency' });

    expect(result.current.executedEdgeIds).toBe(EDGE_IDS);
    expect(Array.from(result.current.executedEdgeIds)).toEqual(['edge-1', 'edge-2']);
    expect(result.current.executedEdgeIds.has('edge-1')).toBe(true);
    expect(result.current.executedEdgeIds.has('edge-2')).toBe(true);

    expect(result.current.lastRunMeta).toEqual(RUN_META);
    expect(result.current.lastRunMeta?.run_id).toBe('run-42');
    expect(result.current.lastRunMeta?.is_dry_run).toBe(false);
    expect(result.current.lastRunMeta?.at).toBe('2024-06-01T10:00:00.000Z');

    await waitFor(() => {
      expect(result.current.lastRunMeta?.run_id).toBe('run-42');
    });
  });

  it('clearStatuses resets statuses, executed edges and run meta but keeps validation issues', async () => {
    const wrapper = createWrapper(true);
    const { result } = renderHook(() => useWorkflowExecution(), { wrapper });

    await act(async () => {
      result.current.setNodeStatuses({
        'node-x': { status: 'simulated', output: { preview: true } },
        'node-y': { status: 'skipped', durationMs: null },
      });
      result.current.setValidationIssues([{ nodeId: 'node-x', message: 'Preview only' }]);
      result.current.setExecutedEdgeIds(new Set(['edge-x']));
      result.current.setLastRunMeta({
        run_id: 'run-clear',
        is_dry_run: true,
        at: '2024-02-01T09:30:00.000Z',
      });
    });

    expect(result.current.nodeStatuses['node-x']?.status).toBe('simulated');
    expect(result.current.nodeStatuses['node-x']?.output).toEqual({ preview: true });
    expect(result.current.nodeStatuses['node-y']?.status).toBe('skipped');
    expect(result.current.nodeStatuses['node-y']?.durationMs).toBeNull();
    expect(result.current.executedEdgeIds.has('edge-x')).toBe(true);
    expect(result.current.lastRunMeta?.is_dry_run).toBe(true);
    expect(result.current.validationIssues).toHaveLength(1);
    expect(result.current.validationIssues[0]).toEqual({ nodeId: 'node-x', message: 'Preview only' });

    await act(async () => {
      result.current.clearStatuses();
    });

    expect(result.current.nodeStatuses).toEqual({});
    expect(result.current.executedEdgeIds).toEqual(new Set());
    expect(result.current.executedEdgeIds.has('edge-x')).toBe(false);
    expect(result.current.lastRunMeta).toBeNull();
    expect(result.current.validationIssues).toHaveLength(1);
    expect(result.current.validationIssues[0]).toEqual({ nodeId: 'node-x', message: 'Preview only' });
  });
});