/* @vitest-environment jsdom */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminSatisfactionCampagnes from './AdminSatisfactionCampagnes';

const {
  CAMPAIGNS_ROWS,
  COUNTS_ROWS,
  RESP_ETABS,
  ETABS_ROWS,
  SERVICE_ROWS,
  EMPTY_ROWS,
  CAMPAIGNS_RESPONSE,
  COUNTS_RESPONSE,
  RESP_ETABS_RESPONSE,
  ETABS_RESPONSE,
  SERVICE_RESPONSE,
  EMPTY_RESPONSE,
  MUTATION_RESPONSE,
  ERROR_RESPONSE,
  toastSuccess,
  toastError,
  navigateMock,
  mockFrom,
  defaultMockFrom,
  makeStaticBuilder,
  insertMock,
  updateMock,
  eqMock,
  orderMock,
  limitMock,
  notMock,
} = vi.hoisted(() => {
  type QueryError = { message: string };
  type QueryResponse = { data: unknown; error: QueryError | null };

  const CAMPAIGNS_ROWS = [
    {
      id: 'camp-alpha',
      title: 'Campagne Alpha',
      message: 'Message alpha',
      is_active: true,
      priority: 10,
      target_etablissement: 'Clinique A',
      target_dpi: 'hm',
      target_service: 'Urgences',
      starts_at: '2026-01-10T00:00:00.000Z',
      ends_at: '2026-02-10T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'camp-beta',
      title: 'Campagne Beta',
      message: null,
      is_active: false,
      priority: 2,
      target_etablissement: null,
      target_dpi: null,
      target_service: null,
      starts_at: null,
      ends_at: null,
      created_at: '2026-01-02T00:00:00.000Z',
    },
  ];

  const COUNTS_ROWS = [
    { campaign_id: 'camp-alpha' },
    { campaign_id: 'camp-alpha' },
    { campaign_id: 'camp-beta' },
    { campaign_id: null },
  ];

  const RESP_ETABS = [{ etablissement: 'Clinique A' }, { etablissement: 'Hôpital B' }];
  const ETABS_ROWS = [{ nom: 'Clinique A' }, { nom: 'Centre C' }];
  const SERVICE_ROWS = [{ service: 'Urgences' }, { service: 'Cardiologie' }, { service: 'Urgences' }];
  const EMPTY_ROWS: unknown[] = [];

  const CAMPAIGNS_RESPONSE: QueryResponse = { data: CAMPAIGNS_ROWS, error: null };
  const COUNTS_RESPONSE: QueryResponse = { data: COUNTS_ROWS, error: null };
  const RESP_ETABS_RESPONSE: QueryResponse = { data: RESP_ETABS, error: null };
  const ETABS_RESPONSE: QueryResponse = { data: ETABS_ROWS, error: null };
  const SERVICE_RESPONSE: QueryResponse = { data: SERVICE_ROWS, error: null };
  const EMPTY_RESPONSE: QueryResponse = { data: EMPTY_ROWS, error: null };
  const MUTATION_RESPONSE: QueryResponse = { data: null, error: null };
  const ERROR_RESPONSE: QueryResponse = { data: null, error: { message: 'x' } };

  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const navigateMock = vi.fn();

  const insertMock = vi.fn();
  const updateMock = vi.fn();
  const eqMock = vi.fn();
  const orderMock = vi.fn();
  const limitMock = vi.fn();
  const notMock = vi.fn();

  const makeBuilder = (table: string, staticResponse?: QueryResponse): Record<string, unknown> => {
    let response = staticResponse ?? EMPTY_RESPONSE;
    const builder: Record<string, unknown> = {};

    builder.select = vi.fn((columns?: string) => {
      if (staticResponse === undefined) {
        if (table === 'satisfaction_v3_campaigns' && columns === '*') {
          response = CAMPAIGNS_RESPONSE;
        } else if (table === 'satisfaction_v3_responses' && columns === 'campaign_id') {
          response = COUNTS_RESPONSE;
        } else if (table === 'satisfaction_v3_responses' && columns === 'etablissement') {
          response = RESP_ETABS_RESPONSE;
        } else if (table === 'satisfaction_v3_responses' && columns === 'service') {
          response = SERVICE_RESPONSE;
        } else if (table === 'etablissements' && columns === 'nom') {
          response = ETABS_RESPONSE;
        } else {
          response = EMPTY_RESPONSE;
        }
      }
      return builder;
    });

    builder.eq = eqMock.mockImplementation(() => builder);
    builder.gte = vi.fn(() => builder);
    builder.lte = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = orderMock.mockImplementation(() => builder);
    builder.limit = limitMock.mockImplementation(() => builder);
    builder.not = notMock.mockImplementation(() => builder);
    builder.insert = insertMock.mockImplementation(() => Promise.resolve(MUTATION_RESPONSE));
    builder.update = updateMock.mockImplementation(() => {
      response = MUTATION_RESPONSE;
      return builder;
    });
    builder.delete = vi.fn(() => builder);
    builder.single = vi.fn(() => Promise.resolve(MUTATION_RESPONSE));
    builder.maybeSingle = vi.fn(() => Promise.resolve(MUTATION_RESPONSE));
    builder.then = (
      onFulfilled?: ((value: QueryResponse) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(response).then(onFulfilled ?? undefined, onRejected ?? undefined);
    builder.catch = (onRejected?: ((reason: unknown) => unknown) | null) =>
      Promise.resolve(response).catch(onRejected ?? undefined);

    return builder;
  };

  const defaultMockFrom = (table: string) => makeBuilder(table);
  const makeStaticBuilder = (response: QueryResponse) => makeBuilder('static', response);
  const mockFrom = vi.fn(defaultMockFrom);

  return {
    CAMPAIGNS_ROWS,
    COUNTS_ROWS,
    RESP_ETABS,
    ETABS_ROWS,
    SERVICE_ROWS,
    EMPTY_ROWS,
    CAMPAIGNS_RESPONSE,
    COUNTS_RESPONSE,
    RESP_ETABS_RESPONSE,
    ETABS_RESPONSE,
    SERVICE_RESPONSE,
    EMPTY_RESPONSE,
    MUTATION_RESPONSE,
    ERROR_RESPONSE,
    toastSuccess,
    toastError,
    navigateMock,
    mockFrom,
    defaultMockFrom,
    makeStaticBuilder,
    insertMock,
    updateMock,
    eqMock,
    orderMock,
    limitMock,
    notMock,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => navigateMock,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    onClick,
    disabled,
    title,
    type,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    disabled?: boolean;
    title?: string;
    type?: 'button' | 'submit' | 'reset';
  }) => {
    if (asChild && React.isValidElement(children)) {
      return children;
    }
    return (
      <button type={type ?? 'button'} onClick={onClick} disabled={disabled} title={title}>
        {children}
      </button>
    );
  },
  buttonVariants: () => '',
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    disabled,
    placeholder,
    type,
  }: {
    value?: string | number;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    disabled?: boolean;
    placeholder?: string;
    type?: string;
  }) => <input value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} type={type} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    rows,
  }: {
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    rows?: number;
  }) => <textarea value={value} onChange={onChange} rows={rows} />,
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button type="button" aria-pressed={checked} onClick={() => onCheckedChange?.(!checked)}>
      switch
    </button>
  ),
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({
    children,
    colSpan,
    className,
  }: {
    children: React.ReactNode;
    colSpan?: number;
    className?: string;
  }) => (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  ),
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode; variant?: string }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/dialog', () => {
  const DialogContext = React.createContext(false);

  return {
    Dialog: ({ open, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children: React.ReactNode }) => (
      <DialogContext.Provider value={Boolean(open)}>
        <div data-open={open ? 'true' : 'false'}>{children}</div>
      </DialogContext.Provider>
    ),
    DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => {
      const open = React.useContext(DialogContext);
      return open ? <div role="dialog">{children}</div> : null;
    },
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode; value?: string; onValueChange?: (value: string) => void }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode; className?: string }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span aria-hidden="true">arrow</span>,
  Plus: () => <span aria-hidden="true">plus</span>,
  Archive: () => <span aria-hidden="true">archive</span>,
  Play: () => <span aria-hidden="true">play</span>,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    ...render(ui, { wrapper: Wrapper }),
    queryClient,
    invalidateSpy,
  };
}

