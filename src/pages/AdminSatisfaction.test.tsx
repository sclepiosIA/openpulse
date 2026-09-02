import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';

const { mockFrom, supabaseMockState, RESPONSES_RESULT } = vi.hoisted(() => {
  type QueryResult = {
    data: readonly Record<string, unknown>[] | null;
    error: { message: string } | null;
    count?: number | null;
  };

  type CallRecord = {
    method: string;
    args: readonly unknown[];
  };

  type BuilderRecord = {
    table: string;
    selected: string;
    selectOptions: Record<string, unknown> | undefined;
    calls: CallRecord[];
    select: (columns?: string, options?: Record<string, unknown>) => BuilderRecord;
    eq: (column: string, value: unknown) => BuilderRecord;
    gte: (column: string, value: unknown) => BuilderRecord;
    lte: (column: string, value: unknown) => BuilderRecord;
    ilike: (column: string, value: unknown) => BuilderRecord;
    not: (column: string, operator: string, value: unknown) => BuilderRecord;
    in: (column: string, values: readonly unknown[]) => BuilderRecord;
    order: (column: string, options?: Record<string, unknown>) => BuilderRecord;
    limit: (count: number) => BuilderRecord;
    range: (from: number, to: number) => BuilderRecord;
    insert: (values: unknown) => BuilderRecord;
    update: (values: unknown) => BuilderRecord;
    delete: () => BuilderRecord;
    single: () => Promise<QueryResult>;
    maybeSingle: () => Promise<QueryResult>;
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ) => Promise<QueryResult | TResult>;
  };

  const CAMPAIGNS = [
    { id: 'camp-1', title: 'Campagne active' },
    { id: 'camp-2', title: 'Campagne archive' },
  ] as const;

  const RESPONSE_ROWS = [
    {
      id: 'resp-1',
      campaign_id: 'camp-1',
      source: 'v3-dpi',
      dpi: 'hm',
      etablissement: 'Hôpital Nord',
      service: 'Urgences',
      role: 'Médecin',
      satisfaction: 5,
      recommendation: 10,
      comment: 'Très utile au quotidien',
      created_at: '2024-04-12T09:30:00.000Z',
    },
    {
      id: 'resp-2',
      campaign_id: 'camp-1',
      source: 'public-form',
      dpi: 'mediboard',
      etablissement: 'Clinique Sud',
      service: 'Cardiologie',
      role: 'Cadre',
      satisfaction: 4,
      recommendation: 9,
      comment: 'Interface claire',
      created_at: '2024-04-11T08:15:00.000Z',
    },
  ] as const;

  const STATS_ROWS = [
    {
      source: 'v3-dpi',
      satisfaction: 5,
      recommendation: 10,
      created_at: '2024-03-01T10:00:00.000Z',
    },
    {
      source: 'v3-dpi',
      satisfaction: 4,
      recommendation: 9,
      created_at: '2024-03-15T10:00:00.000Z',
    },
    {
      source: 'public-form',
      satisfaction: 3,
      recommendation: 5,
      created_at: '2024-04-01T10:00:00.000Z',
    },
    {
      source: null,
      satisfaction: null,
      recommendation: null,
      created_at: '2024-04-15T10:00:00.000Z',
    },
  ] as const;

  const EXPORT_ROWS = [
    {
      id: 'resp-1',
      campaign_id: 'camp-1',
      source: 'v3-dpi',
      dpi: 'hm',
      etablissement: 'Hôpital Nord',
      service: 'Urgences',
      role: 'Médecin',
      satisfaction: 5,
      recommendation: 10,
      comment: 'Très utile au quotidien',
      created_at: '2024-04-12T09:30:00.000Z',
    },
  ] as const;

  const CAMPAIGNS_RESULT: QueryResult = { data: CAMPAIGNS, error: null };
  const RESPONSES_RESULT_STABLE: QueryResult = { data: RESPONSE_ROWS, error: null, count: 2 };
  const STATS_RESULT: QueryResult = { data: STATS_ROWS, error: null };
  const EXPORT_RESULT: QueryResult = { data: EXPORT_ROWS, error: null };
  const ERROR_RESULT: QueryResult = { data: null, error: { message: 'x' }, count: null };

  const createDeferred = () => {
    let resolveDeferred: (value: QueryResult) => void = () => undefined;
    const promise = new Promise<QueryResult>((resolve) => {
      resolveDeferred = resolve;
    });
    return { promise, resolve: resolveDeferred };
  };

  const state: {
    mode: 'success' | 'error' | 'loadingResponses';
    pendingResponses: ReturnType<typeof createDeferred>;
    builders: BuilderRecord[];
    reset: () => void;
  } = {
    mode: 'success',
    pendingResponses: createDeferred(),
    builders: [],
    reset: () => {
      state.mode = 'success';
      state.pendingResponses = createDeferred();
      state.builders = [];
      mockFrom.mockClear();
    },
  };

  const resolveQuery = (builder: BuilderRecord): QueryResult | Promise<QueryResult> => {
    if (builder.table === 'satisfaction_v3_campaigns') {
      return CAMPAIGNS_RESULT;
    }

    if (builder.table === 'satisfaction_v3_responses' && state.mode === 'error') {
      return ERROR_RESULT;
    }

    if (
      builder.table === 'satisfaction_v3_responses' &&
      builder.selectOptions?.count === 'exact' &&
      state.mode === 'loadingResponses'
    ) {
      return state.pendingResponses.promise;
    }

    if (builder.table === 'satisfaction_v3_responses' && builder.selectOptions?.count === 'exact') {
      return RESPONSES_RESULT_STABLE;
    }

    if (
      builder.table === 'satisfaction_v3_responses' &&
      builder.selected === 'source, satisfaction, recommendation, created_at'
    ) {
      return STATS_RESULT;
    }

    if (
      builder.table === 'satisfaction_v3_responses' &&
      builder.selected ===
        'created_at, source, campaign_id, etablissement, dpi, service, role, satisfaction, recommendation, comment'
    ) {
      return EXPORT_RESULT;
    }

    return { data: [], error: null, count: 0 };
  };

  const createBuilder = (table: string): BuilderRecord => {
    const builder: BuilderRecord = {
      table,
      selected: '',
      selectOptions: undefined,
      calls: [],
      select: vi.fn((columns?: string, options?: Record<string, unknown>) => {
        builder.selected = columns ?? '';
        builder.selectOptions = options;
        builder.calls.push({ method: 'select', args: [columns ?? '', options] });
        return builder;
      }),
      eq: vi.fn((column: string, value: unknown) => {
        builder.calls.push({ method: 'eq', args: [column, value] });
        return builder;
      }),
      gte: vi.fn((column: string, value: unknown) => {
        builder.calls.push({ method: 'gte', args: [column, value] });
        return builder;
      }),
      lte: vi.fn((column: string, value: unknown) => {
        builder.calls.push({ method: 'lte', args: [column, value] });
        return builder;
      }),
      ilike: vi.fn((column: string, value: unknown) => {
        builder.calls.push({ method: 'ilike', args: [column, value] });
        return builder;
      }),
      not: vi.fn((column: string, operator: string, value: unknown) => {
        builder.calls.push({ method: 'not', args: [column, operator, value] });
        return builder;
      }),
      in: vi.fn((column: string, values: readonly unknown[]) => {
        builder.calls.push({ method: 'in', args: [column, values] });
        return builder;
      }),
      order: vi.fn((column: string, options?: Record<string, unknown>) => {
        builder.calls.push({ method: 'order', args: [column, options] });
        return builder;
      }),
      limit: vi.fn((count: number) => {
        builder.calls.push({ method: 'limit', args: [count] });
        return builder;
      }),
      range: vi.fn((from: number, to: number) => {
        builder.calls.push({ method: 'range', args: [from, to] });
        return builder;
      }),
      insert: vi.fn((values: unknown) => {
        builder.calls.push({ method: 'insert', args: [values] });
        return builder;
      }),
      update: vi.fn((values: unknown) => {
        builder.calls.push({ method: 'update', args: [values] });
        return builder;
      }),
      delete: vi.fn(() => {
        builder.calls.push({ method: 'delete', args: [] });
        return builder;
      }),
      single: vi.fn(() => Promise.resolve(resolveQuery(builder))),
      maybeSingle: vi.fn(() => Promise.resolve(resolveQuery(builder))),
      then: (onfulfilled, onrejected) => Promise.resolve(resolveQuery(builder)).then(onfulfilled, onrejected),
      catch: (onrejected) => Promise.resolve(resolveQuery(builder)).catch(onrejected),
    };

    state.builders.push(builder);
    return builder;
  };

  const mockFrom = vi.fn((table: string) => createBuilder(table));

  return {
    mockFrom,
    supabaseMockState: state,
    RESPONSES_RESULT: RESPONSES_RESULT_STABLE,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  CardContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => {
  type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    variant?: string;
    size?: string;
    children?: ReactNode;
  };

  return {
    Button: ({ asChild, variant, size, children, ...props }: MockButtonProps) => {
      if (asChild) {
        return <span>{children}</span>;
      }

      return <button {...props}>{children}</button>;
    },
    buttonVariants: () => '',
  };
});

