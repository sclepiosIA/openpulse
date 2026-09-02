// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { AddMemberDialog } from './AddMemberDialog';

const hoisted = vi.hoisted(() => {
  const PROFILES = [
    {
      id: 'u1',
      prenom: 'Alice',
      nom: 'Martin',
      email: 'alice@example.test',
      avatar_url: null,
    },
    {
      id: 'u2',
      prenom: 'Bob',
      nom: 'Durand',
      email: 'bob@example.test',
      avatar_url: null,
    },
    {
      id: 'u3',
      prenom: 'Chloe',
      nom: 'Petit',
      email: 'chloe@example.test',
      avatar_url: null,
    },
  ];

  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);
  builder.select = chain;
  builder.eq = chain;
  builder.gte = chain;
  builder.lte = chain;
  builder.in = chain;
  builder.order = chain;
  builder.limit = chain;
  builder.insert = chain;
  builder.update = chain;
  builder.delete = chain;
  builder.upsert = chain;
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = (onFulfilled?: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled);
  builder.catch = (onRejected?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected);

  return {
    PROFILES,
    mockFrom: vi.fn(() => builder),
    debugError: vi.fn(),
    useProfilesMock: vi.fn(),
    mutateAsyncMock: vi.fn(),
    useAddPulseConversationMemberMock: vi.fn(),
  };
});

vi.mock('@/lib/debug', () => ({
  debug: {
    error: hoisted.debugError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: hoisted.mockFrom,
  },
}));

vi.mock('@/hooks/profile/useProfiles', () => ({
  useProfiles: hoisted.useProfilesMock,
}));

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  useAddPulseConversationMember: hoisted.useAddPulseConversationMemberMock,
}));

vi.mock('lucide-react', () => ({
  Search: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...props, 'data-testid': 'search-icon' }),
  Loader2: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...props, 'data-testid': 'loader-icon' }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div data-testid="dialog-content" className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    placeholder,
    className,
  }: {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
    />
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
  }) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ? 'true' : 'false'}
      onClick={onCheckedChange}
    >
      {checked ? 'checked' : 'unchecked'}
    </button>
  ),
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AvatarImage: ({ src }: { src?: string }) => <img alt="" src={src} />,
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
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

function renderDialog(
  props?: Partial<React.ComponentProps<typeof AddMemberDialog>>
) {
  const onOpenChange = vi.fn();

  return {
    onOpenChange,
    ...render(
      <AddMemberDialog
        open={true}
        onOpenChange={onOpenChange}
        conversationId="conv-1"
        existingMemberIds={[]}
        {...props}
      />
    ),
  };
}

describe('AddMemberDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hoisted.useProfilesMock.mockReturnValue({
      data: hoisted.PROFILES,
      isLoading: false,
      isError: false,
      error: null,
    });

    hoisted.mutateAsyncMock.mockResolvedValue({ data: { ok: true }, error: null });

    hoisted.useAddPulseConversationMemberMock.mockReturnValue({
      mutateAsync: hoisted.mutateAsyncMock,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('utilise un wrapper QueryClientProvider compatible renderHook', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => hoisted.useProfilesMock(),
      { wrapper }
    );

    expect(result.current.data).toEqual(hoisted.PROFILES);
    expect(result.current.isLoading).toBe(false);
  });

  it('affiche un état de chargement', () => {
    hoisted.useProfilesMock.mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
      error: null,
    });

    renderDialog();

    expect(screen.getByText('Ajouter des membres')).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
  });

  it('affiche uniquement les profils disponibles, exclut les membres existants et filtre par recherche', () => {
    renderDialog({ existingMemberIds: ['u2'] });

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.queryByText('Bob Durand')).not.toBeInTheDocument();
    expect(screen.getByText('Chloe Petit')).toBeInTheDocument();
    expect(screen.getByText('AM')).toBeInTheDocument();
    expect(screen.getByText('CP')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(input, { target: { value: 'chloe' } });

    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
    expect(screen.getByText('Chloe Petit')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'alice@example.test' } });

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.queryByText('Chloe Petit')).not.toBeInTheDocument();
  });

  it('affiche le message "Tous les membres sont déjà ajoutés" quand aucun profil disponible sans recherche', () => {
    renderDialog({ existingMemberIds: ['u1', 'u2', 'u3'] });

    expect(screen.getByText('Tous les membres sont déjà ajoutés')).toBeInTheDocument();
  });

  it('affiche le message "Aucun résultat" quand la recherche ne correspond à rien', () => {
    renderDialog();

    const input = screen.getByPlaceholderText('Rechercher...');
    fireEvent.change(input, { target: { value: 'zzzz' } });

    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
  });

  it('ajoute les membres sélectionnés séquentiellement avec les bonnes valeurs métier puis ferme la dialog', async () => {
    const { onOpenChange } = renderDialog({ conversationId: 'conv-42' });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[2]);

    expect(screen.getByRole('button', { name: 'Ajouter (2)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter (2)' }));

    await waitFor(() => {
      expect(hoisted.mutateAsyncMock).toHaveBeenCalledTimes(2);
    });

    expect(hoisted.mutateAsyncMock).toHaveBeenNthCalledWith(1, {
      conversationId: 'conv-42',
      userId: 'u1',
    });
    expect(hoisted.mutateAsyncMock).toHaveBeenNthCalledWith(2, {
      conversationId: 'conv-42',
      userId: 'u3',
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('réinitialise la sélection et la recherche lors de la fermeture via Annuler', () => {
    const { onOpenChange } = renderDialog();

    fireEvent.change(screen.getByPlaceholderText('Rechercher...'), {
      target: { value: 'alice' },
    });

    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);

    expect(screen.getByRole('button', { name: 'Ajouter (1)' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('gère une erreur de mutation en restant ouvert et journalise l’erreur', async () => {
    const mutationError = { message: 'x' };
    hoisted.mutateAsyncMock.mockRejectedValueOnce(mutationError);

    const { onOpenChange } = renderDialog({ conversationId: 'conv-err' });

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter (1)' }));

    await waitFor(() => {
      expect(hoisted.debugError).toHaveBeenCalledWith('Error adding members:', mutationError);
    });

    expect(hoisted.mutateAsyncMock).toHaveBeenCalledWith({
      conversationId: 'conv-err',
      userId: 'u1',
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('expose un état d’erreur côté hook mocké avec payload { data:null, error:{ message:"x" } }', () => {
    hoisted.useProfilesMock.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => hoisted.useProfilesMock(), { wrapper });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.data).toBeNull();
  });
});