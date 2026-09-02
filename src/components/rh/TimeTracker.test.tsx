import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  toast,
  clockInMutate,
  clockOutMutate,
  useCurrentSessionMock,
  useMyTimeEntriesMock,
  useTeamTimeEntriesMock,
  useElapsedTimerMock,
  useRolePermissionsMock,
  formatElapsedMock,
  formatDurationMock,
  groupByDayMock,
  totalMinutesMock,
  PROFILES_OK,
  TEAM_ENTRIES_WEEK,
  MY_TODAY_ENTRIES,
  supabaseFrom,
  createObjectURLMock,
  revokeObjectURLMock,
} = vi.hoisted(() => {
  const toast = { success: vi.fn(), error: vi.fn() };

  const clockInMutate = vi.fn();
  const clockOutMutate = vi.fn();

  const useCurrentSessionMock = vi.fn();
  const useMyTimeEntriesMock = vi.fn();
  const useTeamTimeEntriesMock = vi.fn();
  const useElapsedTimerMock = vi.fn();
  const useRolePermissionsMock = vi.fn();

  const formatElapsedMock = vi.fn((secs: number) => `ELAPSED:${secs}`);
  const formatDurationMock = vi.fn((mins: number) => `DUR:${mins}`);

  const groupByDayMock = vi.fn((entries: Array<{ clock_in: string }>) => {
    const map: Record<string, Array<{ clock_in: string }>> = {};
    for (const e of entries) {
      const day = new Date(e.clock_in).toISOString().slice(0, 10);
      if (!map[day]) map[day] = [];
      map[day].push(e);
    }
    return map;
  });

  const totalMinutesMock = vi.fn((entries: unknown[], elapsed?: unknown) => {
    const base = Array.isArray(entries) ? entries.length * 30 : 0;
    return elapsed ? base + 5 : base;
  });

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const MY_TODAY_ENTRIES = [
    {
      id: 'te1',
      user_id: 'u1',
      clock_in: `${today}T08:00:00.000Z`,
      clock_out: `${today}T08:30:00.000Z`,
      duration_minutes: 30,
      auto_closed: false,
    },
  ];

  const TEAM_ENTRIES_WEEK = [
    {
      id: 'e1',
      user_id: 'u2',
      clock_in: `${today}T08:00:00.000Z`,
      clock_out: null,
      duration_minutes: null,
      auto_closed: false,
    },
    {
      id: 'e2',
      user_id: 'u3',
      clock_in: `${today}T09:00:00.000Z`,
      clock_out: `${today}T10:00:00.000Z`,
      duration_minutes: 60,
      auto_closed: false,
    },
    {
      id: 'e3',
      user_id: 'u3',
      clock_in: `${today}T11:00:00.000Z`,
      clock_out: `${today}T11:30:00.000Z`,
      duration_minutes: 30,
      auto_closed: false,
    },
  ];

  const PROFILES_OK = [
    { id: 'p1', user_id: 'u2', prenom: 'Alex', nom: 'Martin' },
    { id: 'p2', user_id: 'u3', prenom: 'Sam', nom: 'Durand' },
  ];

  const supabaseFrom = vi.fn();

  const createObjectURLMock = vi.fn(() => 'blob:mock');
  const revokeObjectURLMock = vi.fn(() => undefined);

  return {
    toast,
    clockInMutate,
    clockOutMutate,
    useCurrentSessionMock,
    useMyTimeEntriesMock,
    useTeamTimeEntriesMock,
    useElapsedTimerMock,
    useRolePermissionsMock,
    formatElapsedMock,
    formatDurationMock,
    groupByDayMock,
    totalMinutesMock,
    PROFILES_OK,
    TEAM_ENTRIES_WEEK,
    MY_TODAY_ENTRIES,
    supabaseFrom,
    createObjectURLMock,
    revokeObjectURLMock,
  };
});