vi.mock('@/components/ui/input', () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock('@/components/ui/select', () => {
  type SelectProps = {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: ReactNode;
  };

  type SelectItemProps = HTMLAttributes<HTMLDivElement> & {
    value: string;
    children?: ReactNode;
  };

  return {
    Select: ({ children }: SelectProps) => <div>{children}</div>,
    SelectContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    SelectItem: ({ children, value, ...props }: SelectItemProps) => (
      <div {...props} data-value={value}>
        {children}
      </div>
    ),
    SelectTrigger: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    SelectValue: () => null,
  };
});

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: TableHTMLAttributes<HTMLTableElement>) => <table {...props}>{children}</table>,
  TableHeader: ({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => <thead {...props}>{children}</thead>,
  TableBody: ({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props}>{children}</tbody>,
  TableRow: ({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) => <tr {...props}>{children}</tr>,
  TableHead: ({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) => <th {...props}>{children}</th>,
  TableCell: ({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => <td {...props}>{children}</td>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('lucide-react', () => ({
  Download: () => <span aria-hidden="true" data-testid="download-icon" />,
  Settings2: () => <span aria-hidden="true" data-testid="settings-icon" />,
}));

import AdminSatisfaction from './AdminSatisfaction';

function renderAdminSatisfaction() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminSatisfaction />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  supabaseMockState.reset();
});

describe('AdminSatisfaction', () => {
  it('affiche l’état de chargement du tableau puis les réponses', async () => {
    supabaseMockState.mode = 'loadingResponses';

    renderAdminSatisfaction();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.getByText('Satisfaction OpenPulse V3')).toBeInTheDocument();

    await act(async () => {
      supabaseMockState.pendingResponses.resolve(RESPONSES_RESULT);
      await Promise.resolve();
    });

    expect(await screen.findByText('Très utile au quotidien')).toBeInTheDocument();
    expect(screen.queryByText('Chargement…')).not.toBeInTheDocument();
  });

  it('rend les statistiques métier, les campagnes et les lignes de réponses', async () => {
    renderAdminSatisfaction();

    expect(await screen.findByText('DPI: 2 · Public: 1')).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText('3 note(s)')).toBeInTheDocument();
    expect(screen.getByText('33')).toBeInTheDocument();
    expect(screen.getByText('3 recommandation(s)')).toBeInTheDocument();
    expect(screen.getByText('Réponses (2)')).toBeInTheDocument();

    expect(screen.getByText('Campagne active')).toBeInTheDocument();
    expect(screen.getByText('Hôpital Nord')).toBeInTheDocument();
    expect(screen.getByText('Clinique Sud')).toBeInTheDocument();
    expect(screen.getByText('Urgences')).toBeInTheDocument();
    expect(screen.getByText('public-form')).toBeInTheDocument();
    expect(screen.getByText('Très utile au quotidien')).toBeInTheDocument();

    expect(screen.getByText('Page 1 / 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();

    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_campaigns');
    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_responses');
  });

  it('reste utilisable et affiche un état vide quand Supabase renvoie une erreur', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    supabaseMockState.mode = 'error';

    renderAdminSatisfaction();

    expect(await screen.findByText('Aucune réponse.')).toBeInTheDocument();
    expect(screen.getByText('Réponses (0)')).toBeInTheDocument();
    expect(screen.getByText('0 note(s)')).toBeInTheDocument();
    expect(screen.getByText('0 recommandation(s)')).toBeInTheDocument();
    expect(screen.getByText('Satisfaction OpenPulse V3')).toBeInTheDocument();
  });

  it('exporte les réponses en CSV avec la requête Supabase attendue', async () => {
    const createObjectURLMock = vi.fn((_blob: Blob) => 'blob:satisfaction-csv');
    const revokeObjectURLMock = vi.fn((_url: string) => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURLMock,
    });

    renderAdminSatisfaction();

    await screen.findByText('Très utile au quotidien');

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:satisfaction-csv');

    const exportBuilder = supabaseMockState.builders.find(
      (builder) =>
        builder.selected ===
        'created_at, source, campaign_id, etablissement, dpi, service, role, satisfaction, recommendation, comment',
    );

    if (!exportBuilder) {
      throw new Error('Export query builder not found');
    }

    expect(exportBuilder.calls).toContainEqual({
      method: 'select',
      args: [
        'created_at, source, campaign_id, etablissement, dpi, service, role, satisfaction, recommendation, comment',
        undefined,
      ],
    });
    expect(exportBuilder.calls).toContainEqual({
      method: 'order',
      args: ['created_at', { ascending: false }],
    });
    expect(exportBuilder.calls).toContainEqual({
      method: 'limit',
      args: [10000],
    });
  });
});