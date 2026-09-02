import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  PARENT_MESSAGE,
  REPLIES,
  onOpenChange,
  usePulseThreadRepliesMock,
  MessageEditorMock,
  mockFrom,
} = vi.hoisted(() => {
  const PARENT_MESSAGE = {
    id: 'm_parent_1',
    content: 'Message parent',
    created_at: '2024-01-02T10:11:12.000Z',
    user: { prenom: 'Jean', nom: 'Dupont' },
  };

  const REPLIES = [
    {
      id: 'm_r1',
      content: 'Première réponse',
      created_at: '2024-01-02T10:12:00.000Z',
      user: { prenom: 'Alice', nom: 'Martin' },
    },
    {
      id: 'm_r2',
      content: 'Deuxième réponse',
      created_at: '2024-01-02T10:13:00.000Z',
      user: { prenom: 'Bob', nom: 'Durand' },
    },
  ];

  return {
    PARENT_MESSAGE,
    REPLIES,
    onOpenChange: vi.fn(),
    usePulseThreadRepliesMock: vi.fn(),
    MessageEditorMock: vi.fn(),
    mockFrom: vi.fn(),
  };
});

vi.mock('@/integrations/supabase/client', () => {
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
    upsert: vi.fn(() => builder),
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: vi.fn((onFulfilled?: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled as never)
    ),
    catch: vi.fn((onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected as never)
    ),
  };

  mockFrom.mockImplementation(() => builder);

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
  };
});

vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  usePulseThreadReplies: (parentId?: string) => usePulseThreadRepliesMock(parentId),
}));

vi.mock('./MessageEditor', () => ({
  MessageEditor: (props: {
    conversationId: string;
    parentMessageId: string;
    onTyping: () => void;
    placeholder: string;
  }) => {
    MessageEditorMock(props);
    return (
      <div data-testid="message-editor">
        <div data-testid="message-editor-conversation">{props.conversationId}</div>
        <div data-testid="message-editor-parent">{props.parentMessageId}</div>
        <div data-testid="message-editor-placeholder">{props.placeholder}</div>
      </div>
    );
  },
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: (props: { className?: string }) => <svg data-testid="icon-arrow-left" className={props.className} />,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="avatar" className={props.className}>
      {props.children}
    </div>
  ),
  AvatarFallback: (props: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="avatar-fallback" className={props.className}>
      {props.children}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button {...props} />
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, { children?: React.ReactNode; className?: string }>((props, ref) => (
    <div data-testid="scroll-area" ref={ref} className={props.className}>
      {props.children}
    </div>
  )),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: (props: { className?: string }) => <div data-testid="skeleton" className={props.className} />,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: (props: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => (
    <div data-testid="sheet" data-open={props.open ? 'true' : 'false'}>
      {props.children}
    </div>
  ),
  SheetContent: (props: { side?: string; className?: string; children?: React.ReactNode }) => (
    <div data-testid="sheet-content" data-side={props.side} className={props.className}>
      {props.children}
    </div>
  ),
  SheetHeader: (props: { className?: string; children?: React.ReactNode }) => (
    <div data-testid="sheet-header" className={props.className}>
      {props.children}
    </div>
  ),
  SheetTitle: (props: { children?: React.ReactNode }) => <h2 data-testid="sheet-title">{props.children}</h2>,
}));

import { ThreadView } from './ThreadView';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('ThreadView', () => {
  it('affiche les skeletons pendant le chargement et le compteur de messages', () => {
    usePulseThreadRepliesMock.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    renderWithClient(
      <ThreadView
        open={true}
        onOpenChange={onOpenChange}
        parentMessage={PARENT_MESSAGE}
        conversationId="conv_1"
      />
    );

    expect(usePulseThreadRepliesMock).toHaveBeenCalledWith(PARENT_MESSAGE.id);
    expect(screen.getByTestId('sheet-title').textContent).toBe('Fil de discussion');
    expect(screen.getByText('1 message')).toBeTruthy();

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(9);

    expect(screen.getByText('Message parent')).toBeTruthy();
    expect(screen.getByTestId('message-editor-conversation').textContent).toBe('conv_1');
    expect(screen.getByTestId('message-editor-parent').textContent).toBe(PARENT_MESSAGE.id);
    expect(screen.getByTestId('message-editor-placeholder').textContent).toBe('Répondre dans le fil...');
  });

  it('affiche le parent, les réponses et le séparateur avec le bon décompte', () => {
    usePulseThreadRepliesMock.mockReturnValue({
      data: REPLIES,
      isLoading: false,
    });

    renderWithClient(
      <ThreadView
        open={true}
        onOpenChange={onOpenChange}
        parentMessage={PARENT_MESSAGE}
        conversationId="conv_1"
      />
    );

    expect(screen.getByText('3 messages')).toBeTruthy();
    expect(screen.getByText('2 réponses')).toBeTruthy();

    expect(screen.getByText('Message parent')).toBeTruthy();
    expect(screen.getByText('Première réponse')).toBeTruthy();
    expect(screen.getByText('Deuxième réponse')).toBeTruthy();

    const fallbacks = screen.getAllByTestId('avatar-fallback');
    expect(fallbacks.length).toBe(3);

    expect(within(fallbacks[0]).getByText('JD')).toBeTruthy();
    expect(within(fallbacks[1]).getByText('AM')).toBeTruthy();
    expect(within(fallbacks[2]).getByText('BD')).toBeTruthy();

    expect(MessageEditorMock).toHaveBeenCalledWith({
      conversationId: 'conv_1',
      parentMessageId: PARENT_MESSAGE.id,
      onTyping: expect.any(Function) as unknown as () => void,
      placeholder: 'Répondre dans le fil...',
    });
  });

  it('déclenche onOpenChange(false) via le bouton "Fermer"', async () => {
    usePulseThreadRepliesMock.mockReturnValue({
      data: REPLIES,
      isLoading: false,
    });

    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    renderWithClient(
      <ThreadView
        open={true}
        onOpenChange={onOpenChange}
        parentMessage={PARENT_MESSAGE}
        conversationId="conv_1"
      />
    );

    const btn = screen.getByRole('button', { name: 'Fermer' });
    await user.click(btn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ne rend rien si parentMessage est null', () => {
    usePulseThreadRepliesMock.mockReturnValue({
      data: REPLIES,
      isLoading: false,
    });

    const { container } = renderWithClient(
      <ThreadView open={true} onOpenChange={onOpenChange} parentMessage={null} conversationId="conv_1" />
    );

    expect(container.textContent).toBe('');
  });
});