vi.mock('sonner', () => ({ toast }));

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<unknown>) => args.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => ({
  Play: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { 'data-icon': 'Play', ...props }),
  Square: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { 'data-icon': 'Square', ...props }),
  Clock: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { 'data-icon': 'Clock', ...props }),
  Download: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { 'data-icon': 'Download', ...props }),
  User: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { 'data-icon': 'User', ...props }),
  Circle: (props: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { 'data-icon': 'Circle', ...props }),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('div', props, children),
  CardContent: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('div', props, children),
  CardHeader: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('div', props, children),
  CardTitle: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('h2', props, children),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => React.createElement('button', { type: 'button', onClick, ...props }, children),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('span', props, children),
}));

vi.mock('@/components/ui/tabs', () => {
  const Tabs = ({
    value,
    onValueChange,
    children,
    ...props
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) =>
    React.createElement('div', { ...props, 'data-tabs-value': value, 'data-has-onchange': Boolean(onValueChange) }, children);

  const TabsList = ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('div', props, children);

  const TabsTrigger = ({
    value,
    children,
    ...props
  }: {
    value: string;
    children?: React.ReactNode;
  }) => React.createElement('button', { type: 'button', 'data-tabs-trigger': value, ...props }, children);

  return { Tabs, TabsList, TabsTrigger };
});

vi.mock('@/components/ui/table', () => ({
  Table: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('table', props, children),
  TableBody: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('tbody', props, children),
  TableCell: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('td', props, children),
  TableHead: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('th', props, children),
  TableHeader: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('thead', props, children),
  TableRow: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('tr', props, children),
}));

vi.mock('@/hooks/auth/useRolePermissions', () => ({
  useRolePermissions: () => useRolePermissionsMock(),
}));

vi.mock('@/hooks/hr/useTimeTracking', () => ({
  useCurrentSession: () => useCurrentSessionMock(),
  useClockIn: () => ({ mutate: clockInMutate, isPending: false }),
  useClockOut: () => ({ mutate: clockOutMutate, isPending: false }),
  useMyTimeEntries: (range: string) => useMyTimeEntriesMock(range),
  useTeamTimeEntries: (range: string) => useTeamTimeEntriesMock(range),
  useElapsedTimer: (clockIn: string | null) => useElapsedTimerMock(clockIn),
  formatElapsed: (secs: number) => formatElapsedMock(secs),
  formatDuration: (mins: number) => formatDurationMock(mins),
  groupByDay: (entries: Array<{ clock_in: string }>) => groupByDayMock(entries),
  totalMinutes: (entries: unknown[], elapsed?: unknown) => totalMinutesMock(entries, elapsed),
}));

type SupabaseError = { message: string };
type SupabaseResult<T> = { data: T | null; error: SupabaseError | null };
type SupabaseResponse<T> = Promise<SupabaseResult<T>>;

function createSupabaseBuilder<T>(response: SupabaseResponse<T>) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;

  const methods = [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
    'match',
  ] as const;

  for (const m of methods) builder[m] = vi.fn(chain);

  builder.single = vi.fn(() => response);
  builder.maybeSingle = vi.fn(() => response);
  builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    (response as Promise<unknown>).then(onFulfilled, onRejected);
  builder.catch = (onRejected?: (e: unknown) => unknown) => (response as Promise<unknown>).catch(onRejected);

  return builder as unknown as {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    match: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise<unknown>;
    catch: (onRejected?: (e: unknown) => unknown) => Promise<unknown>;
  };
}

