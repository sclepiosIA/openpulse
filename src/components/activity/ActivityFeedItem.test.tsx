import React from 'react';
import { render, screen, fireEvent, within, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { ActivityFeedItem } from './ActivityFeedItem';

const {
  toastSuccess,
  toastError,
  writeTextMock,
  mockOnToggleReaction,
  mockOnTogglePin,
  mockOnOpenDetail,
  mockNavigate,
  itemBase,
  reactionsBase,
  ActivityIcon,
} = vi.hoisted(() => {
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const writeTextMock = vi.fn<Promise<void>, [string]>();

  const mockOnToggleReaction = vi.fn<[string, string, boolean], void>();
  const mockOnTogglePin = vi.fn<[string, boolean], void>();
  const mockOnOpenDetail = vi.fn<[unknown], void>();
  const mockNavigate = vi.fn();

  const itemBase = {
    id: 'act_1',
    icon: 'Activity',
    color: 'gray',
    actor_name: 'Jean Dupont',
    occurred_at: '2024-01-15T10:12:00.000Z',
    metadata: {
      statut: 'Ouvert',
      priorite: 'Haute',
      montant_ttc: 1234.56,
      category: 'Maintenance',
    },
    type: 'comment',
    title: 'Titre activité',
    description: 'Description activité',
    link: '/documents/doc_1',
    etablissement_id: 'etab_1',
    etablissement_nom: 'Clinique Test',
  };

  const reactionsBase = [
    { emoji: '👍', count: 2, reacted: false },
    { emoji: '🎉', count: 1, reacted: true },
  ];

  const ActivityIcon = (props: { className?: string }) => <svg data-testid="icon-activity" className={props.className} />;

  return {
    toastSuccess,
    toastError,
    writeTextMock,
    mockOnToggleReaction,
    mockOnTogglePin,
    mockOnOpenDetail,
    mockNavigate,
    itemBase,
    reactionsBase,
    ActivityIcon,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('lucide-react', async () => {
  const ReactMod = await import('react');
  const mk = (name: string) => (props: { className?: string }) => ReactMod.createElement('svg', { 'data-testid': `icon-${name}`, className: props.className });
  return {
    __esModule: true,
    Activity: ActivityIcon,
    Pin: mk('pin'),
    PinOff: mk('pinoff'),
    Link2: mk('link2'),
    ExternalLink: mk('externallink'),
    MoreHorizontal: mk('morehorizontal'),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/avatar', async () => {
  const ReactMod = await import('react');
  return {
    Avatar: (props: React.PropsWithChildren<{ className?: string }>) =>
      ReactMod.createElement('div', { 'data-testid': 'avatar', className: props.className }, props.children),
    AvatarFallback: (props: React.PropsWithChildren<{ className?: string }>) =>
      ReactMod.createElement('div', { 'data-testid': 'avatar-fallback', className: props.className }, props.children),
  };
});

vi.mock('@/components/ui/badge', async () => {
  const ReactMod = await import('react');
  return {
    Badge: (props: React.PropsWithChildren<{ className?: string; variant?: string }>) =>
      ReactMod.createElement(
        'span',
        { 'data-testid': 'badge', className: props.className, 'data-variant': props.variant },
        props.children
      ),
  };
});

vi.mock('@/components/ui/button', async () => {
  const ReactMod = await import('react');
  return {
    Button: (props: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }>) =>
      ReactMod.createElement(
        'button',
        { ...props, 'data-variant': props.variant, 'data-size': props.size, type: props.type ?? 'button' },
        props.children
      ),
  };
});

vi.mock('@/components/ui/dropdown-menu', async () => {
  const ReactMod = await import('react');
  type CProps = React.PropsWithChildren<Record<string, unknown>>;

  const DropdownMenu = (props: CProps) => ReactMod.createElement(ReactMod.Fragment, null, props.children);

  const DropdownMenuTrigger = (props: React.PropsWithChildren<{ asChild?: boolean }>) => ReactMod.createElement(ReactMod.Fragment, null, props.children);

  const DropdownMenuContent = (props: React.PropsWithChildren<{ align?: string }>) =>
    ReactMod.createElement('div', { 'data-testid': 'dropdown-content', 'data-align': props.align }, props.children);

  const DropdownMenuItem = (props: React.PropsWithChildren<{ onClick?: () => void; asChild?: boolean }>) => {
    if (props.asChild) return ReactMod.createElement(ReactMod.Fragment, null, props.children);
    return ReactMod.createElement(
      'button',
      { type: 'button', onClick: props.onClick, 'data-testid': 'dropdown-item' },
      props.children
    );
  };

  return { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
});

vi.mock('react-router-dom', async () => {
  const ReactMod = await import('react');
  return {
    Link: (props: React.PropsWithChildren<{ to: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> }>) =>
      ReactMod.createElement('a', { href: props.to, onClick: props.onClick }, props.children),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/types/activity', () => ({
  ACTIVITY_COLOR_CLASSES: {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
  },
  ACTIVITY_TYPE_LABELS: {
    comment: 'Commentaire',
    status: 'Statut',
  },
}));

vi.mock('./ReactionBar', async () => {
  const ReactMod = await import('react');
  return {
    ReactionBar: (props: {
      activityKey: string;
      reactions: Array<{ emoji: string; count: number; reacted?: boolean }>;
      onToggle: (emoji: string, currently: boolean) => void;
    }) =>
      ReactMod.createElement(
        'div',
        { 'data-testid': 'reaction-bar', 'data-activity-key': props.activityKey },
        props.reactions.map((r) =>
          ReactMod.createElement(
            'button',
            {
              key: r.emoji,
              type: 'button',
              'data-testid': `reaction-${r.emoji}`,
              onClick: () => props.onToggle(r.emoji, Boolean(r.reacted)),
            },
            `${r.emoji} ${r.count}`
          )
        )
      ),
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderHookWithQueryClient<T>(hook: () => T) {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return renderHook(hook, { wrapper });
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, ' ').replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ').trim();
}

describe('ActivityFeedItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les infos métier et déclenche onOpenDetail + onToggleReaction', async () => {
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost' },
      writable: true,
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    });

    const item = { ...itemBase };
    const reactions = reactionsBase.map((r) => ({ ...r }));

    render(
      <ActivityFeedItem
        item={item as never}
        reactions={reactions as never}
        pinned={true}
        highlight={true}
        onToggleReaction={mockOnToggleReaction}
        onTogglePin={mockOnTogglePin}
        onOpenDetail={mockOnOpenDetail as never}
      />
    );

    expect(screen.getByText('Jean Dupont')).toBeTruthy();
    expect(screen.getByText('Commentaire')).toBeTruthy();
    expect(screen.getByText('Titre activité')).toBeTruthy();
    expect(screen.getByText('Description activité')).toBeTruthy();

    expect(screen.getByText('🏥 Clinique Test')).toBeTruthy();
    expect(screen.getByText('Ouvert')).toBeTruthy();
    expect(screen.getByText('⚡ Haute')).toBeTruthy();

    const amount = screen.getByText((content) => normalizeSpaces(content) === '1 234,56 €');
    expect(amount).toBeTruthy();

    expect(screen.getByText('Maintenance')).toBeTruthy();

    const article = document.getElementById('activity-act_1');
    expect(article).toBeTruthy();
    expect(article?.className.includes('ring-2')).toBe(true);
    expect(article?.className.includes('border-amber-400/60')).toBe(true);

    expect(screen.getByTestId('avatar-fallback').textContent).toBe('JD');

    fireEvent.click(screen.getByText('Titre activité'));
    expect(mockOnOpenDetail).toHaveBeenCalledTimes(1);
    expect(mockOnOpenDetail).toHaveBeenCalledWith(item);

    fireEvent.click(screen.getByTestId('reaction-🎉'));
    expect(mockOnToggleReaction).toHaveBeenCalledTimes(1);
    expect(mockOnToggleReaction).toHaveBeenCalledWith('act_1', '🎉', true);

    const timeEl = document.querySelector('time');
    expect(timeEl).toBeTruthy();
    expect(timeEl?.textContent).toContain(
      new Date(item.occurred_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );

    expect(screen.getByTestId('icon-pin')).toBeTruthy();
  });

  it('toggle pin + copie du lien (succès) + lien externe affiché', async () => {
    toastSuccess.mockClear();
    toastError.mockClear();
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValueOnce();

    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost' },
      writable: true,
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    });

    const item = { ...itemBase, link: '/documents/doc_1' };

    render(
      <ActivityFeedItem
        item={item as never}
        reactions={[] as never}
        pinned={false}
        onToggleReaction={mockOnToggleReaction}
        onTogglePin={mockOnTogglePin}
        onOpenDetail={mockOnOpenDetail as never}
      />
    );

    fireEvent.click(screen.getByLabelText("Plus d'options"));

    const content = screen.getByTestId('dropdown-content');
    const items = within(content).getAllByTestId('dropdown-item');

    fireEvent.click(items[0]);
    expect(mockOnTogglePin).toHaveBeenCalledTimes(1);
    expect(mockOnTogglePin).toHaveBeenCalledWith('act_1', false);

    await act(async () => {
      fireEvent.click(items[1]);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const calledUrl = writeTextMock.mock.calls[0]?.[0];
    expect(calledUrl).toBe('http://localhost/activite?focus=act_1');
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Lien copié');
    expect(toastError).not.toHaveBeenCalled();

    const openLink = within(content).getByText('Ouvrir').closest('a');
    expect(openLink?.getAttribute('href')).toBe('/documents/doc_1');
  });

  it('copie du lien (erreur) -> toast.error', async () => {
    toastSuccess.mockClear();
    toastError.mockClear();
    writeTextMock.mockReset();
    writeTextMock.mockRejectedValueOnce(new Error('nope'));

    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost' },
      writable: true,
    });

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    });

    const item = { ...itemBase };

    render(
      <ActivityFeedItem
        item={item as never}
        reactions={[] as never}
        pinned={false}
        onToggleReaction={mockOnToggleReaction}
        onTogglePin={mockOnTogglePin}
        onOpenDetail={mockOnOpenDetail as never}
      />
    );

    fireEvent.click(screen.getByLabelText("Plus d'options"));
    const content = screen.getByTestId('dropdown-content');
    const items = within(content).getAllByTestId('dropdown-item');

    await act(async () => {
      fireEvent.click(items[1]);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith('Impossible de copier le lien');
  });
});

describe('React Query wrapper (renderHook) - loading/success/error + mutation', () => {
  it('isLoading -> success', async () => {
    const { result, rerender } = renderHookWithQueryClient(() =>
      useQuery({
        queryKey: ['demo', 'success'],
        queryFn: async () => 'ok',
      })
    );

    expect(result.current.isLoading || result.current.isPending).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });
    rerender();

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toBe('ok');
  });

  it('isLoading -> error (data:null, error message)', async () => {
    const { result, rerender } = renderHookWithQueryClient(() =>
      useQuery({
        queryKey: ['demo', 'error'],
        queryFn: async () => Promise.reject({ data: null, error: { message: 'x' } }),
      })
    );

    expect(result.current.isLoading || result.current.isPending).toBe(true);

    await act(async () => {
      await Promise.resolve();
    });
    rerender();

    expect(result.current.isError).toBe(true);
    const err = result.current.error as unknown;
    expect(typeof err).toBe('object');
    expect((err as { error?: { message?: string } }).error?.message).toBe('x');
  });

  it('mutation -> calls fn with variables', async () => {
    const mutationFn = vi.fn(async (vars: { id: string; flag: boolean }) => ({ ok: true, vars }));

    const { result } = renderHookWithQueryClient(() =>
      useMutation({
        mutationFn,
      })
    );

    await act(async () => {
      await result.current.mutateAsync({ id: 'm1', flag: true });
    });

    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(mutationFn).toHaveBeenCalledWith({ id: 'm1', flag: true });
  });
});