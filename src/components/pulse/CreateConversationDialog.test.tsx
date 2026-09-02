import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { CreateConversationDialog } from './CreateConversationDialog';

const { ETABS, mockFrom, mockMutateAsync, createState } = vi.hoisted(() => {
  const ETABS = [
    { id: 'e1', nom: 'Lycée Victor Hugo' },
    { id: 'e2', nom: 'Collège Pasteur' },
  ];
  const mockFrom = vi.fn();
  const mockMutateAsync = vi.fn();
  const createState = {
    mutateAsync: mockMutateAsync,
    isPending: false,
  };
  return { ETABS, mockFrom, mockMutateAsync, createState };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mockFrom },
}));

vi.mock('@/lib/debug', () => ({
  debug: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  useCreatePulseConversation: () => createState,
}));

vi.mock('lucide-react', () => ({
  Building2: () => null,
  Globe: () => null,
  Lock: () => null,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

type FieldRenderProps = {
  field: { value: string; onChange: () => void; name: string };
};

vi.mock('@/components/ui/form', () => ({
  Form: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FormControl: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FormDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  FormField: ({
    name,
    render,
  }: {
    name: string;
    render: (props: FieldRenderProps) => ReactNode;
  }) => (
    <div data-testid={`field-${name}`}>
      {render({ field: { value: '', onChange: () => undefined, name } })}
    </div>
  ),
  FormItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FormLabel: ({ children }: { children?: ReactNode }) => <label>{children}</label>,
  FormMessage: () => null,
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: { placeholder?: string }) => <input placeholder={props.placeholder} readOnly />,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: { placeholder?: string }) => (
    <textarea placeholder={props.placeholder} readOnly />
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }) => (
    <button onClick={onClick} disabled={disabled} type={type ?? 'button'}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children?: ReactNode; value: string }) => (
    <div data-testid={`select-item-${value}`}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children }: { children?: ReactNode }) => <div role="radiogroup">{children}</div>,
  RadioGroupItem: ({ value, id }: { value: string; id?: string }) => (
    <input type="radio" value={value} id={id} readOnly />
  ),
}));

type SupabaseResult = { data: unknown; error: { message: string } | null };

interface ChainableBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled?: (value: SupabaseResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
  catch: (onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: SupabaseResult): ChainableBuilder {
  const builder = {} as ChainableBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.gte = vi.fn(() => builder);
  builder.lte = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  builder.catch = (onRejected) => Promise.resolve(result).catch(onRejected);
  return builder;
}

function renderDialog(props?: Partial<Parameters<typeof CreateConversationDialog>[0]>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <CreateConversationDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        {...props}
      />
    </QueryClientProvider>
  );
  return { ...utils, onOpenChange, onSuccess };
}

describe('CreateConversationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createState.isPending = false;
    mockFrom.mockImplementation(() => makeBuilder({ data: ETABS, error: null }));
    mockMutateAsync.mockResolvedValue({ id: 'conv-1' });
  });

  it('affiche le titre, la description et les champs du formulaire', async () => {
    renderDialog();

    expect(screen.getByText('Nouvelle conversation')).toBeTruthy();
    expect(
      screen.getByText('Créez un nouveau canal de discussion pour votre équipe')
    ).toBeTruthy();
    expect(screen.getByText('Nom de la conversation')).toBeTruthy();
    expect(screen.getByText('Description (optionnel)')).toBeTruthy();
    expect(screen.getByText('Visibilité')).toBeTruthy();
    expect(screen.getByText('Privée')).toBeTruthy();
    expect(screen.getByText('Publique')).toBeTruthy();
    expect(screen.getByPlaceholderText('ex: Projet Alpha')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Lycée Victor Hugo')).toBeTruthy();
    });
    expect(screen.getByText('Collège Pasteur')).toBeTruthy();
    expect(screen.getByTestId('select-item-none').textContent).toBe('Aucun');
    expect(mockFrom).toHaveBeenCalledWith('etablissements');
  });

  it("affiche le bouton de soumission actif quand la mutation n'est pas en cours", () => {
    renderDialog();

    const submitButton = screen.getByText('Créer la conversation');
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('affiche "Création..." et désactive le bouton quand la mutation est en cours', () => {
    createState.isPending = true;
    renderDialog();

    const submitButton = screen.getByText('Création...');
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Créer la conversation')).toBeNull();
  });

  it('appelle onOpenChange(false) au clic sur Annuler', () => {
    const { onOpenChange } = renderDialog();

    fireEvent.click(screen.getByText('Annuler'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ne rend rien quand open est false', () => {
    renderDialog({ open: false });

    expect(screen.queryByText('Nouvelle conversation')).toBeNull();
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it("n'affiche aucun établissement quand la requête échoue", async () => {
    mockFrom.mockImplementation(() =>
      makeBuilder({ data: null, error: { message: 'boom' } })
    );
    renderDialog();

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('etablissements');
    });
    expect(screen.getByText('Nouvelle conversation')).toBeTruthy();
    expect(screen.queryByText('Lycée Victor Hugo')).toBeNull();
    expect(screen.queryByText('Collège Pasteur')).toBeNull();
    expect(screen.getByTestId('select-item-none')).toBeTruthy();
  });
});