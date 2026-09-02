/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useJarvisGamification } from './useJarvisGamification';

const {
  AUTH_STATE,
  SCORE_ROW,
  UPDATED_SCORE_ROW,
  HIGH_ACHIEVER_SCORE,
  FETCH_ERROR,
  INSERT_RESPONSE,
  RPC_RESPONSE,
  UPDATE_RESPONSE,
  MAYBE_SINGLE_QUEUE,
  BUILDERS,
  mockFrom,
  mockRpc,
  toastSuccess,
  toastError,
  debugError,
} = vi.hoisted(() => ({
  AUTH_STATE: {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  },
  SCORE_ROW: {
    user_id: 'u1',
    total_score: 245,
    weekly_score: 55,
    monthly_score: 120,
    level: 3,
    experience_points: 245,
    time_saved_minutes: 120,
    tasks_auto_completed: 12,
    emails_processed: 34,
    suggestions_accepted: 18,
    suggestions_rejected: 2,
    current_streak_days: 4,
    longest_streak_days: 4,
    badges: [{ id: 'early_adopter' }],
    challenges_completed: 1,
    created_at: 'd1',
    updated_at: 'd2',
  },
  UPDATED_SCORE_ROW: {
    user_id: 'u1',
    total_score: 305,
    weekly_score: 65,
    monthly_score: 130,
    level: 4,
    experience_points: 305,
    time_saved_minutes: 150,
    tasks_auto_completed: 13,
    emails_processed: 34,
    suggestions_accepted: 19,
    suggestions_rejected: 2,
    current_streak_days: 5,
    longest_streak_days: 5,
    badges: [{ id: 'early_adopter' }],
    challenges_completed: 1,
    created_at: 'd1',
    updated_at: 'd3',
  },
  HIGH_ACHIEVER_SCORE: {
    user_id: 'u1',
    total_score: 1600,
    weekly_score: 400,
    monthly_score: 900,
    level: 5,
    experience_points: 1600,
    time_saved_minutes: 650,
    tasks_auto_completed: 55,
    emails_processed: 120,
    suggestions_accepted: 19,
    suggestions_rejected: 1,
    current_streak_days: 8,
    longest_streak_days: 8,
    badges: [{ id: 'early_adopter' }],
    challenges_completed: 3,
    created_at: 'd1',
    updated_at: 'd4',
  },
  FETCH_ERROR: { data: null, error: { message: 'x', code: 'OTHER' } },
  INSERT_RESPONSE: { data: null, error: null },
  RPC_RESPONSE: { data: null, error: null },
  UPDATE_RESPONSE: { data: null, error: null },
  MAYBE_SINGLE_QUEUE: [] as Array<{
    data: Record<string, unknown> | null;
    error: { message: string; code?: string } | null;
  }>,
  BUILDERS: [] as Array<{
    table: string;
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
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise<unknown>;
    catch: () => Promise<{ data: null; error: null }>;
  }>,
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  debugError: vi.fn(),
}));

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('@/lib/debug', () => ({
  debug: {
    error: debugError,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    rpc: mockRpc,
  },
}));

function createBuilder(table: string) {
  const builder = {
    table,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve(INSERT_RESPONSE)),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve(MAYBE_SINGLE_QUEUE.shift() ?? { data: SCORE_ROW, error: null })),
    then: (resolve: (value: { data: null; error: null }) => unknown) => Promise.resolve(resolve(UPDATE_RESPONSE)),
    catch: () => Promise.resolve(UPDATE_RESPONSE),
  };
  BUILDERS.push(builder);
  return builder;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper(props: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, props.children);
  };
}

