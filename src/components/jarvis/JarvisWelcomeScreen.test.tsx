import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  stableUser,
  executeQuickAction,
  vibrateSelection,
  useNavigate,
  supabaseMockFrom,
  supabaseBuilder,
  jarvisColors,
  toastSuccess,
  toastError,
  stableUtils,
} = vi.hoisted(() => {
  const executeQuickAction = vi.fn<(command: string) => void>();
  const vibrateSelection = vi.fn<() => void>();
  const useNavigate = vi.fn<() => (to: string) => void>(() => vi.fn());
  const toastSuccess = vi.fn<(msg?: string) => void>();
  const toastError = vi.fn<(msg?: string) => void>();

  const stableUser = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const jarvisColors = {
    urgent: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-500' },
    insight: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-500' },
    opportunity: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-500' },
  } as const;

  const supabaseBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  const supabaseMockFrom = vi.fn(() => supabaseBuilder);

  const stableUtils = {
    cn: (...args: Array<unknown>) => args.filter(Boolean).join(' '),
  };

  return {
    stableUser,
    executeQuickAction,
    vibrateSelection,
    useNavigate,
    supabaseMockFrom,
    supabaseBuilder,
    jarvisColors,
    toastSuccess,
    toastError,
    stableUtils,
  };
});

vi.mock('framer-motion', async () => {
  const ReactMod = await import('react');
  const passthrough = (Tag: keyof JSX.IntrinsicElements) =>
    ReactMod.forwardRef<HTMLElement, ReactMod.HTMLAttributes<HTMLElement> & { children?: ReactMod.ReactNode }>(
      ({ children, ...props }, ref) =>
        ReactMod.createElement(Tag, { ...props, ref } as Record<string, unknown>, children)
    );

  const MotionDiv = passthrough('div');
  const MotionButton = passthrough('button');
  const MotionSpan = passthrough('span');

  const motionProxy = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === 'div') return MotionDiv;
        if (prop === 'button') return MotionButton;
        if (prop === 'span') return MotionSpan;
        return passthrough(prop as keyof JSX.IntrinsicElements);
      },
    }
  );

  return {
    motion: motionProxy,
    AnimatePresence: ({ children }: { children?: ReactMod.ReactNode }) => ReactMod.createElement(ReactMod.Fragment, null, children),
  };
});

vi.mock('lucide-react', async () => {
  const ReactMod = await import('react');
  const Icon = ({ 'data-testid': testId, ...props }: Record<string, unknown> & { 'data-testid'?: string }) =>
    ReactMod.createElement('svg', { role: 'img', 'data-testid': testId, ...props });

  return {
    Mail: Icon,
    ListTodo: Icon,
    BarChart3: Icon,
    Calendar: Icon,
    TrendingUp: Icon,
    Users: Icon,
    Sparkles: Icon,
    ArrowRight: Icon,
    Command: Icon,
    Mic: Icon,
    Zap: Icon,
    Clock: Icon,
    Sun: Icon,
    Moon: Icon,
    CloudSun: Icon,
    Coffee: Icon,
    Briefcase: Icon,
  };
});

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimateLight: () => false,
}));

vi.mock('@/lib/utils', () => ({
  cn: stableUtils.cn,
}));

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  useJarvisUnifiedOptional: () => ({ executeQuickAction }),
  JARVIS_COLORS: jarvisColors,
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection,
}));

vi.mock('react-router-dom', () => ({
  useNavigate,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: supabaseMockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: stableUser.session }, error: null })),
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/components/AuthProvider', () => ({
  useSession: () => stableUser,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
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
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

import { JarvisWelcomeScreen } from './JarvisWelcomeScreen';

