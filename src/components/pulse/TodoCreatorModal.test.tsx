import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, act } from '@testing-library/react';

const {
  mockCreateTodoMutate,
  mockSendMessageMutate,
  mockUpdateTodoMessageMutate,
  mockUseCreatePulseTodoList,
  mockUseSendPulseMessage,
  mockUseUpdateTodoListMessage,
  mockDialog,
  mockDialogContent,
  mockDialogHeader,
  mockDialogTitle,
  mockDialogFooter,
  mockButton,
  mockInput,
  mockLabel,
} = vi.hoisted(() => {
  const mockCreateTodoMutateFn = vi.fn();
  const mockSendMessageMutateFn = vi.fn();
  const mockUpdateTodoMessageMutateFn = vi.fn();

  const mockUseCreatePulseTodoListImpl = vi.fn(() => ({
    mutate: mockCreateTodoMutateFn,
    isPending: false,
  }));

  const mockUseSendPulseMessageImpl = vi.fn(() => ({
    mutate: mockSendMessageMutateFn,
    isPending: false,
  }));

  const mockUseUpdateTodoListMessageImpl = vi.fn(() => ({
    mutate: mockUpdateTodoMessageMutateFn,
    isPending: false,
  }));

  const Dialog = ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    open ? <div data-testid="dialog-root">{children}</div> : null
  );
  const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-content" className={className}>{children}</div>
  );
  const DialogHeader = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  );
  const DialogTitle = ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  );
  const DialogFooter = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  );

  const Button = ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
    type,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...rest}
    >
      {children}
    </button>
  );

  const Input = ({
    value,
    onChange,
    onKeyDown,
    placeholder,
    id,
    className,
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );

  const Label = ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  );

  return {
    mockCreateTodoMutate: mockCreateTodoMutateFn,
    mockSendMessageMutate: mockSendMessageMutateFn,
    mockUpdateTodoMessageMutate: mockUpdateTodoMessageMutateFn,
    mockUseCreatePulseTodoList: mockUseCreatePulseTodoListImpl,
    mockUseSendPulseMessage: mockUseSendPulseMessageImpl,
    mockUseUpdateTodoListMessage: mockUseUpdateTodoListMessageImpl,
    mockDialog: Dialog,
    mockDialogContent: DialogContent,
    mockDialogHeader: DialogHeader,
    mockDialogTitle: DialogTitle,
    mockDialogFooter: DialogFooter,
    mockButton: Button,
    mockInput: Input,
    mockLabel: Label,
  };
});

vi.mock('@/components/ui/dialog', () => ({
  Dialog: mockDialog,
  DialogContent: mockDialogContent,
  DialogHeader: mockDialogHeader,
  DialogTitle: mockDialogTitle,
  DialogFooter: mockDialogFooter,
}));

vi.mock('@/components/ui/button', () => ({
  Button: mockButton,
}));

vi.mock('@/components/ui/input', () => ({
  Input: mockInput,
}));

vi.mock('@/components/ui/label', () => ({
  Label: mockLabel,
}));

vi.mock('lucide-react', () => ({
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  Trash2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-trash" {...props} />,
  GripVertical: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-grip" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

vi.mock('@/hooks/pulse/usePulseTodos', () => ({
  useCreatePulseTodoList: mockUseCreatePulseTodoList,
  useUpdateTodoListMessage: mockUseUpdateTodoListMessage,
}));

vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  useSendPulseMessage: mockUseSendPulseMessage,
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    supabase: {
      from: () => builder,
    },
  };
});