let profilesResponse: SupabaseResponse<typeof PROFILES_OK>;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => supabaseFrom(table),
  },
}));

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const client = makeClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('TimeTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLMock, configurable: true, writable: true });
    } else {
      Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLMock, configurable: true, writable: true });
    }

    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLMock, configurable: true, writable: true });
    } else {
      Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLMock, configurable: true, writable: true });
    }

    profilesResponse = Promise.resolve({ data: PROFILES_OK, error: null });

    supabaseFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return createSupabaseBuilder(profilesResponse);
      return createSupabaseBuilder(Promise.resolve({ data: [], error: null }));
    });

    useRolePermissionsMock.mockReturnValue({
      canViewAllTeamMembers: true,
      isAdmin: false,
      role: 'manager',
    });

    useCurrentSessionMock.mockReturnValue({ data: null, isLoading: false });

    useElapsedTimerMock.mockReturnValue(42);

    useMyTimeEntriesMock.mockImplementation((range: string) => {
      if (range === 'today') return { data: MY_TODAY_ENTRIES };
      if (range === 'week') return { data: MY_TODAY_ENTRIES };
      if (range === 'month') return { data: MY_TODAY_ENTRIES };
      return { data: [] };
    });

    useTeamTimeEntriesMock.mockImplementation((range: string) => {
      if (range === 'week') return { data: TEAM_ENTRIES_WEEK };
      return { data: [] };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche un état "chargement" (session) et désactive le bouton de pointage', async () => {
    useCurrentSessionMock.mockReturnValue({ data: null, isLoading: true });

    const mod = await import('./TimeTracker');
    renderWithClient(<mod.TimeTracker />);

    const btn = screen.getByRole('button', { name: 'Démarrer le pointage' });
    expect(btn).toBeDisabled();
  });

  it('succès: affiche minuteurs + dashboard équipe + export CSV et appels attendus', async () => {
    const clickSpy = vi.fn();

    const origCreate = document.createElement.bind(document);
    const createElSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreate(tagName);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy, configurable: true });
      }
      return el;
    });

    const mod = await import('./TimeTracker');
    renderWithClient(<mod.TimeTracker />);

    expect(await screen.findByText('Semaine en cours')).toBeTruthy();
    expect(screen.getByText('Temps de travail — Équipe')).toBeTruthy();

    expect(screen.getByText('00:00:00')).toBeTruthy();
    expect(screen.getByText('Cliquez pour démarrer')).toBeTruthy();

    const summary = screen.getAllByText('DUR:30');
    expect(summary.length).toBeGreaterThanOrEqual(1);

    expect(await screen.findByText('Alex Martin')).toBeTruthy();
    expect(screen.getByText('Sam Durand')).toBeTruthy();
    expect(screen.getAllByText('En ligne').length).toBe(1);
    expect(screen.getAllByText('Hors ligne').length).toBe(1);

    const csvBtn = screen.getByRole('button', { name: 'CSV' });
    fireEvent.click(csvBtn);

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('Export CSV téléchargé');
      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock');
    });

    createElSpy.mockRestore();
  });

  it('mutation: clic sur "Démarrer le pointage" déclenche clockIn.mutate(undefined, callbacks) et toast success au callback', async () => {
    useCurrentSessionMock.mockReturnValue({ data: null, isLoading: false });

    const mod = await import('./TimeTracker');
    renderWithClient(<mod.TimeTracker />);

    const btn = screen.getByRole('button', { name: 'Démarrer le pointage' });

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(clockInMutate).toHaveBeenCalledTimes(1);
    const call = clockInMutate.mock.calls[0];
    expect(call[0]).toBeUndefined();
    expect(typeof call[1]).toBe('object');

    const opts = call[1] as { onSuccess?: () => void; onError?: () => void };
    expect(typeof opts.onSuccess).toBe('function');
    expect(typeof opts.onError).toBe('function');

    opts.onSuccess?.();
    expect(toast.success).toHaveBeenCalledWith('Session démarrée');
  });

  it("erreur: la requête profiles renvoie une erreur => affiche fallback de noms (userId tronqué) et n'affiche aucun nom de profil", async () => {
    profilesResponse = Promise.resolve({ data: null, error: { message: 'x' } });

    const mod = await import('./TimeTracker');
    renderWithClient(<mod.TimeTracker />);

    expect(await screen.findByText('Temps de travail — Équipe')).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByText('Alex Martin')).toBeNull();
      expect(screen.queryByText('Sam Durand')).toBeNull();
    });

    const fallbackU2 = TEAM_ENTRIES_WEEK[0].user_id.slice(0, 8);
    const fallbackU3 = TEAM_ENTRIES_WEEK[1].user_id.slice(0, 8);

    expect(await screen.findByText(fallbackU2)).toBeTruthy();
    expect(screen.getByText(fallbackU3)).toBeTruthy();

    expect(supabaseFrom).toHaveBeenCalledWith('profiles');
  });
});