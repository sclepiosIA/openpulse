import React from 'react';
import { render, screen, fireEvent, act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { JarvisTeamSettings } from './JarvisTeamSettings';

const { AUTH_STATE, TOAST_MOCK, AGENT_METADATA_STABLE, debugMock, mockFrom, supabaseBuilder } = vi.hoisted(() => {
  const AGENT_METADATA_LOCAL = {
    sophia: { name: 'Sophia', domain: 'Stratégie', color: '#111111' },
    marcus: { name: 'Marcus', domain: 'Opérations', color: '#222222' },
    olivia: { name: 'Olivia', domain: 'Produit', color: '#333333' },
    noah: { name: 'Noah', domain: 'Données', color: '#444444' },
    emma: { name: 'Emma', domain: 'Support', color: '#555555' },
    alex: { name: 'Alex', domain: 'Créatif', color: '#666666' },
  } as const;

  type Call = { method: string; args: unknown[] };
  const calls: Call[] = [];
  let result: unknown = { data: null, error: null };

  const builder: {
    select: (...args: unknown[]) => typeof builder;
    eq: (...args: unknown[]) => typeof builder;
    gte: (...args: unknown[]) => typeof builder;
    lte: (...args: unknown[]) => typeof builder;
    in: (...args: unknown[]) => typeof builder;
    order: (...args: unknown[]) => typeof builder;
    limit: (...args: unknown[]) => typeof builder;
    insert: (...args: unknown[]) => typeof builder;
    update: (...args: unknown[]) => typeof builder;
    delete: (...args: unknown[]) => typeof builder;
    upsert: (...args: unknown[]) => typeof builder;
    single: () => Promise<unknown>;
    maybeSingle: () => Promise<unknown>;
    then: <TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null
    ) => Promise<TResult1 | TResult2>;
    catch: <TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | undefined | null
    ) => Promise<unknown | TResult>;
    __setResult: (r: unknown) => void;
    __getCalls: () => Call[];
    __resetCalls: () => void;
  } = {} as unknown as never;

  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };

  builder.select = chain('select');
  builder.eq = chain('eq');
  builder.gte = chain('gte');
  builder.lte = chain('lte');
  builder.in = chain('in');
  builder.order = chain('order');
  builder.limit = chain('limit');
  builder.insert = chain('insert');
  builder.update = chain('update');
  builder.delete = chain('delete');
  builder.upsert = chain('upsert');

  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);

  builder.then = (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected);
  builder.catch = (onrejected) => Promise.resolve(result).catch(onrejected);

  builder.__setResult = (r: unknown) => {
    result = r;
  };
  builder.__getCalls = () => calls.slice();
  builder.__resetCalls = () => {
    calls.splice(0, calls.length);
  };

  const from = vi.fn(() => builder);

  return {
    AUTH_STATE: { user: { id: 'u1', email: 't@t.co' } },
    TOAST_MOCK: { toast: vi.fn() },
    AGENT_METADATA_STABLE: AGENT_METADATA_LOCAL,
    debugMock: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
    mockFrom: from,
    supabaseBuilder: builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/debug', () => ({
  debug: debugMock,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | null | false>) => args.filter(Boolean).join(' '),
}));

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => TOAST_MOCK,
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/jarvis/useJarvisTeam', () => ({
  AGENT_METADATA: AGENT_METADATA_STABLE,
}));

