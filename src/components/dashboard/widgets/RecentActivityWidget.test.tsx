/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecentActivityWidget } from './RecentActivityWidget';

const {
  FEED_ITEMS,
  EMPTY_ITEMS,
  AUTH_STATE,
  mockUseGlobalActivityFeed,
  mockNavigate,
} = vi.hoisted(() => ({
  FEED_ITEMS: [
    {
      id: 'a1',
      actor_name: 'Jean Dupont',
      etablissement_nom: 'Clinique Paris',
      title: 'a créé un dossier patient',
      occurred_at: '2024-01-01T10:00:00.000Z',
      icon: 'Activity',
      color: 'gray',
      link: '/activite/a1',
    },
    {
      id: 'a2',
      actor_name: 'Marie Curie',
      etablissement_nom: null,
      title: 'a validé une demande',
      occurred_at: '2024-01-02T12:00:00.000Z',
      icon: 'Bell',
      color: 'blue',
      link: null,
    },
  ],
  EMPTY_ITEMS: [],
  AUTH_STATE: {
    user: { id: 'u1', email: 'user@test.local' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  mockUseGlobalActivityFeed: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const ReactRouterDom = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...ReactRouterDom,
    Link: ({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) => (
      <a href={to} className={className}>
        {children}
      </a>
    ),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date: Date) => `il y a ${date.toISOString().slice(0, 10)}`),
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

vi.mock('lucide-react', () => {
  const React = require('react') as typeof import('react');
  const Icon = ({ className }: { className?: string }) => React.createElement('svg', { 'data-testid': 'icon', className });
  return {
    Activity: Icon,
    ArrowRight: Icon,
    Bell: Icon,
  };
});

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card" className={className}>{children}</div>,
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-header" className={className}>{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-title" className={className}>{children}</div>,
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="card-content" className={className}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    asChild,
    className,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
    className?: string;
  }) => {
    if (asChild) return <>{children}</>;
    return <button className={className}>{children}</button>;
  },
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => <div data-testid="avatar" className={className}>{children}</div>,
  AvatarFallback: ({ children, className }: { children: React.ReactNode; className?: string }) => <span data-testid="avatar-fallback" className={className}>{children}</span>,
}));

vi.mock('@/hooks/activity/useGlobalActivityFeed', () => ({
  useGlobalActivityFeed: mockUseGlobalActivityFeed,
}));

vi.mock('@/components/activity/ActivityFeedSkeleton', () => ({
  ActivityFeedSkeleton: ({ count }: { count: number }) => <div data-testid="activity-skeleton">skeleton-{count}</div>,
}));

vi.mock('@/types/activity', () => ({
  ACTIVITY_COLOR_CLASSES: {
    gray: 'bg-gray text-gray',
    blue: 'bg-blue text-blue',
  },
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => AUTH_STATE,
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

describe('RecentActivityWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le skeleton pendant le chargement', () => {
    mockUseGlobalActivityFeed.mockReturnValue({
      items: EMPTY_ITEMS,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<RecentActivityWidget />, { wrapper: createWrapper() });

    expect(mockUseGlobalActivityFeed).toHaveBeenCalledWith({ pageSize: 10 });
    expect(screen.getByText('Activité récente')).toBeInTheDocument();
    expect(screen.getByTestId('activity-skeleton')).toHaveTextContent('skeleton-4');
    expect(screen.queryByText('Aucune activité récente')).not.toBeInTheDocument();
  });

  it('affiche les activités avec les valeurs métier attendues', () => {
    mockUseGlobalActivityFeed.mockReturnValue({
      items: FEED_ITEMS,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<RecentActivityWidget />, { wrapper: createWrapper() });

    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('· Clinique Paris')).toBeInTheDocument();
    expect(screen.getByText('a créé un dossier patient')).toBeInTheDocument();
    expect(screen.getByText('Marie Curie')).toBeInTheDocument();
    expect(screen.getByText('a validé une demande')).toBeInTheDocument();
    expect(screen.getByText('il y a 2024-01-01')).toBeInTheDocument();
    expect(screen.getByText('il y a 2024-01-02')).toBeInTheDocument();

    expect(screen.getByText('Voir tout').closest('a')).toHaveAttribute('href', '/activite');
    expect(screen.getByText('a créé un dossier patient').closest('a')).toHaveAttribute('href', '/activite/a1');

    const initials = screen.getAllByTestId('avatar-fallback').map((node) => node.textContent);
    expect(initials).toContain('JD');
    expect(initials).toContain('MC');
  });

  it('affiche le message vide quand aucune activité n’est disponible', () => {
    mockUseGlobalActivityFeed.mockReturnValue({
      items: EMPTY_ITEMS,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<RecentActivityWidget />, { wrapper: createWrapper() });

    expect(screen.getByText('Aucune activité récente')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-skeleton')).not.toBeInTheDocument();
  });

  it('en cas d’erreur du hook, rend l’état vide sans bloquer le composant', () => {
    mockUseGlobalActivityFeed.mockReturnValue({
      items: EMPTY_ITEMS,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    });

    render(<RecentActivityWidget />, { wrapper: createWrapper() });

    expect(screen.getByText('Activité récente')).toBeInTheDocument();
    expect(screen.getByText('Aucune activité récente')).toBeInTheDocument();
    expect(mockUseGlobalActivityFeed).toHaveBeenCalledWith({ pageSize: 10 });
  });
});