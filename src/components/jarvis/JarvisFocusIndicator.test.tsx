import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  stableAuth,
  stableUseJarvisFocusReturn,
  mockUseJarvisFocus,
  mockTogglePin,
  mockClearFocus,
  mockCn,
  mockFrom,
} = vi.hoisted(() => {
  const stableAuth = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const mockTogglePin = vi.fn();
  const mockClearFocus = vi.fn();

  const stableUseJarvisFocusReturn = {
    focusContext: { etablissement_name: 'Clinique Alpha' },
    recentActivities: [
      { entity_id: 'e1', entity_type: 'Dossier' },
      { entity_id: 'e2', entity_type: 'Facture' },
      { entity_id: 'e3', entity_type: 'Patient' },
      { entity_id: 'e4', entity_type: 'Note' },
    ],
    clearFocus: mockClearFocus,
    togglePin: mockTogglePin,
    hasFocus: true,
    currentMode: 'emails' as const,
    isPinned: false,
  };

  const mockUseJarvisFocus = vi.fn(() => stableUseJarvisFocusReturn);

  const mockCn = (...classes: Array<unknown>) => classes.filter(Boolean).join(' ');

  const builder: Record<string, unknown> = {};
  const chainable = [
    'select',
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'order',
    'limit',
    'range',
    'insert',
    'update',
    'upsert',
    'delete',
    'ilike',
    'like',
    'contains',
    'overlaps',
    'match',
  ];
  for (const m of chainable) builder[m] = vi.fn(() => builder);
  builder.single = vi.fn(async () => ({ data: null, error: null }));
  builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  builder.then = vi.fn((onFulfilled?: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled as never),
  );
  builder.catch = vi.fn((onRejected?: (e: unknown) => unknown) => Promise.resolve().catch(onRejected as never));
  const mockFrom = vi.fn(() => builder);

  return {
    stableAuth,
    stableUseJarvisFocusReturn,
    mockUseJarvisFocus,
    mockTogglePin,
    mockClearFocus,
    mockCn,
    mockFrom,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: stableAuth.session }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

vi.mock('@/hooks/jarvis/useJarvisFocus', () => ({
  useJarvisFocus: mockUseJarvisFocus,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label'?: string }) => (
    <button type="button" onClick={onClick} className={className} aria-label={ariaLabel} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => {
  const Icon =
    (name: string) =>
    ({ className }: { className?: string }) => <span data-icon={name} className={className} />;
  return {
    Building2: Icon('Building2'),
    Mail: Icon('Mail'),
    CheckSquare: Icon('CheckSquare'),
    HeadphonesIcon: Icon('HeadphonesIcon'),
    Calendar: Icon('Calendar'),
    Wallet: Icon('Wallet'),
    FlaskConical: Icon('FlaskConical'),
    GraduationCap: Icon('GraduationCap'),
    Globe: Icon('Globe'),
    X: Icon('X'),
    Eye: Icon('Eye'),
    Pin: Icon('Pin'),
    PinOff: Icon('PinOff'),
  };
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

describe('JarvisFocusIndicator', () => {
  it('affiche le mode et le contexte + activités récentes (non-compact)', async () => {
    const { JarvisFocusIndicator } = await import('./JarvisFocusIndicator');
    const Wrapper = createWrapper();

    render(<JarvisFocusIndicator />, { wrapper: Wrapper });

    expect(screen.getByText('Mode Emails')).toBeInTheDocument();
    expect(screen.getByText('Contexte Jarvis')).toBeInTheDocument();
    expect(screen.getByText('Clinique Alpha')).toBeInTheDocument();

    expect(screen.getByText('Récemment consulté')).toBeInTheDocument();
    expect(screen.getByText('Dossier')).toBeInTheDocument();
    expect(screen.getByText('Facture')).toBeInTheDocument();
    expect(screen.getByText('Patient')).toBeInTheDocument();
    expect(screen.queryByText('Note')).not.toBeInTheDocument();

    expect(screen.getByLabelText('Fermer')).toBeInTheDocument();
    expect(screen.getByLabelText('Détacher')).toBeInTheDocument();
  });

  it('déclenche togglePin et clearFocus via les boutons (non-compact)', async () => {
    const { JarvisFocusIndicator } = await import('./JarvisFocusIndicator');
    const Wrapper = createWrapper();
    const user = userEvent.setup();

    mockTogglePin.mockClear();
    mockClearFocus.mockClear();

    render(<JarvisFocusIndicator />, { wrapper: Wrapper });

    await user.click(screen.getByLabelText('Détacher'));
    expect(mockTogglePin).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText('Fermer'));
    expect(mockClearFocus).toHaveBeenCalledTimes(1);
  });

  it("affiche l'état sans focus (message d'aide) quand aucune activité récente", async () => {
    const { JarvisFocusIndicator } = await import('./JarvisFocusIndicator');
    const Wrapper = createWrapper();

    mockUseJarvisFocus.mockImplementationOnce(() => ({
      ...stableUseJarvisFocusReturn,
      focusContext: { etablissement_name: '' },
      recentActivities: [],
      hasFocus: false,
      currentMode: 'general' as const,
      isPinned: false,
    }));

    render(<JarvisFocusIndicator />, { wrapper: Wrapper });

    expect(screen.getByText('Mode Général')).toBeInTheDocument();
    expect(screen.getByText("Jarvis s'adapte automatiquement à votre contexte de travail")).toBeInTheDocument();
    expect(screen.queryByText('Récemment consulté')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Fermer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Détacher')).not.toBeInTheDocument();
  });

  it('compact: affiche tooltip avec label et établissement + indicateurs pin et focus', async () => {
    const { JarvisFocusIndicator } = await import('./JarvisFocusIndicator');
    const Wrapper = createWrapper();

    mockUseJarvisFocus.mockImplementationOnce(() => ({
      ...stableUseJarvisFocusReturn,
      hasFocus: true,
      isPinned: true,
      currentMode: 'crm' as const,
      focusContext: { etablissement_name: 'Cabinet Beta' },
    }));

    render(<JarvisFocusIndicator compact />, { wrapper: Wrapper });

    expect(screen.getByText('CRM (épinglé)')).toBeInTheDocument();
    expect(screen.getByText('Cabinet Beta')).toBeInTheDocument();

    const pinIcons = screen.getAllByTestId ? [] : [];
    expect(screen.getAllByText((_, el) => (el as HTMLElement)?.getAttribute?.('data-icon') === 'Pin').length).toBeGreaterThan(0);

    const containerDots = document.querySelectorAll('.h-2.w-2.rounded-full.bg-primary');
    expect(containerDots.length).toBe(1);
  });
});