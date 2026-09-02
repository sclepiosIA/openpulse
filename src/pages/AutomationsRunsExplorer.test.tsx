import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import AutomationsRunsExplorer from './AutomationsRunsExplorer';

const { ROWS, WORKFLOWS, mockFrom, setNextPromise, replayMutMock, useWorkflowsMock } = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'r1',
      workflow_id: 'w1',
      status: 'success',
      started_at: new Date('2024-01-02T03:04:05.000Z').toISOString(),
      duration_ms: 123,
      steps_log: [
        { status: 'success', node_type: 'http', node_id: 'n1', output: { ok: true } },
      ],
      trigger_payload: { foo: 'bar' },
      error: null,
    },
  ];
  const WORKFLOWS = [{ id: 'w1', nom: 'Workflow One' }];

  let currentPromise: Promise<any> = Promise.resolve({ data: ROWS, error: null });
  const setNextPromise = (p: Promise<any>) => {
    currentPromise = p;
  };

  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then(onFulfilled: any, onRejected: any) {
      return currentPromise.then(onFulfilled, onRejected);
    },
    catch(onRejected: any) {
      return currentPromise.catch(onRejected);
    },
  };

  const mockFrom = vi.fn(() => builder);

  const replayMutMock = vi.fn();

  const useWorkflowsMock = vi.fn(() => ({ data: WORKFLOWS }));

  return { ROWS, WORKFLOWS, mockFrom, setNextPromise, replayMutMock, useWorkflowsMock };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mockFrom } }));

vi.mock('@/hooks/workflows/useWorkflows', () => ({ useWorkflows: () => ({ data: WORKFLOWS }) }));

vi.mock('@/hooks/workflows/useWorkflowReplay', () => ({ useWorkflowReplay: () => ({ mutate: replayMutMock, isPending: false }) }));

vi.mock('@/hooks/shared/usePageTitle', () => ({ usePageTitle: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// Mock UI and internal components used by the component under test
vi.mock('@/components/ui/button', () => ({ Button: (props: any) => <button {...props}>{props.children}</button> }));
vi.mock('@/components/ui/card', () => ({
  Card: (p: any) => <div {...p}>{p.children}</div>,
  CardContent: (p: any) => <div {...p}>{p.children}</div>,
  CardHeader: (p: any) => <div {...p}>{p.children}</div>,
  CardTitle: (p: any) => <div {...p}>{p.children}</div>,
}));
vi.mock('@/components/ui/input', () => ({ Input: (p: any) => <input {...p} /> }));
vi.mock('@/components/ui/select', () => ({
  Select: (p: any) => <div data-testid="select-root" {...p}>{p.children}</div>,
  SelectContent: (p: any) => <div {...p}>{p.children}</div>,
  SelectItem: (p: any) => <div role="option" data-value={p.value} {...p}>{p.children}</div>,
  SelectTrigger: (p: any) => <div {...p}>{p.children}</div>,
  SelectValue: (p: any) => <div {...p}>{p.children}</div>,
}));
vi.mock('@/components/ui/badge', () => ({ Badge: (p: any) => <span {...p}>{p.children}</span> }));
vi.mock('@/components/ui/table', () => ({
  Table: (p: any) => <table {...p}>{p.children}</table>,
  TableBody: (p: any) => <tbody {...p}>{p.children}</tbody>,
  TableCell: (p: any) => <td {...p}>{p.children}</td>,
  TableHead: (p: any) => <th {...p}>{p.children}</th>,
  TableHeader: (p: any) => <thead {...p}>{p.children}</thead>,
  TableRow: (p: any) => <tr {...p}>{p.children}</tr>,
}));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: (p: any) => <div data-testid="sheet" {...p}>{p.children}</div>,
  SheetContent: (p: any) => <div {...p}>{p.children}</div>,
  SheetHeader: (p: any) => <div {...p}>{p.children}</div>,
  SheetTitle: (p: any) => <div {...p}>{p.children}</div>,
}));
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: (p: any) => <div {...p}>{p.children}</div> }));
vi.mock('@/components/layout/ImmersivePageBackground', () => ({ ImmersivePageBackground: (p: any) => <div {...p}>{p.children}</div> }));
vi.mock('@/components/common/PageDataState', () => ({
  PageDataState: (props: any) => {
    const { isLoading, isError, isEmpty, emptyTitle, emptyDescription, onRetry, children } = props;
    if (isLoading) return <div data-testid="pds-loading">loading</div>;
    if (isError) return <div data-testid="pds-error">error</div>;
    if (isEmpty) {
      return (
        <div data-testid="pds-empty">
          <div>{emptyTitle}</div>
          <div>{emptyDescription}</div>
          <button data-testid="pds-retry" onClick={onRetry}>Retry</button>
        </div>
      );
    }
    return <div data-testid="pds-children">{children}</div>;
  },
}));
vi.mock('@/components/layout/ImmersivePageHeader', () => ({
  ImmersivePageHeader: ({ title, stats, actions }: any) => (
    <div>
      <h1>{title}</h1>
      <div data-testid="header-stats">{(stats || []).map((s: any) => `${s.label}:${s.value}`).join('|')}</div>
      <div data-testid="header-actions">{actions}</div>
    </div>
  ),
}));

