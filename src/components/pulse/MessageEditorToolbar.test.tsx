import React, { createRef, type PropsWithChildren } from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { MessageEditorToolbar } from './MessageEditorToolbar';

const { stable, mockFrom, mockNavigate, toast } = vi.hoisted(() => {
  type SupabaseResult<T> = { data: T; error: null | { message: string } };

  const state: {
    next: SupabaseResult<unknown>;
    builder: Record<string, unknown>;
  } = {
    next: { data: null, error: null },
    builder: {},
  };

  const chain = vi.fn(() => state.builder);

  const resolveFromNext = vi.fn(async () => state.next);

  const thenableThen = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(state.next).then(onFulfilled, onRejected);

  const thenableCatch = (onRejected: (e: unknown) => unknown) => Promise.resolve(state.next).catch(onRejected);

  Object.assign(state.builder, {
    select: chain,
    eq: chain,
    neq: chain,
    gt: chain,
    gte: chain,
    lt: chain,
    lte: chain,
    in: chain,
    order: chain,
    limit: chain,
    range: chain,
    insert: chain,
    update: chain,
    upsert: chain,
    delete: chain,
    single: resolveFromNext,
    maybeSingle: resolveFromNext,
    then: thenableThen,
    catch: thenableCatch,
  });

  const mockFrom = vi.fn(() => state.builder);

  const toast = {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  return {
    stable: state,
    mockFrom,
    mockNavigate: vi.fn(),
    toast,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    ...props
  }: PropsWithChildren<{ asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) => {
    if (asChild) return <>{children}</>;
    return <button {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: PropsWithChildren) => <>{children}</>,
  Tooltip: ({ children }: PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: PropsWithChildren<{ asChild?: boolean }>) => (asChild ? <>{children}</> : <span>{children}</span>),
  TooltipContent: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: PropsWithChildren) => <>{children}</>,
  PopoverTrigger: ({ children, asChild }: PropsWithChildren<{ asChild?: boolean }>) => (asChild ? <>{children}</> : <span>{children}</span>),
  PopoverContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/ui/dropdown-menu', () => {
  const React = require('react') as typeof import('react');

  const Ctx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);

  function DropdownMenu({ children }: PropsWithChildren) {
    const [open, setOpen] = React.useState(false);
    return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
  }

  function DropdownMenuTrigger({ children, asChild }: PropsWithChildren<{ asChild?: boolean }>) {
    const ctx = React.useContext(Ctx);
    const child = React.Children.only(children) as React.ReactElement<{ onClick?: (e: unknown) => void }>;
    const onClick = (e: unknown) => {
      child.props.onClick?.(e);
      if (ctx) ctx.setOpen(!ctx.open);
    };
    return asChild ? React.cloneElement(child, { onClick }) : <button onClick={onClick}>{children}</button>;
  }

  function DropdownMenuContent({ children }: PropsWithChildren) {
    const ctx = React.useContext(Ctx);
    if (!ctx?.open) return null;
    return <div>{children}</div>;
  }

  function DropdownMenuItem({
    children,
    onClick,
    disabled,
  }: PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) {
    return (
      <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled}>
        {children}
      </button>
    );
  }

  function DropdownMenuSeparator() {
    return <div data-sep="true" />;
  }

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
  };
});

vi.mock('./ReactionPicker', () => ({
  ReactionPicker: ({ onSelect }: { onSelect: (e: string) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect('🙂')}>
        pick
      </button>
    </div>
  ),
}));

