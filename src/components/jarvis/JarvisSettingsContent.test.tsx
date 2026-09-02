import React from 'react';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  AUTH_STATE,
  PREFS_BASE,
  useAuthMock,
  useJarvisPreferencesMock,
  updatePreferencesMock,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const PREFS_BASE = {
    enabled: true,
    proactive_mode: false,
    voice_enabled: true,
    wake_word: 'Jarvis',
    voice_speed: 1.2,
    notification_frequency: 'immediate' as const,
    quiet_hours_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    confidence_threshold: 0.88,
    auto_approve_above: 0.96,
    include_sources: true,
  };

  const updatePreferencesMock = vi.fn();
  const useAuthMock = vi.fn(() => AUTH_STATE);
  const useJarvisPreferencesMock = vi.fn(() => ({
    preferences: PREFS_BASE,
    updatePreferences: updatePreferencesMock,
    isUpdating: false,
    isLoading: false,
  }));

  return {
    AUTH_STATE,
    PREFS_BASE,
    useAuthMock,
    useJarvisPreferencesMock,
    updatePreferencesMock,
  };
});

const { mockFrom, supabaseBuilder } = vi.hoisted(() => {
  type SBResult = { data: unknown; error: null | { message: string } };

  const state: {
    result: SBResult;
  } = {
    result: { data: null, error: null },
  };

  const builder: Record<string, unknown> = {
    __setResult: (result: SBResult) => {
      state.result = result;
      return builder;
    },
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
    single: vi.fn(async () => state.result),
    maybeSingle: vi.fn(async () => state.result),
    then: (onFulfilled?: (value: SBResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(state.result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) => Promise.resolve(state.result).catch(onRejected),
    finally: (onFinally?: () => void) => Promise.resolve(state.result).finally(onFinally),
  };

  const mockFrom = vi.fn(() => builder);

  return { mockFrom, supabaseBuilder: builder };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: useAuthMock,
}));

vi.mock('@/hooks/jarvis/useJarvisPreferences', () => ({
  useJarvisPreferences: useJarvisPreferencesMock,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('framer-motion', () => {
  const React = require('react') as typeof import('react');
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          const Comp = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) =>
            React.createElement(prop === 'div' ? 'div' : 'div', { ...props, ref })
          );
          Comp.displayName = `motion.${prop}`;
          return Comp;
        },
      }
    ),
  };
});

vi.mock('lucide-react', () => {
  const React = require('react') as typeof import('react');
  const Icon = (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...props });
  return {
    Settings: Icon,
    Bell: Icon,
    Mic: Icon,
    Clock: Icon,
    Zap: Icon,
    Shield: Icon,
    Loader2: Icon,
  };
});

vi.mock('@/components/ui/scroll-area', () => {
  const React = require('react') as typeof import('react');
  return {
    ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) =>
      React.createElement('div', { 'data-testid': 'scroll-area', className }, children),
  };
});

vi.mock('@/components/ui/separator', () => {
  const React = require('react') as typeof import('react');
  return {
    Separator: ({ className }: { className?: string }) => React.createElement('hr', { className, 'data-testid': 'separator' }),
  };
});

