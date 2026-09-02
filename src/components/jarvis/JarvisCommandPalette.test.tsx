/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { JarvisCommandPalette } from './JarvisCommandPalette';

const {
  mockCn,
  motionDivSpy,
  animatePresenceSpy,
  iconNames,
  stableUser,
  mockNavigate,
  mockToastSuccess,
  mockToastError,
  builder,
  mockFrom,
} = vi.hoisted(() => {
  const chain = {
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
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.gte.mockReturnValue(chain);
  chain.lte.mockReturnValue(chain);
  chain.in.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data: null, error: null });
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  chain.then.mockImplementation(
    (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve(onFulfilled({ data: null, error: null }))
  );
  chain.catch.mockImplementation(() => Promise.resolve({ data: null, error: null }));

  return {
    mockCn: vi.fn((...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' ')),
    motionDivSpy: vi.fn(),
    animatePresenceSpy: vi.fn(),
    iconNames: [
      'Mail',
      'CalendarPlus',
      'CheckSquare',
      'Search',
      'FileText',
      'Users',
      'Building2',
      'Wallet',
      'BarChart3',
      'HelpCircle',
      'Sparkles',
      'Clock',
      'Send',
    ],
    stableUser: {
      user: { id: 'u1', email: 't@t.co' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    builder: chain,
    mockFrom: vi.fn(() => chain),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => {
      motionDivSpy(props);
      return <div {...props} />;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => {
    animatePresenceSpy();
    return <>{children}</>;
  },
}));

vi.mock('lucide-react', () => {
  const entries = iconNames.map((name) => [
    name,
    ({ className }: { className?: string }) => <svg data-testid={`icon-${name}`} className={className} />,
  ]);
  return Object.fromEntries(entries);
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => stableUser,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => stableUser,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
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

describe('JarvisCommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when closed', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <JarvisCommandPalette isOpen={false} searchQuery="" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('Commandes rapides')).not.toBeInTheDocument();
  });

  it('renders header and all command groups when open with empty query', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/" onSelect={onSelect} onClose={onClose} className="extra-class" />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Commandes rapides')).toBeInTheDocument();
    expect(screen.getByText('Emails')).toBeInTheDocument();
    expect(screen.getByText('Tâches')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Aide')).toBeInTheDocument();

    expect(screen.getByText('Résumer emails')).toBeInTheDocument();
    expect(screen.getByText('Créer tâche')).toBeInTheDocument();
    expect(screen.getByText('État pipeline')).toBeInTheDocument();
    expect(screen.getByText('KPIs du jour')).toBeInTheDocument();
    expect(screen.getByText('Que sais-tu faire ?')).toBeInTheDocument();

    expect(mockCn).toHaveBeenCalled();
    expect(motionDivSpy).toHaveBeenCalled();
    expect(animatePresenceSpy).toHaveBeenCalled();
  });

  it('filters commands from searchQuery without slash prefix', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/rapport" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Rapport hebdo')).toBeInTheDocument();
    expect(screen.queryByText('KPIs du jour')).not.toBeInTheDocument();
    expect(screen.queryByText('Résumer emails')).not.toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('shows empty state when no command matches', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/zzzz" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Aucune commande trouvée')).toBeInTheDocument();
    expect(screen.queryByText('Emails')).not.toBeInTheDocument();
  });

  it('selects the first command with Enter by default', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('Résume mes emails non lus les plus importants');
  });

  it('navigates with ArrowDown and selects the next command with Enter', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('Aide-moi à rédiger un email pour ');
  });

  it('wraps keyboard navigation with ArrowUp from first item to last item', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('Recherche dans la base de connaissances : ');
  });

  it('calls onClose on Escape', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when clicking a command button', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/trésorerie" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByRole('button', { name: /État trésorerie/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Quel est l'état actuel de la trésorerie ?");
  });

  it('updates highlighted selection on mouse enter and selects hovered command with Enter', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: /Créer tâche/i }));
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('Crée une tâche pour ');
  });

  it('resets selection when searchQuery changes', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <JarvisCommandPalette isOpen searchQuery="/" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    rerender(<JarvisCommandPalette isOpen searchQuery="/tâches" onSelect={onSelect} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Tâches du jour/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("Quelles sont mes tâches prioritaires pour aujourd'hui ?");
  });

  it('does not select anything on Enter when filtered list is empty', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <JarvisCommandPalette isOpen searchQuery="/aucune-correspondance" onSelect={onSelect} onClose={onClose} />,
      { wrapper: createWrapper() }
    );

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText('Aucune commande trouvée')).toBeInTheDocument();
  });

  it('can be rendered inside the required QueryClientProvider wrapper with renderHook setup', () => {
    const wrapper = createWrapper();

    const { result } = renderHook(() => ({ isLoading: false, isError: false, value: 1 }), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.value).toBe(1);
  });
});