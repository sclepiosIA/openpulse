/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { JarvisAppleWelcome } from './JarvisAppleWelcome';

const { mockUseLocation, mockVibrateSelection } = vi.hoisted(() => ({
  mockUseLocation: vi.fn(),
  mockVibrateSelection: vi.fn(),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/lib/haptics', () => ({
  vibrateSelection: mockVibrateSelection,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: mockUseLocation,
  };
});

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        React.forwardRef(({ children, ...props }: React.ComponentPropsWithoutRef<'div'>, ref: React.ForwardedRef<HTMLDivElement>) =>
          React.createElement(tag, { ...props, ref }, children)
        ),
    }
  ),
}));

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) => {
    const Icon = (props: React.SVGProps<SVGSVGElement>) =>
      React.createElement('svg', { ...props, 'data-testid': `icon-${name}` });
    Icon.displayName = name;
    return Icon;
  };

  return {
    Mail: makeIcon('Mail'),
    Calendar: makeIcon('Calendar'),
    BarChart2: makeIcon('BarChart2'),
    FileText: makeIcon('FileText'),
    Sparkles: makeIcon('Sparkles'),
    MessageCircle: makeIcon('MessageCircle'),
    CheckCircle2: makeIcon('CheckCircle2'),
    Bell: makeIcon('Bell'),
    TrendingUp: makeIcon('TrendingUp'),
    Users: makeIcon('Users'),
    Zap: makeIcon('Zap'),
    Clock: makeIcon('Clock'),
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
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('JarvisAppleWelcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/' });
  });

  it('affiche le salut du matin avec le prénom et les suggestions dashboard par défaut', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-20T09:00:00'));

    render(<JarvisAppleWelcome userName="Jean Dupont" />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Bonjour, Jean' })).toBeInTheDocument();
    expect(screen.getByText('Comment puis-je vous aider ?')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Briefing du jour/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Emails urgents/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Actions prioritaires/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rapport hebdo/i })).toBeInTheDocument();

    expect(screen.getByText("Posez n'importe quelle question")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('adapte les suggestions au chemin /emails l’après-midi', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-20T14:00:00'));
    mockUseLocation.mockReturnValue({ pathname: '/emails/inbox' });

    render(<JarvisAppleWelcome userName="Marie Curie" />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Bon après-midi, Marie' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Tâches prioritaires/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Réunions à venir/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Non lus/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /À répondre/i })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Actions prioritaires/i })).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('adapte les suggestions au chemin /support le soir', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-20T20:00:00'));
    mockUseLocation.mockReturnValue({ pathname: '/support' });

    render(<JarvisAppleWelcome userName="Alex Martin" />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Bonsoir, Alex' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Bilan de la journée/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Préparer demain/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tickets critiques/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /KPIs support/i })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('déclenche la vibration et envoie le bon prompt au clic sur une suggestion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-20T09:00:00'));
    mockUseLocation.mockReturnValue({ pathname: '/tresorerie' });

    const onSendMessage = vi.fn();

    render(<JarvisAppleWelcome userName="Sophie Leroy" onSendMessage={onSendMessage} />, {
      wrapper: createWrapper(),
    });

    fireEvent.click(screen.getByRole('button', { name: /Factures en retard/i }));

    expect(mockVibrateSelection).toHaveBeenCalledTimes(1);
    expect(onSendMessage).toHaveBeenCalledTimes(1);
    expect(onSendMessage).toHaveBeenCalledWith('Y a-t-il des factures en retard ?');

    vi.useRealTimers();
  });

  it('applique la className personnalisée sur le conteneur racine', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-20T09:00:00'));

    const { container } = render(<JarvisAppleWelcome className="custom-shell" />, {
      wrapper: createWrapper(),
    });

    expect(container.firstChild).toHaveClass('custom-shell');
    expect(container.firstChild).toHaveClass('min-h-[60vh]');

    vi.useRealTimers();
  });

  it('utilise le nom par défaut Utilisateur quand aucun userName n’est fourni', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-20T09:00:00'));

    render(<JarvisAppleWelcome />, { wrapper: createWrapper() });

    expect(screen.getByRole('heading', { name: 'Bonjour, Utilisateur' })).toBeInTheDocument();

    vi.useRealTimers();
  });
});