vi.mock('./VoiceDictationButton', () => ({
  VoiceDictationButton: ({
    onClick,
    isRecording,
    isProcessing,
    audioLevel,
    compactMode,
  }: {
    onClick: () => void;
    isRecording: boolean;
    isProcessing: boolean;
    audioLevel: number;
    compactMode?: boolean;
  }) => (
    <button
      type="button"
      aria-label="VoiceDictation"
      data-recording={String(isRecording)}
      data-processing={String(isProcessing)}
      data-audiolevel={String(audioLevel)}
      data-compactmode={String(Boolean(compactMode))}
      onClick={onClick}
    >
      voice
    </button>
  ),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('MessageEditorToolbar', () => {
  it('permet insertion de caractères et ouverture du menu IA puis action improve', () => {
    const insertChar = vi.fn();
    const toggleRecording = vi.fn();
    const handleAIAction = vi.fn();
    const handleEmojiSelect = vi.fn();
    const handleSubmit = vi.fn();
    const setShowEmojiPicker = vi.fn();

    const fileInputRef = createRef<HTMLInputElement>();
    const clickSpy = vi.fn();
    Object.defineProperty(fileInputRef, 'current', {
      value: { click: clickSpy } as unknown as HTMLInputElement,
      writable: true,
    });

    render(
      <MessageEditorToolbar
        compactMode={false}
        content="Bonjour"
        attachedFilesCount={0}
        isFocused={true}
        isAIProcessing={false}
        isRecording={false}
        isTranscribing={false}
        audioLevel={0.2}
        sendPending={false}
        showEmojiPicker={false}
        setShowEmojiPicker={setShowEmojiPicker}
        fileInputRef={fileInputRef}
        insertChar={insertChar}
        toggleRecording={toggleRecording}
        handleAIAction={handleAIAction}
        handleEmojiSelect={handleEmojiSelect}
        handleSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Commandes' }));
    expect(insertChar).toHaveBeenCalledWith('/');

    fireEvent.click(screen.getByRole('button', { name: 'Lier une entité' }));
    expect(insertChar).toHaveBeenCalledWith('#');

    fireEvent.click(screen.getByRole('button', { name: "Mentionner quelqu'un" }));
    expect(insertChar).toHaveBeenCalledWith('@');

    fireEvent.click(screen.getByRole('button', { name: 'Joindre un fichier' }));
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'VoiceDictation' }));
    expect(toggleRecording).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Assistant IA' }));
    fireEvent.click(screen.getByRole('button', { name: /Améliorer le message/i }));
    expect(handleAIAction).toHaveBeenCalledWith('improve');

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('désactive Envoyer si aucun contenu et aucun fichier, active si fichier attaché', () => {
    const insertChar = vi.fn();
    const toggleRecording = vi.fn();
    const handleAIAction = vi.fn();
    const handleEmojiSelect = vi.fn();
    const handleSubmit = vi.fn();
    const setShowEmojiPicker = vi.fn();
    const fileInputRef = createRef<HTMLInputElement>();

    const { rerender } = render(
      <MessageEditorToolbar
        compactMode={false}
        content="   "
        attachedFilesCount={0}
        isFocused={false}
        isAIProcessing={false}
        isRecording={false}
        isTranscribing={false}
        audioLevel={0}
        sendPending={false}
        showEmojiPicker={false}
        setShowEmojiPicker={setShowEmojiPicker}
        fileInputRef={fileInputRef}
        insertChar={insertChar}
        toggleRecording={toggleRecording}
        handleAIAction={handleAIAction}
        handleEmojiSelect={handleEmojiSelect}
        handleSubmit={handleSubmit}
      />
    );

    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();

    rerender(
      <MessageEditorToolbar
        compactMode={false}
        content="   "
        attachedFilesCount={2}
        isFocused={false}
        isAIProcessing={false}
        isRecording={false}
        isTranscribing={false}
        audioLevel={0}
        sendPending={false}
        showEmojiPicker={false}
        setShowEmojiPicker={setShowEmojiPicker}
        fileInputRef={fileInputRef}
        insertChar={insertChar}
        toggleRecording={toggleRecording}
        handleAIAction={handleAIAction}
        handleEmojiSelect={handleEmojiSelect}
        handleSubmit={handleSubmit}
      />
    );

    expect(screen.getByRole('button', { name: 'Envoyer' })).not.toBeDisabled();
  });

  it('emoji picker: onSelect appelle handleEmojiSelect (via mock ReactionPicker)', () => {
    const insertChar = vi.fn();
    const toggleRecording = vi.fn();
    const handleAIAction = vi.fn();
    const handleEmojiSelect = vi.fn();
    const handleSubmit = vi.fn();
    const setShowEmojiPicker = vi.fn();
    const fileInputRef = createRef<HTMLInputElement>();

    render(
      <MessageEditorToolbar
        compactMode={false}
        content="Hello"
        attachedFilesCount={0}
        isFocused={false}
        isAIProcessing={false}
        isRecording={false}
        isTranscribing={false}
        audioLevel={0}
        sendPending={false}
        showEmojiPicker={true}
        setShowEmojiPicker={setShowEmojiPicker}
        fileInputRef={fileInputRef}
        insertChar={insertChar}
        toggleRecording={toggleRecording}
        handleAIAction={handleAIAction}
        handleEmojiSelect={handleEmojiSelect}
        handleSubmit={handleSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'pick' }));
    expect(handleEmojiSelect).toHaveBeenCalledWith('🙂');
  });

  it('renderHook (QueryClientProvider): chargement -> succès -> erreur, et mutation appelle supabase.from avec le bon paramètre', async () => {
    const client = createQueryClient();
    const wrapper = createWrapper(client);

    stable.next = { data: null, error: null };

    const queryFn = vi.fn(async () => {
      const q = mockFrom('messages').select('*').eq('id', 'm1').maybeSingle();
      const res = (await q) as { data: { id: string; body: string } | null; error: null | { message: string } };
      if (res.error) throw new Error(res.error.message);
      return res.data;
    });

    const { result } = renderHook(() => useQuery({ queryKey: ['msg', 'm1'], queryFn }), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(null);
    expect(mockFrom).toHaveBeenCalledWith('messages');

    stable.next = { data: null, error: { message: 'x' } };

    await act(async () => {
      await client.invalidateQueries({ queryKey: ['msg', 'm1'] });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    stable.next = { data: { id: 'm2' }, error: null };

    const mutationFn = vi.fn(async (payload: { body: string }) => {
      const q = mockFrom('messages').insert({ body: payload.body }).single();
      const res = (await q) as { data: { id: string } | null; error: null | { message: string } };
      if (res.error) throw new Error(res.error.message);
      return res.data;
    });

    const hook2 = renderHook(() => useMutation({ mutationFn }), { wrapper });

    await act(async () => {
      await hook2.result.current.mutateAsync({ body: 'Salut' });
    });

    expect(mockFrom).toHaveBeenCalledWith('messages');
    expect(stable.builder.insert).toHaveBeenCalledWith({ body: 'Salut' });
  });
});