function rowContaining(text: string): HTMLElement {
  const cell = screen.getByText(text);
  const row = cell.closest('tr');
  if (row === null) {
    throw new Error(`Ligne introuvable pour ${text}`);
  }
  return row as HTMLElement;
}

function findElement(elements: HTMLElement[], predicate: (element: HTMLElement) => boolean): HTMLElement {
  const element = elements.find(predicate);
  if (element === undefined) {
    throw new Error('Élément introuvable');
  }
  return element;
}

describe('AdminSatisfactionCampagnes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation(defaultMockFrom);
  });

  it('affiche le chargement puis les campagnes avec leurs valeurs métier et compteurs', async () => {
    renderWithClient(<AdminSatisfactionCampagnes />);

    expect(screen.getByText('Chargement…')).toBeTruthy();

    expect(await screen.findByText('Campagnes de satisfaction')).toBeTruthy();
    expect(await screen.findByText('Toutes les campagnes (2)')).toBeTruthy();

    const alphaRow = rowContaining('camp-alpha');
    expect(within(alphaRow).getByText('Campagne Alpha')).toBeTruthy();
    expect(within(alphaRow).getByText('Active')).toBeTruthy();
    expect(within(alphaRow).getByText('10')).toBeTruthy();
    expect(within(alphaRow).getByText('DPI: hm · Étab: Clinique A · Service: Urgences')).toBeTruthy();
    expect(within(alphaRow).getByText('2')).toBeTruthy();

    const betaRow = rowContaining('camp-beta');
    expect(within(betaRow).getByText('Campagne Beta')).toBeTruthy();
    expect(within(betaRow).getByText('Archivée')).toBeTruthy();
    expect(within(betaRow).getByText('Tous')).toBeTruthy();
    expect(within(betaRow).getByText('1')).toBeTruthy();

    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_campaigns');
    expect(mockFrom).toHaveBeenCalledWith('satisfaction_v3_responses');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
    expect(orderMock).toHaveBeenCalledWith('priority', { ascending: false });
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(10000);
    expect(limitMock).toHaveBeenCalledWith(5000);
    expect(notMock).toHaveBeenCalledWith('service', 'is', null);
  });

  it('ouvre le formulaire de création et crée une campagne', async () => {
    const { invalidateSpy } = renderWithClient(<AdminSatisfactionCampagnes />);

    await screen.findByText('Toutes les campagnes (2)');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Nouvelle campagne' }));
    });

    expect(screen.getByRole('heading', { name: 'Nouvelle campagne' })).toBeTruthy();

    const slugInput = screen.getByPlaceholderText('ex: nps-hm-2026-q3');
    const textboxes = screen.getAllByRole('textbox');
    const titleInput = findElement(textboxes, (element) => element !== slugInput && element.tagName.toLowerCase() === 'input');
    const messageInput = findElement(textboxes, (element) => element.tagName.toLowerCase() === 'textarea');

    await act(async () => {
      fireEvent.change(slugInput, { target: { value: 'nps-q3' } });
      fireEvent.change(titleInput, { target: { value: 'NPS T3' } });
      fireEvent.change(messageInput, { target: { value: 'Merci pour votre retour' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
    });

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith({
        id: 'nps-q3',
        title: 'NPS T3',
        message: 'Merci pour votre retour',
        is_active: true,
        priority: 0,
        target_etablissement: null,
        target_dpi: null,
        target_service: null,
        starts_at: null,
        ends_at: null,
      });
    });

    expect(toastSuccess).toHaveBeenCalledWith('Campagne créée.');
    expect(toastError).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['satisfaction-v3-campaigns'] });
  });

  it('archive une campagne active via la mutation dédiée', async () => {
    const { invalidateSpy } = renderWithClient(<AdminSatisfactionCampagnes />);

    await screen.findByText('Campagne Alpha');

    await act(async () => {
      fireEvent.click(screen.getByTitle('Archiver (is_active=false)'));
    });

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith({ is_active: false });
      expect(eqMock).toHaveBeenCalledWith('id', 'camp-alpha');
    });

    expect(toastError).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['satisfaction-v3-campaigns'] });
  });

  it('passe la requête campagnes en erreur quand Supabase renvoie une erreur', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'satisfaction_v3_campaigns') {
        return makeStaticBuilder(ERROR_RESPONSE);
      }
      return defaultMockFrom(table);
    });

    const { queryClient } = renderWithClient(<AdminSatisfactionCampagnes />);

    await waitFor(() => {
      expect(screen.getByText('Aucune campagne.')).toBeTruthy();
      const state = queryClient.getQueryState(['satisfaction-v3-campaigns']);
      expect(state?.status).toBe('error');
      expect(state?.error).toEqual({ message: 'x' });
    });

    expect(screen.queryByText('Campagne Alpha')).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });
});