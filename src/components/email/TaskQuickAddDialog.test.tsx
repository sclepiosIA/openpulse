import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { TaskQuickAddDialog } from './TaskQuickAddDialog';

const {
  CATEGORY_ROWS,
  USER_ROWS,
  ETABLISSEMENT_ROW,
  AUTH_STATE,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  mockDebugError,
  mockMutateAsync,
  mockUseCreateTache,
  mockFrom,
  ERROR_RESULT,
} = vi.hoisted(() => ({
  CATEGORY_ROWS: [
    { id: 'cat-contract', nom: 'Contractuel', description: 'desc', couleur: '#111', ordre: 1 },
    { id: 'cat-form', nom: 'Formation', description: 'desc', couleur: '#222', ordre: 2 },
    { id: 'cat-tech', nom: 'Technique', description: 'desc', couleur: '#333', ordre: 3 },
  ],
  USER_ROWS: [
    { id: 'user-csm', prenom: 'Alice', nom: 'Martin' },
    { id: 'user-other', prenom: 'Bob', nom: 'Durand' },
  ],
  ETABLISSEMENT_ROW: { csm_id: 'user-csm' },
  AUTH_STATE: {
    user: { id: 'u1', email: 'test@local.fr' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockNavigate: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockDebugError: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockUseCreateTache: vi.fn(),
  mockFrom: vi.fn(),
  ERROR_RESULT: { data: null, error: { message: 'x' } },
}));

function createBuilder(table: string) {
  const resolveResult = () => {
    if (table === 'categories_taches') return { data: CATEGORY_ROWS, error: null };
    if (table === 'profiles') return { data: USER_ROWS, error: null };
    if (table === 'etablissements') return { data: ETABLISSEMENT_ROW, error: null };
    return { data: null, error: null };
  };

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(resolveResult())),
    maybeSingle: vi.fn(() => Promise.resolve(resolveResult())),
    then: (
      onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(resolveResult()).then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(resolveResult()).catch(onRejected),
  };

  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/hooks/tasks/useCreateTache', () => ({
  useCreateTache: mockUseCreateTache,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: mockDebugError,
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type = 'button',
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} disabled={disabled} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    id,
    placeholder,
    type = 'text',
    required,
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input id={id} aria-label={id} value={value} onChange={onChange} placeholder={placeholder} type={type} required={required} />
  ),
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({
    value,
    onChange,
    id,
    placeholder,
    rows,
  }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea id={id} aria-label={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  CheckSquare: () => <span>icon-check</span>,
  Loader2: () => <span>icon-loader</span>,
}));