vi.mock('@/components/ui/label', () => {
  const React = require('react') as typeof import('react');
  return {
    Label: ({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) =>
      React.createElement('label', { htmlFor, className }, children),
  };
});

vi.mock('@/components/ui/switch', () => {
  const React = require('react') as typeof import('react');
  return {
    Switch: ({
      id,
      checked,
      disabled,
      onCheckedChange,
    }: {
      id?: string;
      checked?: boolean;
      disabled?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }) =>
      React.createElement('button', {
        type: 'button',
        id,
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        disabled,
        onClick: () => onCheckedChange?.(!checked),
      }),
  };
});

vi.mock('@/components/ui/slider', () => {
  const React = require('react') as typeof import('react');
  return {
    Slider: ({
      value,
      min,
      max,
      step,
      disabled,
      onValueChange,
    }: {
      value: number[];
      min?: number;
      max?: number;
      step?: number;
      disabled?: boolean;
      onValueChange?: (value: number[]) => void;
    }) =>
      React.createElement('input', {
        type: 'range',
        role: 'slider',
        disabled,
        min,
        max,
        step,
        value: Array.isArray(value) ? value[0] : value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.([Number(e.target.value)]),
      }),
  };
});

vi.mock('@/components/ui/select', () => {
  const React = require('react') as typeof import('react');

  type Ctx = {
    value?: string;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
  };

  const SelectCtx = React.createContext<Ctx>({});

  const Select = ({
    value,
    disabled,
    onValueChange,
    children,
  }: {
    value?: string;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) => React.createElement(SelectCtx.Provider, { value: { value, disabled, onValueChange } }, children);

  const SelectTrigger = ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('div', { className, 'data-testid': 'select-trigger' }, children);

  const SelectValue = () => {
    const ctx = React.useContext(SelectCtx);
    return React.createElement('span', { 'data-testid': 'select-value' }, ctx.value ?? '');
  };

  const SelectContent = ({ children }: { children: React.ReactNode }) => React.createElement('div', { 'data-testid': 'select-content' }, children);

  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
    const ctx = React.useContext(SelectCtx);
    return React.createElement(
      'button',
      {
        type: 'button',
        disabled: ctx.disabled,
        'data-select-item': value,
        onClick: () => ctx.onValueChange?.(value),
      },
      children
    );
  };

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

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

describe('JarvisSettingsContent', () => {
  it('affiche le chargement puis le contenu avec valeurs métier', async () => {
    useJarvisPreferencesMock.mockImplementationOnce(() => ({
      preferences: null,
      updatePreferences: updatePreferencesMock,
      isUpdating: false,
      isLoading: true,
    }));

    useJarvisPreferencesMock.mockImplementationOnce(() => ({
      preferences: PREFS_BASE,
      updatePreferences: updatePreferencesMock,
      isUpdating: false,
      isLoading: false,
    }));

    const { JarvisSettingsContent } = await import('./JarvisSettingsContent');

    const Wrapper = createWrapper();
    const { rerender } = render(<JarvisSettingsContent />, { wrapper: Wrapper });

    expect(document.querySelector('svg.animate-spin')).toBeTruthy();

    rerender(<JarvisSettingsContent />);

    expect(screen.getByText('Paramètres Jarvis')).toBeTruthy();
    expect(screen.getByText('Configurez le comportement de votre assistant IA')).toBeTruthy();

    const enabledSwitch = screen.getByRole('switch', { name: /Jarvis activé/i });
    expect(enabledSwitch.getAttribute('aria-checked')).toBe('true');

    const proactiveSwitch = screen.getByRole('switch', { name: /Mode proactif/i });
    expect(proactiveSwitch.getAttribute('aria-checked')).toBe('false');

    const voiceSwitch = screen.getByRole('switch', { name: /Commandes vocales/i });
    expect(voiceSwitch.getAttribute('aria-checked')).toBe('true');

    expect(screen.getByText("Mot d'activation")).toBeTruthy();
    expect(screen.getAllByTestId('select-value')[0]?.textContent).toBe('Jarvis');

    expect(screen.getByText('Vitesse de la voix')).toBeTruthy();
    expect(screen.getByText('1.2x')).toBeTruthy();

    expect(screen.getByText('Fréquence des notifications')).toBeTruthy();

    const quietSwitch = screen.getByRole('switch', { name: /Activer les heures de silence/i });
    expect(quietSwitch.getAttribute('aria-checked')).toBe('true');

    expect(screen.getByText('Début')).toBeTruthy();
    expect(screen.getByText('Fin')).toBeTruthy();

    expect(screen.getByText('Seuil de confiance minimum')).toBeTruthy();
    expect(screen.getByText('88%')).toBeTruthy();

    expect(screen.getByText('Auto-approbation au-dessus de')).toBeTruthy();
    expect(screen.getByText('96%')).toBeTruthy();

    const sourcesSwitch = screen.getByRole('switch', { name: /Inclure les sources/i });
    expect(sourcesSwitch.getAttribute('aria-checked')).toBe('true');
  });

  it("déclenche une mutation via Switch (updatePreferences appelée avec l'objet attendu)", async () => {
    useJarvisPreferencesMock.mockImplementationOnce(() => ({
      preferences: PREFS_BASE,
      updatePreferences: updatePreferencesMock,
      isUpdating: false,
      isLoading: false,
    }));

    const { JarvisSettingsContent } = await import('./JarvisSettingsContent');

    const Wrapper = createWrapper();
    render(<JarvisSettingsContent />, { wrapper: Wrapper });

    const proactiveSwitch = screen.getByRole('switch', { name: /Mode proactif/i });
    expect(proactiveSwitch.getAttribute('aria-checked')).toBe('false');

    await act(async () => {
      fireEvent.click(proactiveSwitch);
    });

    expect(updatePreferencesMock).toHaveBeenCalled();
    expect(updatePreferencesMock).toHaveBeenCalledWith({ proactive_mode: true });
  });

  it("affiche l'état erreur si les préférences ne chargent pas", async () => {
    useJarvisPreferencesMock.mockImplementationOnce(() => ({
      preferences: null,
      updatePreferences: updatePreferencesMock,
      isUpdating: false,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    }));

    const { JarvisSettingsContent } = await import('./JarvisSettingsContent');

    const Wrapper = createWrapper();
    render(<JarvisSettingsContent />, { wrapper: Wrapper });

    expect(screen.getByText('Impossible de charger les préférences')).toBeTruthy();
  });

  it('builder supabase thenable: peut être await sans recréer de références', async () => {
    supabaseBuilder.__setResult({ data: { ok: true }, error: null });
    const result = await (mockFrom('table') as unknown as Promise<{ data: unknown; error: unknown }>);
    expect(mockFrom).toHaveBeenCalledWith('table');
    expect((result as { data: { ok: boolean } }).data.ok).toBe(true);
  });
});