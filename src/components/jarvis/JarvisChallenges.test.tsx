/* @vitest-environment jsdom */

import React from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JarvisChallenges } from './JarvisChallenges';

const {
  TASKS_LOADING,
  TASKS_SUCCESS,
  TASKS_ERROR,
  SCORE_STATE,
  addScoreMock,
  useTachesMock,
  mockFrom,
} = vi.hoisted(() => ({
  TASKS_LOADING: undefined,
  TASKS_SUCCESS: [
    { id: 't1', statut: 'Terminé', priorite: 'high', updated_at: '2099-01-02T10:00:00.000Z', responsable_id: 'r1' },
    { id: 't2', statut: 'Terminé', priorite: 'high', updated_at: '2099-01-03T10:00:00.000Z', responsable_id: 'r2' },
    { id: 't3', statut: 'Terminé', priorite: 'low', updated_at: '2099-01-04T10:00:00.000Z', responsable_id: 'r3' },
    { id: 't4', statut: 'En cours', priorite: 'medium', updated_at: '2099-01-05T10:00:00.000Z', responsable_id: 'r1' },
    { id: 't5', statut: 'À faire', priorite: 'low', updated_at: '2099-01-06T10:00:00.000Z', responsable_id: 'r2' },
    { id: 't6', statut: 'À faire', priorite: 'low', updated_at: '2099-01-07T10:00:00.000Z', responsable_id: 'r3' },
    { id: 't7', statut: 'En cours', priorite: 'low', updated_at: '2099-01-08T10:00:00.000Z', responsable_id: 'r1' },
    { id: 't8', statut: 'À faire', priorite: 'low', updated_at: '2099-01-09T10:00:00.000Z', responsable_id: 'r2' },
    { id: 't9', statut: 'En cours', priorite: 'medium', updated_at: '2099-01-10T10:00:00.000Z', responsable_id: 'r3' },
    { id: 't10', statut: 'À faire', priorite: 'medium', updated_at: '2099-01-11T10:00:00.000Z', responsable_id: 'r1' },
    { id: 't11', statut: 'En cours', priorite: 'high', updated_at: '2099-01-12T10:00:00.000Z', responsable_id: 'r2' },
    { id: 't12', statut: 'À faire', priorite: 'low', updated_at: '2099-01-13T10:00:00.000Z', responsable_id: 'r3' },
  ],
  TASKS_ERROR: null as null | { message: string },
  SCORE_STATE: { currentStreakDays: 7 },
  addScoreMock: vi.fn().mockResolvedValue(undefined),
  useTachesMock: vi.fn(),
  mockFrom: vi.fn(),
}));

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
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };
  mockFrom.mockReturnValue(builder);
  return { supabase: { from: mockFrom } };
});

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value?: number; className?: string }) => (
    <div role="progressbar" aria-valuenow={value ?? 0} className={className} />
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/hooks/jarvis/useJarvisGamification', () => ({
  useJarvisGamification: () => ({
    score: SCORE_STATE,
    addScore: addScoreMock,
  }),
}));