// Ensure useWorkflows module (fallback) is stable if imported elsewhere
vi.mock('@/hooks/workflows/useWorkflows', () => ({ useWorkflows: () => ({ data: WORKFLOWS }) }));

function createDeferred<T = any>() {
  let resolve!: (v: T) => void;
  let reject!: (e?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AutomationsRunsExplorer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // default resolved result
    setNextPromise(Promise.resolve({ data: ROWS, error: null }));
  });

  it('shows loading state then displays runs and allows replay and opening details', async () => {
    const deferred = createDeferred();
    setNextPromise(deferred.promise);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AutomationsRunsExplorer />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // while the supabase promise is pending, PageDataState should show loading
    expect(screen.getByTestId('pds-loading')).toBeInTheDocument();

    // resolve the pending fetch
    await act(async () => {
      deferred.resolve({ data: ROWS, error: null });
      // give react-query a tick to process
      await Promise.resolve();
    });

    // wait for the workflow name to appear (from table cell)
    await waitFor(() => {
      expect(screen.getByText('Workflow One')).toBeInTheDocument();
    });

    // header stats should include runs affichés:1
    expect(screen.getByTestId('header-stats').textContent).toContain('runs affichés:1');

    // find the table and the row for our run (skip header row)
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // first row is header, second is our data row
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const dataRow = rows[1];

    // within the data row, there should be three action buttons (eye, replay, open workflow)
    const buttons = within(dataRow).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);

    // The second button in actions is the replay button (has title "Rejouer")
    const replayButton = Array.from(dataRow.querySelectorAll('button')).find((b) => b.getAttribute('title') === 'Rejouer');
    expect(replayButton).toBeTruthy();

    // click replay and assert mutate called with run id
    await act(async () => {
      fireEvent.click(replayButton as Element);
    });
    expect(replayMutMock).toHaveBeenCalledWith('r1');

    // click the first action button (eye) to open details
    const eyeButton = buttons[0];
    await act(async () => {
      fireEvent.click(eyeButton);
    });

    // after opening, the sheet mock should render children including the trigger_payload JSON
    await waitFor(() => {
      expect(screen.getByText(/"foo":\s*"bar"/)).toBeInTheDocument();
    });
  });

  it('shows error state when supabase returns an error', async () => {
    setNextPromise(Promise.resolve({ data: null, error: { message: 'db-failure' } }));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AutomationsRunsExplorer />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('pds-error')).toBeInTheDocument();
    });
  });

  it('shows empty state when there are no runs after filters', async () => {
    // return empty data
    setNextPromise(Promise.resolve({ data: [], error: null }));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <AutomationsRunsExplorer />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // PageDataState should render the empty view
    await waitFor(() => {
      expect(screen.getByTestId('pds-empty')).toBeInTheDocument();
      expect(screen.getByText('Aucun run')).toBeInTheDocument();
      expect(screen.getByText('Aucun run pour ces filtres.')).toBeInTheDocument();
      // retry button triggers refetch; ensure it exists
      expect(screen.getByTestId('pds-retry')).toBeInTheDocument();
    });
  });
});