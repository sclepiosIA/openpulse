import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { STATS_FULL, STATS_EMPTY } = vi.hoisted(() => ({
  STATS_FULL: {
    today: 5,
    week: 12,
    month: 30,
    by_user: [
      { user_id: 'u1', name: 'Alice Doe', count: 10 },
      { user_id: 'u2', name: 'Bob Smith', count: 5 },
      { user_id: 'u3', name: 'C C', count: 3 },
      { user_id: 'u4', name: 'Dan', count: 1 },
    ],
  },
  STATS_EMPTY: {
    today: 0,
    week: 0,
    month: 0,
    by_user: [],
  },
}));

vi.mock('@/components/ui/card', () => {
  const Card = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="card" {...props}>{children}</div>;
  const CardContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="card-content" {...props}>{children}</div>;
  return { Card, CardContent };
});

vi.mock('@/components/ui/skeleton', () => {
  const Skeleton = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="skeleton" {...props}>{children}</div>;
  return { Skeleton };
});

vi.mock('@/components/ui/avatar', () => {
  const Avatar = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="avatar" {...props}>{children}</div>;
  const AvatarFallback = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div data-testid="avatar-fallback" {...props}>{children}</div>;
  return { Avatar, AvatarFallback };
});

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg role="img" {...props} />;
  return {
    TrendingUp: Icon,
    CalendarDays: Icon,
    CalendarRange: Icon,
    Sparkles: Icon,
  };
});

vi.mock('@/lib/utils', () => {
  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ');
  return { cn };
});

import { ActivityStatsHeader } from './ActivityStatsHeader';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('ActivityStatsHeader', () => {
  it('renders loading skeletons when isLoading is true', () => {
    const wrapper = createWrapper();
    render(<ActivityStatsHeader stats={STATS_FULL} isLoading />, { wrapper });

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(4);

    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText('Cette semaine')).toBeInTheDocument();
    expect(screen.getByText('Ce mois')).toBeInTheDocument();

    // Ensure KPI numeric values are not rendered during loading
    const todayContainer = screen.getByText("Aujourd'hui").closest('[data-testid="card-content"]') as HTMLElement;
    expect(within(todayContainer).queryByText('5')).toBeNull();

    const weekContainer = screen.getByText('Cette semaine').closest('[data-testid="card-content"]') as HTMLElement;
    expect(within(weekContainer).queryByText('12')).toBeNull();

    const monthContainer = screen.getByText('Ce mois').closest('[data-testid="card-content"]') as HTMLElement;
    expect(within(monthContainer).queryByText('30')).toBeNull();

    expect(screen.getByText('Top contributeurs (semaine)')).toBeInTheDocument();
  });

  it('renders KPI values and top contributors with correct widths and initials', () => {
    const wrapper = createWrapper();
    render(<ActivityStatsHeader stats={STATS_FULL} />, { wrapper });

    // KPI labels
    const todayLabel = screen.getByText("Aujourd'hui");
    const weekLabel = screen.getByText('Cette semaine');
    const monthLabel = screen.getByText('Ce mois');

    // KPI values within their respective cards (avoid global numeric collisions)
    const todayContainer = todayLabel.closest('[data-testid="card-content"]') as HTMLElement;
    expect(within(todayContainer).getByText('5')).toBeInTheDocument();

    const weekContainer = weekLabel.closest('[data-testid="card-content"]') as HTMLElement;
    expect(within(weekContainer).getByText('12')).toBeInTheDocument();

    const monthContainer = monthLabel.closest('[data-testid="card-content"]') as HTMLElement;
    expect(within(monthContainer).getByText('30')).toBeInTheDocument();

    // Top contributors header
    expect(screen.getByText('Top contributeurs (semaine)')).toBeInTheDocument();

    // Names present (top 3 only)
    const aliceName = screen.getByText('Alice Doe');
    const bobName = screen.getByText('Bob Smith');
    const cName = screen.getByText('C C');
    expect(screen.queryByText('Dan')).toBeNull();

    // Initials for Alice
    expect(screen.getByText('AD')).toBeInTheDocument();

    // Counts next to names and bar widths
    // Alice
    const aliceRow = aliceName.parentElement as HTMLElement; // div: names and counts
    const aliceCountEl = aliceRow.querySelector('span.font-semibold.tabular-nums') as HTMLElement;
    expect(aliceCountEl).toBeTruthy();
    expect(aliceCountEl.textContent).toBe('10');
    const aliceProgressContainer = aliceRow.nextElementSibling as HTMLElement;
    const aliceBar = aliceProgressContainer.firstElementChild as HTMLElement;
    expect(aliceBar.style.width).toBe('100%');

    // Bob
    const bobRow = bobName.parentElement as HTMLElement;
    const bobCountEl = bobRow.querySelector('span.font-semibold.tabular-nums') as HTMLElement;
    expect(bobCountEl).toBeTruthy();
    expect(bobCountEl.textContent).toBe('5');
    const bobProgressContainer = bobRow.nextElementSibling as HTMLElement;
    const bobBar = bobProgressContainer.firstElementChild as HTMLElement;
    expect(bobBar.style.width).toBe('50%');

    // C C
    const cRow = cName.parentElement as HTMLElement;
    const cCountEl = cRow.querySelector('span.font-semibold.tabular-nums') as HTMLElement;
    expect(cCountEl).toBeTruthy();
    expect(cCountEl.textContent).toBe('3');
    const cProgressContainer = cRow.nextElementSibling as HTMLElement;
    const cBar = cProgressContainer.firstElementChild as HTMLElement;
    expect(cBar.style.width).toBe('30%');
  });

  it('renders empty state message when no contributors this week', () => {
    const wrapper = createWrapper();
    render(<ActivityStatsHeader stats={STATS_EMPTY} />, { wrapper });

    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText('Cette semaine')).toBeInTheDocument();
    expect(screen.getByText('Ce mois')).toBeInTheDocument();

    expect(screen.getByText('Aucune activité cette semaine')).toBeInTheDocument();
  });
});