vi.mock('@/components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'user@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'user@example.com' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import { TodoCreatorModal } from './TodoCreatorModal';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('TodoCreatorModal', () => {
  beforeEach(() => {
    mockCreateTodoMutate.mockReset();
    mockSendMessageMutate.mockReset();
    mockUpdateTodoMessageMutate.mockReset();
  });

  it('affiche le titre par défaut, un élément vide et le bouton Créer désactivé au chargement', () => {
    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={() => {}}
        conversationId="conv-1"
      />
    );

    const titleInput = screen.getByLabelText('Titre') as HTMLInputElement;
    expect(titleInput.value).toBe('Todo');

    const itemInput = screen.getByPlaceholderText('Élément 1') as HTMLInputElement;
    expect(itemInput.value).toBe('');

    const createButton = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);
  });

  it('permet d’ajouter, mettre à jour et supprimer des éléments et active le bouton Créer', () => {
    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={() => {}}
        conversationId="conv-2"
      />
    );

    const newItemInput = screen.getByPlaceholderText('Ajouter un élément...') as HTMLInputElement;
    const addButton = screen.getByRole('button', { name: 'Ajouter' }) as HTMLButtonElement;

    expect(addButton.disabled).toBe(true);

    fireEvent.change(newItemInput, { target: { value: 'Premier item' } });
    expect(addButton.disabled).toBe(false);

    fireEvent.click(addButton);
    expect(newItemInput.value).toBe('');

    const firstItemInput = screen.getByPlaceholderText('Élément 1') as HTMLInputElement;
    const secondItemInput = screen.getByPlaceholderText('Élément 2') as HTMLInputElement;

    expect(firstItemInput.value).toBe('');
    expect(secondItemInput.value).toBe('Premier item');

    fireEvent.change(secondItemInput, { target: { value: 'Item modifié' } });
    expect(secondItemInput.value).toBe('Item modifié');

    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer' });
    fireEvent.click(deleteButtons[0]);

    expect(screen.queryByPlaceholderText('Élément 1')).not.toBeNull();

    const createButton = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;
    expect(createButton.disabled).toBe(false);
  });

  it("ajoute un élément via la touche Enter dans l'input de nouveau élément", () => {
    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={() => {}}
        conversationId="conv-3"
      />
    );

    const newItemInput = screen.getByPlaceholderText('Ajouter un élément...') as HTMLInputElement;
    fireEvent.change(newItemInput, { target: { value: 'Nouvel item' } });

    fireEvent.keyDown(newItemInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(newItemInput.value).toBe('');
    const secondItemInput = screen.getByPlaceholderText('Élément 2') as HTMLInputElement;
    expect(secondItemInput.value).toBe('Nouvel item');
  });

  it('n’appelle pas la mutation de création si aucun élément valide', () => {
    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={() => {}}
        conversationId="conv-4"
      />
    );

    const createButton = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    fireEvent.click(createButton);

    expect(mockCreateTodoMutate).not.toHaveBeenCalled();
  });

  it('crée une todo avec items et envoie le message, puis met à jour le message de la todo', async () => {
    const onOpenChange = vi.fn();

    mockUseCreatePulseTodoList.mockReturnValue({
      mutate: mockCreateTodoMutate,
      isPending: false,
    });
    mockUseSendPulseMessage.mockReturnValue({
      mutate: mockSendMessageMutate,
      isPending: false,
    });
    mockUseUpdateTodoListMessage.mockReturnValue({
      mutate: mockUpdateTodoMessageMutate,
      isPending: false,
    });

    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={onOpenChange}
        conversationId="conv-5"
      />
    );

    const titleInput = screen.getByLabelText('Titre') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Liste perso' } });

    const newItemInput = screen.getByPlaceholderText('Ajouter un élément...') as HTMLInputElement;
    fireEvent.change(newItemInput, { target: { value: 'Item A' } });

    const addButton = screen.getByRole('button', { name: 'Ajouter' }) as HTMLButtonElement;
    fireEvent.click(addButton);

    const createButton = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(createButton);
    });

    expect(mockCreateTodoMutate).toHaveBeenCalledTimes(1);
    const createArgs = mockCreateTodoMutate.mock.calls[0][0];
    const createOptions = mockCreateTodoMutate.mock.calls[0][1];

    expect(createArgs).toEqual({
      conversationId: 'conv-5',
      title: 'Liste perso',
      items: ['Item A'],
    });

    const fakeTodo = { id: 'todo-1', title: 'Liste perso' };
    const fakeMessage = { id: 'msg-1', content: '#[Liste perso](todo:todo-1)' };

    expect(typeof createOptions.onSuccess).toBe('function');

    await act(async () => {
      createOptions.onSuccess(fakeTodo);
    });

    expect(mockSendMessageMutate).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendMessageMutate.mock.calls[0][0];
    const sendOptions = mockSendMessageMutate.mock.calls[0][1];

    expect(sendArgs).toEqual({
      conversation_id: 'conv-5',
      content: '#[Liste perso](todo:todo-1)',
      mentions: [],
    });

    expect(typeof sendOptions.onSuccess).toBe('function');

    await act(async () => {
      sendOptions.onSuccess(fakeMessage);
    });

    expect(mockUpdateTodoMessageMutate).toHaveBeenCalledTimes(1);
    expect(mockUpdateTodoMessageMutate).toHaveBeenCalledWith({
      todoListId: 'todo-1',
      messageId: 'msg-1',
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ne met pas à jour la todo si le message renvoyé n'a pas d'id", async () => {
    mockUseCreatePulseTodoList.mockReturnValue({
      mutate: mockCreateTodoMutate,
      isPending: false,
    });
    mockUseSendPulseMessage.mockReturnValue({
      mutate: mockSendMessageMutate,
      isPending: false,
    });
    mockUseUpdateTodoListMessage.mockReturnValue({
      mutate: mockUpdateTodoMessageMutate,
      isPending: false,
    });

    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={() => {}}
        conversationId="conv-6"
      />
    );

    const newItemInput = screen.getByPlaceholderText('Ajouter un élément...') as HTMLInputElement;
    fireEvent.change(newItemInput, { target: { value: 'Item X' } });
    const addButton = screen.getByRole('button', { name: 'Ajouter' }) as HTMLButtonElement;
    fireEvent.click(addButton);

    const createButton = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(createButton);
    });

    const fakeTodo = { id: 'todo-2', title: 'Todo' };

    const createOptions = mockCreateTodoMutate.mock.calls[0][1];

    await act(async () => {
      createOptions.onSuccess(fakeTodo);
    });

    const sendOptions = mockSendMessageMutate.mock.calls[0][1];

    await act(async () => {
      sendOptions.onSuccess({ id: undefined });
    });

    expect(mockUpdateTodoMessageMutate).not.toHaveBeenCalled();
  });

  it('réinitialise les champs et ferme le modal quand on clique sur Annuler', () => {
    const onOpenChange = vi.fn();

    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={onOpenChange}
        conversationId="conv-7"
      />
    );

    const titleInput = screen.getByLabelText('Titre') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Titre modifié' } });

    const newItemInput = screen.getByPlaceholderText('Ajouter un élément...') as HTMLInputElement;
    fireEvent.change(newItemInput, { target: { value: 'Item à ignorer' } });

    const cancelButton = screen.getByRole('button', { name: 'Annuler' });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('désactive le bouton Créer et affiche le loader pendant la création', () => {
    mockUseCreatePulseTodoList.mockReturnValue({
      mutate: mockCreateTodoMutate,
      isPending: true,
    });
    mockUseSendPulseMessage.mockReturnValue({
      mutate: mockSendMessageMutate,
      isPending: false,
    });
    mockUseUpdateTodoListMessage.mockReturnValue({
      mutate: mockUpdateTodoMessageMutate,
      isPending: false,
    });

    renderWithQueryClient(
      <TodoCreatorModal
        open={true}
        onOpenChange={() => {}}
        conversationId="conv-8"
      />
    );

    const newItemInput = screen.getByPlaceholderText('Ajouter un élément...') as HTMLInputElement;
    fireEvent.change(newItemInput, { target: { value: 'Item chargé' } });
    const addButton = screen.getByRole('button', { name: 'Ajouter' });
    fireEvent.click(addButton);

    const createButton = screen.getByRole('button', { name: 'Créer' }) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    const loaderIcon = screen.getByTestId('icon-loader');
    expect(loaderIcon).toBeInTheDocument();
  });
});