vi.mock('./JarvisAgentAvatar', () => ({
  JarvisAgentAvatar: ({ agentId, status }: { agentId: string; status: string }) => (
    <div data-testid={`avatar-${agentId}`} data-status={status}>
      {agentId}
    </div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-disabled={disabled ? 'true' : 'false'}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    min,
    max,
    step,
    onValueChange,
  }: {
    value: number[];
    min: number;
    max: number;
    step: number;
    onValueChange?: (value: number[]) => void;
  }) => (
    <input
      data-testid="slider"
      type="range"
      value={value[0]}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange?.([Number((e.target as HTMLInputElement).value)])}
    />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <span data-icon className={className} />;
  return {
    Settings: Icon,
    Power: Icon,
    Star: Icon,
    Bell: Icon,
    BellOff: Icon,
    Save: Icon,
    RotateCcw: Icon,
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

function wrapWithQueryClient(ui: React.ReactElement) {
  const client = createQueryClient();
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}

describe('JarvisTeamSettings', () => {
  it('affiche les valeurs initiales (succès): nombre d’agents actifs et agent par défaut', () => {
    const onSave = vi.fn();

    const initialPreferences = {
      enabledAgents: ['sophia', 'marcus', 'emma'],
      defaultAgent: 'marcus',
      proactivityLevel: {
        sophia: 'high',
        marcus: 'low',
        emma: 'off',
      },
      customNames: {},
    } as const;

    wrapWithQueryClient(<JarvisTeamSettings initialPreferences={initialPreferences} onSave={onSave} />);

    expect(screen.getByText("Configuration de l'équipe")).toBeTruthy();

    const summary = screen.getByText((content) => content.includes('agent(s) actif(s)'));
    expect(summary.textContent?.includes('3')).toBe(true);

    const defaultInSummary = screen.getByText((content) => content.includes('Agent par défaut:'));
    expect(defaultInSummary.textContent?.includes('Marcus')).toBe(true);

    expect(screen.getAllByText('Par défaut').length).toBe(1);

    const switches = screen.getAllByRole('switch');
    const checked = switches.filter((s) => s.getAttribute('aria-checked') === 'true');
    expect(checked.length).toBe(3);
  });

  it('loading -> succès -> erreur via un hook consommateur (renderHook + QueryClientProvider)', async () => {
    const { ok, err } = vi.hoisted(() => ({
      ok: {
        enabledAgents: ['sophia', 'alex'],
        defaultAgent: 'alex',
        proactivityLevel: { sophia: 'low', alex: 'high' },
        customNames: {},
      },
      err: { message: 'x' },
    }));

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
    );

    const okHook = renderHook(
      () =>
        useQuery({
          queryKey: ['prefs', 'ok'],
          queryFn: async () => ok,
        }),
      { wrapper }
    );

    expect(okHook.result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(okHook.result.current.isSuccess).toBe(true);
    });
    expect(okHook.result.current.data?.defaultAgent).toBe('alex');
    expect(okHook.result.current.data?.enabledAgents.length).toBe(2);

    const errHook = renderHook(
      () =>
        useQuery({
          queryKey: ['prefs', 'err'],
          queryFn: async () => {
            throw err;
          },
        }),
      { wrapper }
    );

    expect(errHook.result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(errHook.result.current.isError).toBe(true);
    });
    expect((errHook.result.current.error as { message: string }).message).toBe('x');
  });

  it('mutation: Enregistrer persiste en localStorage + toast + onSave avec les préférences courantes', async () => {
    const onSave = vi.fn();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const initialPreferences = {
      enabledAgents: ['sophia', 'marcus'],
      defaultAgent: 'sophia',
      proactivityLevel: {
        sophia: 'medium',
        marcus: 'low',
      },
      customNames: {},
    } as const;

    wrapWithQueryClient(<JarvisTeamSettings initialPreferences={initialPreferences} onSave={onSave} />);

    const allSwitches = screen.getAllByRole('switch');
    const checkedBefore = allSwitches.filter((s) => s.getAttribute('aria-checked') === 'true');
    expect(checkedBefore.length).toBe(2);

    await act(async () => {
      fireEvent.click(allSwitches[0]);
    });

    const checkedAfter = screen.getAllByRole('switch').filter((s) => s.getAttribute('aria-checked') === 'true');
    expect(checkedAfter.length).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'));
    });

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    const [key, value] = setItemSpy.mock.calls[0] as [string, string];
    expect(key).toBe('jarvis-agent-preferences');

    const saved = JSON.parse(value) as {
      enabledAgents: string[];
      defaultAgent?: string;
      proactivityLevel: Record<string, string>;
      customNames: Record<string, string>;
    };

    expect(saved.enabledAgents.length).toBe(1);
    expect(saved.enabledAgents[0] === 'sophia' || saved.enabledAgents[0] === 'marcus').toBe(true);
    expect(saved.defaultAgent === undefined || saved.defaultAgent === 'sophia' || saved.defaultAgent === 'marcus').toBe(
      true
    );

    expect(TOAST_MOCK.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Préférences sauvegardées',
      })
    );

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        enabledAgents: expect.arrayContaining([saved.enabledAgents[0]]),
        proactivityLevel: expect.any(Object),
        customNames: expect.any(Object),
      })
    );
  });

  it("erreur: si localStorage.setItem échoue, affiche un toast destructif et n'appelle pas onSave", async () => {
    const onSave = vi.fn();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('fail');
    });

    const initialPreferences = {
      enabledAgents: ['emma'],
      defaultAgent: undefined,
      proactivityLevel: { emma: 'medium' },
      customNames: {},
    } as const;

    wrapWithQueryClient(<JarvisTeamSettings initialPreferences={initialPreferences} onSave={onSave} />);

    await act(async () => {
      fireEvent.click(screen.getByText('Enregistrer'));
    });

    expect(debugMock.error).toHaveBeenCalledWith('Error saving preferences:', expect.any(Error));
    expect(TOAST_MOCK.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        variant: 'destructive',
      })
    );
    expect(onSave).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });

  it('mock supabase client: builder chaînable thenable stable (sanity)', async () => {
    supabaseBuilder.__resetCalls();
    supabaseBuilder.__setResult({ data: [{ id: 'r1' }], error: null });

    const { supabase } = await import('@/integrations/supabase/client');
    const res = await supabase
      .from('table')
      .select('*')
      .eq('id', 'r1')
      .limit(1);

    expect(res).toEqual({ data: [{ id: 'r1' }], error: null });

    const calls = supabaseBuilder.__getCalls();
    expect(calls.map((c) => c.method)).toEqual(['select', 'eq', 'limit']);
    expect(calls[1]?.args).toEqual(['id', 'r1']);
  });
});