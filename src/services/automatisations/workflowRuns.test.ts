/* @vitest-environment jsdom */

import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { fetchWorkflowRuns } from './workflowRuns';

type WorkflowRunRow = {
  id: string;
  workflow_id: string;
  status: string;
  started_at: string;
};

const {
  ROWS,
  FAILED_ROWS,
  WF1_ROWS,
  EMPTY_ROWS,
  state,
  mockFrom,
  builder,
} = vi.hoisted(() => {
  const rows: WorkflowRunRow[] = [
    {
      id: 'run-1',
      workflow_id: 'wf-1',
      status: 'completed',
      started_at: '2024-01-03T10:00:00Z',
    },
    {
      id: 'run-2',
      workflow_id: 'wf-2',
      status: 'failed',
      started_at: '2024-01-02T10:00:00Z',
    },
  ];

  const failedRows: WorkflowRunRow[] = [
    {
      id: 'run-2',
      workflow_id: 'wf-2',
      status: 'failed',
      started_at: '2024-01-02T10:00:00Z',
    },
  ];

  const wf1Rows: WorkflowRunRow[] = [
    {
      id: 'run-1',
      workflow_id: 'wf-1',
      status: 'completed',
      started_at: '2024-01-03T10:00:00Z',
    },
  ];

  const currentState: {
    data: WorkflowRunRow[] | null;
    error: { message: string } | null;
  } = {
    data: rows,
    error: null,
  };

  const chainedBuilder = {
    select: vi.fn(() => chainedBuilder),
    eq: vi.fn(() => chainedBuilder),
    gte: vi.fn(() => chainedBuilder),
    lte: vi.fn(() => chainedBuilder),
    in: vi.fn(() => chainedBuilder),
    order: vi.fn(() => chainedBuilder),
    limit: vi.fn(() => chainedBuilder),
    insert: vi.fn(() => chainedBuilder),
    update: vi.fn(() => chainedBuilder),
    delete: vi.fn(() => chainedBuilder),
    single: vi.fn(async () => ({ data: currentState.data, error: currentState.error })),
    maybeSingle: vi.fn(async () => ({ data: currentState.data, error: currentState.error })),
    then: (
      onFulfilled: (value: {
        data: WorkflowRunRow[] | null;
        error: { message: string } | null;
      }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: currentState.data, error: currentState.error }).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: currentState.data, error: currentState.error }).catch(onRejected),
  };

  return {
    ROWS: rows,
    FAILED_ROWS: failedRows,
    WF1_ROWS: wf1Rows,
    EMPTY_ROWS: [] as WorkflowRunRow[],
    state: currentState,
    mockFrom: vi.fn(() => chainedBuilder),
    builder: chainedBuilder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('fetchWorkflowRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.data = ROWS;
    state.error = null;
    mockFrom.mockImplementation(() => builder);
    builder.select.mockImplementation(() => builder);
    builder.eq.mockImplementation(() => builder);
    builder.gte.mockImplementation(() => builder);
    builder.lte.mockImplementation(() => builder);
    builder.in.mockImplementation(() => builder);
    builder.order.mockImplementation(() => builder);
    builder.limit.mockImplementation(() => builder);
    builder.insert.mockImplementation(() => builder);
    builder.update.mockImplementation(() => builder);
    builder.delete.mockImplementation(() => builder);
  });

  it('charge puis retourne les exécutions avec tri descendant et limite par défaut', async () => {
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['workflow-runs-default'],
          queryFn: () => fetchWorkflowRuns<WorkflowRunRow>(),
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(ROWS);
    expect(result.current.data?.[0]).toEqual({
      id: 'run-1',
      workflow_id: 'wf-1',
      status: 'completed',
      started_at: '2024-01-03T10:00:00Z',
    });
    expect(result.current.data?.[1]?.status).toBe('failed');

    expect(mockFrom).toHaveBeenCalledWith('workflow_runs');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.order).toHaveBeenCalledWith('started_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(200);
    expect(builder.eq).not.toHaveBeenCalled();
  });

  it('applique les filtres status et workflowId avec la limite explicite', async () => {
    state.data = FAILED_ROWS;

    const result = await fetchWorkflowRuns<WorkflowRunRow>({
      status: 'failed',
      workflowId: 'wf-2',
      limit: 5,
    });

    expect(result).toEqual(FAILED_ROWS);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'run-2',
      workflow_id: 'wf-2',
      status: 'failed',
      started_at: '2024-01-02T10:00:00Z',
    });

    expect(mockFrom).toHaveBeenCalledWith('workflow_runs');
    expect(builder.limit).toHaveBeenCalledWith(5);
    expect(builder.eq).toHaveBeenCalledTimes(2);
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'status', 'failed');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'workflow_id', 'wf-2');
  });

  it('ignore les filtres à all et retourne un tableau vide quand data est nullish', async () => {
    state.data = null;

    const result = await fetchWorkflowRuns<WorkflowRunRow>({
      status: 'all',
      workflowId: 'all',
      limit: 10,
    });

    expect(result).toEqual(EMPTY_ROWS);
    expect(builder.limit).toHaveBeenCalledWith(10);
    expect(builder.eq).not.toHaveBeenCalled();
  });

  it('filtre uniquement par workflowId quand fourni', async () => {
    state.data = WF1_ROWS;

    const result = await fetchWorkflowRuns<WorkflowRunRow>({
      workflowId: 'wf-1',
    });

    expect(result).toEqual(WF1_ROWS);
    expect(result[0]?.workflow_id).toBe('wf-1');
    expect(result[0]?.status).toBe('completed');
    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('workflow_id', 'wf-1');
    expect(builder.limit).toHaveBeenCalledWith(200);
  });

  it('remonte une erreur via react-query quand Supabase échoue', async () => {
    state.data = null;
    state.error = { message: 'x' };

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['workflow-runs-error'],
          queryFn: () => fetchWorkflowRuns<WorkflowRunRow>(),
        }),
      {
        wrapper: createWrapper(),
      },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toMatchObject({ message: 'x' });
    expect(mockFrom).toHaveBeenCalledWith('workflow_runs');
    expect(builder.select).toHaveBeenCalledWith('*');
    expect(builder.order).toHaveBeenCalledWith('started_at', { ascending: false });
  });
});