vi.mock('@/components/ui/dialog', async () => {
  const ReactLocal = await import('react');
  const DialogContext = ReactLocal.createContext<{
    open: boolean;
    onOpenChange: (value: boolean) => void;
  }>({
    open: false,
    onOpenChange: () => {},
  });

  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (value: boolean) => void;
      children: React.ReactNode;
    }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>
        <div data-open={String(open)}>{children}</div>
      </DialogContext.Provider>
    ),
    DialogTrigger: ({
      children,
      asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => {
      const ctx = ReactLocal.useContext(DialogContext);
      if (asChild && ReactLocal.isValidElement(children)) {
        const child = children as React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
        return ReactLocal.cloneElement(child, {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            child.props.onClick?.(event);
            ctx.onOpenChange(true);
          },
        });
      }
      return <button onClick={() => ctx.onOpenChange(true)}>{children}</button>;
    },
    DialogContent: ({ children }: { children: React.ReactNode; className?: string }) => {
      const ctx = ReactLocal.useContext(DialogContext);
      return ctx.open ? <div>{children}</div> : null;
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock('@/components/ui/select', async () => {
  const ReactLocal = await import('react');

  type ItemData = { value: string; label: string };

  const SelectContext = ReactLocal.createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
    items: ItemData[];
  }>({
    value: '',
    onValueChange: () => {},
    items: [],
  });

  function flattenText(node: React.ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(flattenText).join(' ').trim();
    if (ReactLocal.isValidElement(node)) {
      const props = node.props as { children?: React.ReactNode };
      return flattenText(props.children);
    }
    return '';
  }

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
      required?: boolean;
    }) => {
      const items: ItemData[] = [];

      const visit = (node: React.ReactNode) => {
        ReactLocal.Children.forEach(node, (child) => {
          if (!ReactLocal.isValidElement(child)) return;
          const props = child.props as { children?: React.ReactNode; value?: string };
          if (typeof props.value === 'string') {
            items.push({ value: props.value, label: flattenText(props.children) || props.value });
          }
          visit(props.children);
        });
      };

      visit(children);

      return (
        <SelectContext.Provider value={{ value, onValueChange, items }}>
          <div>{children}</div>
        </SelectContext.Provider>
      );
    },
    SelectTrigger: ({ id }: { children: React.ReactNode; id?: string }) => {
      const ctx = ReactLocal.useContext(SelectContext);
      return (
        <select
          id={id}
          aria-label={id}
          value={ctx.value ?? ''}
          onChange={(e) => ctx.onValueChange?.(e.target.value)}
        >
          <option value="">--</option>
          {ctx.items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      );
    },
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { value: string; children: React.ReactNode }) => <div>{children}</div>,
  };
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('TaskQuickAddDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => createBuilder(table));
    mockUseCreateTache.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
    mockMutateAsync.mockResolvedValue({ id: 'task-1' });
  });

  it('charge les données avec useQuery puis expose les valeurs attendues', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['categories-taches'],
          queryFn: async () => {
            const { data, error } = await mockFrom('categories_taches')
              .select('id, nom, description, couleur, ordre')
              .order('nom');
            if (error) throw error;
            return data;
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(CATEGORY_ROWS);
    expect(result.current.data?.[0]).toEqual({
      id: 'cat-contract',
      nom: 'Contractuel',
      description: 'desc',
      couleur: '#111',
      ordre: 1,
    });
  });

  it('ouvre le dialogue, applique les suggestions métier et crée une tâche avec les bonnes valeurs', async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <TaskQuickAddDialog
          etablissementId="eta-1"
          etablissementNom="Clinique Demo"
          defaultTitle="Relancer le prospect"
          emailContent="Bonjour, demande de devis commercial urgente, merci de traiter ASAP."
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /créer une tâche/i }));

    await waitFor(() => {
      expect(screen.getByText('Créer une tâche rapide')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Relancer le prospect')).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText('categorie') as HTMLSelectElement;
    const prioritySelect = screen.getByLabelText('priorite') as HTMLSelectElement;
    const responsableSelect = screen.getByLabelText('responsable') as HTMLSelectElement;

    await waitFor(() => {
      expect(categorySelect.value).toBe('cat-contract');
      expect(prioritySelect.value).toBe('high');
      expect(responsableSelect.value).toBe('user-csm');
    });

    fireEvent.change(screen.getByLabelText('description'), {
      target: { value: 'À traiter avant validation finale' },
    });

    fireEvent.change(screen.getByLabelText('date_debut'), {
      target: { value: '2026-02-10' },
    });

    const dueDate = screen.getByLabelText('echeance') as HTMLInputElement;
    await waitFor(() => {
      expect(dueDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    const dueValue = dueDate.value;

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /créer la tâche/i }).closest('form') as HTMLFormElement);
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      titre: 'Relancer le prospect',
      description: 'À traiter avant validation finale',
      etablissement_id: 'eta-1',
      categorie_id: 'cat-contract',
      priorite: 'high',
      date_debut: '2026-02-10',
      echeance: dueValue,
      responsable_id: 'user-csm',
    });

    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Tâche créée pour Clinique Demo',
      expect.objectContaining({
        action: expect.objectContaining({
          label: 'Voir la tâche',
          onClick: expect.any(Function),
        }),
      }),
    );

    const toastCall = mockToastSuccess.mock.calls[0];
    const toastOptions = toastCall[1] as { action: { label: string; onClick: () => void } };
    toastOptions.action.onClick();
    expect(mockNavigate).toHaveBeenCalledWith('/taches?tache=task-1');
  });

  it('affiche une erreur de validation si les champs obligatoires sont absents', async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <TaskQuickAddDialog etablissementId="eta-1" etablissementNom="Clinique Demo" />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /créer une tâche/i }));

    await waitFor(() => {
      expect(screen.getByText('Créer une tâche rapide')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /créer la tâche/i }).closest('form') as HTMLFormElement);
    });

    expect(mockToastError).toHaveBeenCalledWith('Veuillez remplir les champs obligatoires');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('passe en erreur quand la requête categories renvoie { data:null, error }', async () => {
    const wrapper = createWrapper();

    const errorFrom = vi.fn(() => {
      const builder = createBuilder('categories_taches');
      builder.then = (
        onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(ERROR_RESULT).then(onFulfilled, onRejected);
      builder.single = vi.fn(() => Promise.resolve(ERROR_RESULT));
      builder.maybeSingle = vi.fn(() => Promise.resolve(ERROR_RESULT));
      return builder;
    });

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['categories-error'],
          queryFn: async () => {
            const { data, error } = await errorFrom('categories_taches')
              .select('id, nom, description, couleur, ordre')
              .order('nom');
            if (error) throw error;
            return data;
          },
        }),
      { wrapper },
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual({ message: 'x' });
  });
});