describe('useJarvisGamification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MAYBE_SINGLE_QUEUE.length = 0;
    BUILDERS.length = 0;
    mockFrom.mockImplementation((table: string) => createBuilder(table));
    mockRpc.mockResolvedValue(RPC_RESPONSE);
  });

  it('charge le score existant et expose les valeurs métier attendues', async () => {
    MAYBE_SINGLE_QUEUE.push({ data: SCORE_ROW, error: null });

    const { result } = renderHook(() => useJarvisGamification(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('jarvis_user_scores');
    expect(result.current.score).toEqual({
      totalScore: 245,
      weeklyScore: 55,
      level: 3,
      experiencePoints: 245,
      timeSavedMinutes: 120,
      tasksAutoCompleted: 12,
      emailsProcessed: 34,
      suggestionsAccepted: 18,
      suggestionsRejected: 2,
      currentStreakDays: 4,
      badges: ['early_adopter'],
    });

    expect(result.current.getEarnedBadges().map((badge) => badge.id)).toEqual(['early_adopter']);
    expect(result.current.getAvailableBadges().map((badge) => badge.id)).toEqual([
      'speed_demon',
      'email_ninja',
      'time_saver',
      'streak_warrior',
      'perfectionist',
      'power_user',
    ]);
  });

  it('initialise un nouveau score quand aucun enregistrement n’existe et notifie early adopter', async () => {
    MAYBE_SINGLE_QUEUE.push({ data: null, error: null });

    const { result } = renderHook(() => useJarvisGamification(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const insertBuilder = BUILDERS.find((builder) => builder.insert.mock.calls.length > 0);
    expect(insertBuilder).toBeDefined();
    expect(insertBuilder?.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      total_score: 10,
      weekly_score: 10,
      level: 1,
      experience_points: 10,
      badges: [{ id: 'early_adopter', earnedAt: expect.any(String) }],
    });

    expect(toastSuccess).toHaveBeenCalledWith('🌟 Badge débloqué: Early Adopter!');
    expect(result.current.score).toEqual({
      totalScore: 10,
      weeklyScore: 10,
      level: 1,
      experiencePoints: 10,
      timeSavedMinutes: 0,
      tasksAutoCompleted: 0,
      emailsProcessed: 0,
      suggestionsAccepted: 0,
      suggestionsRejected: 0,
      currentStreakDays: 1,
      badges: ['early_adopter'],
    });
  });

  it('journalise une erreur de fetch et laisse score à null', async () => {
    MAYBE_SINGLE_QUEUE.push(FETCH_ERROR);

    const { result } = renderHook(() => useJarvisGamification(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(debugError).toHaveBeenCalledWith('Error fetching score:', { message: 'x', code: 'OTHER' });
    expect(result.current.score).toBeNull();
  });

  it('déclenche trackTimeSaved puis refresh du score avec les bons paramètres rpc', async () => {
    MAYBE_SINGLE_QUEUE.push({ data: SCORE_ROW, error: null });
    MAYBE_SINGLE_QUEUE.push({ data: UPDATED_SCORE_ROW, error: null });

    const { result } = renderHook(() => useJarvisGamification(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.trackTimeSaved(30);
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('increment_jarvis_score', {
        p_user_id: 'u1',
        p_score_type: 'time_saved',
        p_value: 30,
      });
    });

    await waitFor(() => {
      expect(result.current.score?.timeSavedMinutes).toBe(150);
      expect(result.current.score?.totalScore).toBe(305);
      expect(result.current.score?.level).toBe(4);
    });
  });

  it('déclenche addScore avec raison et affiche un toast de succès', async () => {
    MAYBE_SINGLE_QUEUE.push({ data: SCORE_ROW, error: null });
    MAYBE_SINGLE_QUEUE.push({ data: UPDATED_SCORE_ROW, error: null });

    const { result } = renderHook(() => useJarvisGamification(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.addScore(60, 'Challenge complété');
    });

    expect(mockRpc).toHaveBeenCalledWith('increment_jarvis_score', {
      p_user_id: 'u1',
      p_score_type: 'challenge_completed',
      p_value: 60,
    });

    expect(toastSuccess).toHaveBeenCalledWith('+60 points!', {
      description: 'Challenge complété',
    });
    expect(result.current.score?.totalScore).toBe(305);
  });

  it('rafraîchit un score élevé et retourne les badges gagnés/disponibles cohérents', async () => {
    MAYBE_SINGLE_QUEUE.push({ data: SCORE_ROW, error: null });
    MAYBE_SINGLE_QUEUE.push({ data: HIGH_ACHIEVER_SCORE, error: null });

    const { result } = renderHook(() => useJarvisGamification(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.refreshScore();
    });

    await waitFor(() => {
      expect(result.current.score?.level).toBe(5);
    });

    expect(result.current.score).toEqual({
      totalScore: 1600,
      weeklyScore: 400,
      level: 5,
      experiencePoints: 1600,
      timeSavedMinutes: 650,
      tasksAutoCompleted: 55,
      emailsProcessed: 120,
      suggestionsAccepted: 19,
      suggestionsRejected: 1,
      currentStreakDays: 8,
      badges: ['early_adopter'],
    });

    expect(result.current.getEarnedBadges().map((badge) => badge.id)).toEqual(['early_adopter']);
    expect(result.current.getAvailableBadges().map((badge) => badge.id)).toEqual([
      'speed_demon',
      'email_ninja',
      'time_saver',
      'streak_warrior',
      'perfectionist',
      'power_user',
    ]);
  });
});