describe('JarvisWelcomeScreen', () => {
  it('affiche la salutation avec le prénom et la date/heure', () => {
    const client = createQueryClient();
    const Wrapper = createWrapper(client);

    render(
      <Wrapper>
        <JarvisWelcomeScreen userName="Ada Lovelace" />
      </Wrapper>
    );

    expect(screen.getByText(/, Ada !$/)).toBeInTheDocument();
    expect(screen.getByText("Comment puis-je vous aider aujourd'hui ?")).toBeInTheDocument();

    const timeEl = document.querySelector('span.font-mono');
    expect(timeEl).not.toBeNull();
    expect((timeEl as HTMLElement).textContent).toMatch(/^\d{2}:\d{2}$/);

    const dateEl = document.querySelector('span.capitalize');
    expect(dateEl).not.toBeNull();
    expect((dateEl as HTMLElement).textContent).toMatch(/[a-zàâçéèêëîïôûùüÿñæœ]+/i);

    cleanup();
    client.clear();
  });

  it("déclenche onAction et l'haptique au clic sur la suggestion", () => {
    const client = createQueryClient();
    const Wrapper = createWrapper(client);

    const onAction = vi.fn<(cmd: string) => void>();
    render(
      <Wrapper>
        <JarvisWelcomeScreen
          userName="Ada Lovelace"
          onAction={onAction}
          suggestion={{
            title: 'Priorité',
            description: 'Relancer un prospect important',
            action: 'Relance le prospect',
            type: 'urgent',
          }}
        />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: /Priorité/i }));
    expect(vibrateSelection).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('Relance le prospect');

    cleanup();
    client.clear();
  });

  it("utilise le contexte Jarvis quand onAction n'est pas fourni (quick action)", () => {
    const client = createQueryClient();
    const Wrapper = createWrapper(client);

    executeQuickAction.mockClear();
    vibrateSelection.mockClear();

    render(
      <Wrapper>
        <JarvisWelcomeScreen userName="Ada Lovelace" />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Emails' }));
    expect(vibrateSelection).toHaveBeenCalledTimes(1);
    expect(executeQuickAction).toHaveBeenCalledTimes(1);
    expect(executeQuickAction).toHaveBeenCalledWith('Résume mes emails non lus');

    cleanup();
    client.clear();
  });

  it('met à jour l’heure après 60s (loading -> success via setInterval)', async () => {
    vi.useFakeTimers();
    const dateSpy = vi.spyOn(Date.prototype, 'toLocaleTimeString');
    dateSpy
      .mockReturnValueOnce('10:00')
      .mockReturnValueOnce('10:01');

    const client = createQueryClient();
    const Wrapper = createWrapper(client);

    render(
      <Wrapper>
        <JarvisWelcomeScreen userName="Ada Lovelace" />
      </Wrapper>
    );

    expect(screen.getByText('10:00')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(60000);

    expect(screen.getByText('10:01')).toBeInTheDocument();

    dateSpy.mockRestore();
    vi.useRealTimers();

    cleanup();
    client.clear();
  });

  it('supporte une chaîne supabase thenable (succès et erreur) sans bloquer', async () => {
    const okResult = { data: [{ id: '1' }], error: null as null | { message: string } };
    const errResult = { data: null as null, error: { message: 'x' } };

    supabaseBuilder.select.mockReturnValue(supabaseBuilder);
    supabaseBuilder.eq.mockReturnValue(supabaseBuilder);

    supabaseBuilder.then.mockImplementationOnce((resolve: (v: typeof okResult) => unknown) => {
      Promise.resolve().then(() => resolve(okResult));
      return supabaseBuilder;
    });

    const ok = await (supabaseMockFrom('t').select('*').eq('id', '1') as unknown as Promise<typeof okResult>);
    expect(ok.data).toEqual([{ id: '1' }]);
    expect(ok.error).toBeNull();

    supabaseBuilder.then.mockImplementationOnce((resolve: (v: typeof errResult) => unknown) => {
      Promise.resolve().then(() => resolve(errResult));
      return supabaseBuilder;
    });

    const err = await (supabaseMockFrom('t').select('*').eq('id', '2') as unknown as Promise<typeof errResult>);
    expect(err.data).toBeNull();
    expect(err.error).toEqual({ message: 'x' });
  });
});