vi.mock('@/hooks/tasks/useTaches', () => ({
  useTaches: () => useTachesMock(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;
  return {
    Trophy: Icon,
    Zap: Icon,
    CheckCircle2: Icon,
    Star: Icon,
    Flame: Icon,
    TrendingUp: Icon,
    Mail: Icon,
    ListTodo: Icon,
    Users: Icon,
    Award: Icon,
  };
});

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function getDateFns() {
  return {
    startOfWeek: (date: Date) => {
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const d = new Date(date);
      d.setDate(date.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d;
    },
    isAfter: (date: Date, compare: Date) => date.getTime() > compare.getTime(),
    parseISO: (value: string) => new Date(value),
  };
}

function useJarvisChallengesViewModel() {
  const score = SCORE_STATE;
  const { data: taches, isLoading, isError, error } = useTachesMock();

  const challenges = React.useMemo(() => {
    if (!taches) {
      return [];
    }

    const { startOfWeek, isAfter, parseISO } = getDateFns();
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 } as unknown as { weekStartsOn: number });

    const weekTasks = taches.filter((t: {
      updated_at?: string;
      statut: string;
      priorite?: string;
      responsable_id?: string;
    }) => {
      const updated = t.updated_at ? parseISO(t.updated_at) : null;
      return updated && isAfter(updated, weekStart);
    });

    const completedThisWeek = weekTasks.filter((t: { statut: string }) => t.statut === 'Terminé').length;
    const highPriorityDone = weekTasks.filter(
      (t: { statut: string; priorite?: string }) => t.statut === 'Terminé' && t.priorite === 'high',
    ).length;
    const totalActive = taches.filter((t: { statut: string }) => t.statut !== 'Terminé').length;
    const uniqueCollabs = new Set(
      weekTasks
        .filter((t: { responsable_id?: string }) => t.responsable_id)
        .map((t: { responsable_id?: string }) => t.responsable_id),
    ).size;

    return [
      {
        id: 'tasks_complete',
        current: Math.min(completedThisWeek, 20),
        completed: completedThisWeek >= 20,
        points: 100,
        target: 20,
      },
      {
        id: 'high_priority',
        current: Math.min(highPriorityDone, 5),
        completed: highPriorityDone >= 5,
        points: 75,
        target: 5,
      },
      {
        id: 'inbox_zero',
        current: Math.min(10, Math.max(0, 10 - totalActive + 10)),
        completed: totalActive <= 10,
        points: 50,
        target: 10,
      },
      {
        id: 'team_collab',
        current: Math.min(uniqueCollabs, 3),
        completed: uniqueCollabs >= 3,
        points: 80,
        target: 3,
      },
    ];
  }, [taches]);

  return {
    score,
    isLoading,
    isError,
    error,
    challenges,
  };
}

describe('JarvisChallenges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTachesMock.mockImplementation(() => ({
      data: TASKS_SUCCESS,
      isLoading: false,
      isError: false,
      error: null,
    }));
  });

  it('expose loading then success through hook wrapper with QueryClientProvider', () => {
    useTachesMock
      .mockImplementationOnce(() => ({
        data: TASKS_LOADING,
        isLoading: true,
        isError: false,
        error: null,
      }))
      .mockImplementation(() => ({
        data: TASKS_SUCCESS,
        isLoading: false,
        isError: false,
        error: null,
      }));

    const { result, rerender } = renderHook(() => useJarvisChallengesViewModel(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.challenges).toHaveLength(0);

    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.score.currentStreakDays).toBe(7);
    expect(result.current.challenges).toHaveLength(4);
    expect(result.current.challenges[0]).toMatchObject({
      id: 'tasks_complete',
      current: 3,
      completed: false,
      points: 100,
      target: 20,
    });
    expect(result.current.challenges[1]).toMatchObject({
      id: 'high_priority',
      current: 2,
      completed: false,
      points: 75,
      target: 5,
    });
    expect(result.current.challenges[2]).toMatchObject({
      id: 'inbox_zero',
      current: 10,
      completed: true,
      points: 50,
      target: 10,
    });
    expect(result.current.challenges[3]).toMatchObject({
      id: 'team_collab',
      current: 3,
      completed: true,
      points: 80,
      target: 3,
    });
  });

  it('renders business values in full mode and allows claiming a completed reward', async () => {
    vi.useFakeTimers();

    render(<JarvisChallenges />, { wrapper: createWrapper() });

    expect(screen.getByText('Challenges de la semaine')).toBeInTheDocument();
    expect(screen.getByText('2/4 complétés • 130/305 pts gagnés')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    expect(screen.getByText('Inbox Zéro')).toBeInTheDocument();
    expect(screen.getByText('Réduisez les tâches actives sous 10')).toBeInTheDocument();
    expect(screen.getAllByText('10/10').length).toBeGreaterThan(0);

    expect(screen.getByText("Esprit d'équipe")).toBeInTheDocument();
    expect(screen.getByText('Collaborez avec 3 membres différents')).toBeInTheDocument();
    expect(screen.getAllByText('3/3').length).toBeGreaterThan(0);

    const buttons = screen.getAllByRole('button', { name: /Réclamer/i });
    expect(buttons).toHaveLength(2);

    await act(async () => {
      buttons[0].click();
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(addScoreMock).toHaveBeenCalledTimes(1);
    expect(addScoreMock).toHaveBeenCalledWith(50, 'Challenge complété');

    vi.useRealTimers();
  });

  it('renders compact mode with the first incomplete challenge and exact progress values', () => {
    render(<JarvisChallenges compact />, { wrapper: createWrapper() });

    expect(screen.getByText('100% Productivité')).toBeInTheDocument();
    expect(screen.getByText('3/20')).toBeInTheDocument();
    expect(screen.getByText('+100pts')).toBeInTheDocument();

    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '15');
  });

  it('exposes error state when task hook returns an error object', () => {
    useTachesMock.mockImplementation(() => ({
      data: TASKS_ERROR,
      isLoading: false,
      isError: true,
      error: { message: 'x' },
    }));

    const { result } = renderHook(() => useJarvisChallengesViewModel(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toEqual({ message: 'x' });
    expect(result.current.challenges).toHaveLength(0);
  });
});