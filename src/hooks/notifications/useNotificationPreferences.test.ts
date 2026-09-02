// @vitest-environment jsdom

import React, { PropsWithChildren } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotificationPreferences } from './useNotificationPreferences';

const {
  AUTH_STATE,
  toastSuccess,
  toastError,
  sanitizeSupabaseError,
  DEFAULT_PROFILE_ROW,
  UPDATED_PROFILE_ROW,
  updatePayloadResult,
  state,
  mockFrom,
} = vi.hoisted(() => {
  const AUTH_STATE = {
    user: { id: 'u1', email: 't@t.co' },
    session: { user: { id: 'u1' } },
    isLoading: false,
  };

  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const sanitizeSupabaseError = vi.fn((error: Error | { message?: string }) => error.message ?? 'unknown');

  const DEFAULT_PROFILE_ROW = {
    preferences: {
      notifications: {
        email_notifications: {
          ai_suggestions: {
            enabled: false,
            frequency: 'weekly' as const,
          },
          task_reminders: {
            enabled: true,
            frequency: 'never' as const,
          },
          urgent_tasks: {
            enabled: false,
            threshold_days: 3,
          },
          establishment_updates: {
            enabled: false,
          },
          team_mentions: {
            enabled: true,
          },
        },
        in_app_notifications: {
          ai_suggestions: false,
          task_assignments: true,
          task_completions: false,
          establishment_status_changes: true,
          comments_mentions: false,
        },
        quiet_hours: {
          enabled: true,
          start_time: '23:00',
          end_time: '07:00',
        },
      },
    },
  };

  const UPDATED_PROFILE_ROW = {
    preferences: {
      theme: 'dark',
      notifications: {
        email_notifications: {
          ai_suggestions: {
            enabled: true,
            frequency: 'daily' as const,
          },
          task_reminders: {
            enabled: false,
            frequency: 'weekly' as const,
          },
          urgent_tasks: {
            enabled: true,
            threshold_days: 2,
          },
          establishment_updates: {
            enabled: false,
          },
          team_mentions: {
            enabled: false,
          },
        },
        in_app_notifications: {
          ai_suggestions: true,
          task_assignments: false,
          task_completions: true,
          establishment_status_changes: false,
          comments_mentions: true,
        },
        quiet_hours: {
          enabled: true,
          start_time: '21:30',
          end_time: '06:30',
        },
      },
    },
  };

  const updatePayloadResult = {
    theme: 'dark',
    notifications: UPDATED_PROFILE_ROW.preferences.notifications,
  };

  const state = {
    selectResult: { data: DEFAULT_PROFILE_ROW, error: null as null | { message: string } },
    maybeSingleResult: { data: DEFAULT_PROFILE_ROW, error: null as null | { message: string } },
    updateResult: { data: null, error: null as null | { message: string } },
    lastUpdateArgs: undefined as undefined | { preferences: typeof updatePayloadResult },
    fromCalls: [] as string[],
    eqCalls: [] as Array<[string, string]>,
    selectCalls: [] as string[],
  };

  const mockFrom = vi.fn((table: string) => {
    state.fromCalls.push(table);

    const builder: any = {
      select: vi.fn((columns?: string) => {
        if (columns) state.selectCalls.push(columns);
        return builder;
      }),
      eq: vi.fn((column: string, value: string) => {
        state.eqCalls.push([column, value]);
        return builder;
      }),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      update: vi.fn((args: { preferences: typeof updatePayloadResult }) => {
        state.lastUpdateArgs = args;
        return builder;
      }),
      single: vi.fn(async () => state.maybeSingleResult),
      maybeSingle: vi.fn(async () => state.maybeSingleResult),
      then: (onFulfilled?: (value: typeof state.updateResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(state.updateResult).then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(state.updateResult).catch(onRejected),
    };

    return builder;
  });

  return {
    AUTH_STATE,
    toastSuccess,
    toastError,
    sanitizeSupabaseError,
    DEFAULT_PROFILE_ROW,
    UPDATED_PROFILE_ROW,
    updatePayloadResult,
    state,
    mockFrom,
  };
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}));

vi.mock('sonner', () => ({
  toast: {
    success: toastSuccess,
    error: toastError,
  },
}));

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError,
}));

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children as React.ReactNode);
  };
}

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.fromCalls = [];
    state.eqCalls = [];
    state.selectCalls = [];
    state.lastUpdateArgs = undefined;
    state.maybeSingleResult = { data: DEFAULT_PROFILE_ROW, error: null };
    state.updateResult = { data: null, error: null };
  });

  it('charge les préférences et expose les valeurs métier récupérées', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.preferences.email_notifications.ai_suggestions.frequency).toBe('daily');
    expect(result.current.preferences.quiet_hours.start_time).toBe('22:00');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(state.selectCalls).toContain('preferences');
    expect(state.eqCalls).toContainEqual(['user_id', 'u1']);

    expect(result.current.preferences.email_notifications.ai_suggestions.enabled).toBe(false);
    expect(result.current.preferences.email_notifications.ai_suggestions.frequency).toBe('weekly');
    expect(result.current.preferences.email_notifications.task_reminders.frequency).toBe('never');
    expect(result.current.preferences.email_notifications.urgent_tasks.threshold_days).toBe(3);
    expect(result.current.preferences.in_app_notifications.ai_suggestions).toBe(false);
    expect(result.current.preferences.in_app_notifications.comments_mentions).toBe(false);
    expect(result.current.preferences.quiet_hours.enabled).toBe(true);
    expect(result.current.preferences.quiet_hours.start_time).toBe('23:00');
    expect(result.current.preferences.quiet_hours.end_time).toBe('07:00');
  });

  it('met à jour les préférences, écrit en base, met à jour le cache et affiche un toast de succès', async () => {
    state.maybeSingleResult = { data: { preferences: { theme: 'dark' } }, error: null };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const newPreferences = {
      quiet_hours: {
        enabled: true,
        start_time: '21:30',
        end_time: '06:30',
      },
      in_app_notifications: {
        ai_suggestions: true,
        task_assignments: false,
        task_completions: true,
        establishment_status_changes: false,
        comments_mentions: true,
      },
      email_notifications: {
        ai_suggestions: {
          enabled: true,
          frequency: 'daily' as const,
        },
        task_reminders: {
          enabled: false,
          frequency: 'weekly' as const,
        },
        urgent_tasks: {
          enabled: true,
          threshold_days: 2,
        },
        establishment_updates: {
          enabled: false,
        },
        team_mentions: {
          enabled: false,
        },
      },
    };

    await act(async () => {
      result.current.updatePreferences(newPreferences);
    });

    await waitFor(() => {
      expect(state.lastUpdateArgs).toEqual({ preferences: updatePayloadResult });
    });

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(state.eqCalls).toContainEqual(['user_id', 'u1']);
    expect(toastSuccess).toHaveBeenCalledWith('Préférences de notification enregistrées');

    await waitFor(() => {
      expect(result.current.preferences.quiet_hours.start_time).toBe('21:30');
    });

    expect(result.current.preferences.quiet_hours.end_time).toBe('06:30');
    expect(result.current.preferences.in_app_notifications.task_assignments).toBe(false);
    expect(result.current.preferences.email_notifications.urgent_tasks.threshold_days).toBe(2);
    expect(result.current.preferences.email_notifications.team_mentions.enabled).toBe(false);
  });

  it('retourne les valeurs par défaut lorsque la lecture supabase échoue (erreur de chargement)', async () => {
    state.maybeSingleResult = { data: null, error: { message: 'x' } };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preferences.email_notifications.ai_suggestions.frequency).toBe('daily');
    expect(result.current.preferences.quiet_hours.start_time).toBe('22:00');
  });

  it('gère une erreur de mutation avec sanitization et toast error', async () => {
    state.maybeSingleResult = { data: { preferences: { theme: 'dark' } }, error: null };
    state.updateResult = { data: null, error: { message: 'x' } };

    const wrapper = createWrapper();
    const { result } = renderHook(() => useNotificationPreferences(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.updatePreferences({
        quiet_hours: {
          enabled: true,
          start_time: '20:00',
          end_time: '06:00',
        },
      });
    });

    await waitFor(() => {
      expect(sanitizeSupabaseError).toHaveBeenCalled();
    });

    expect(toastError).toHaveBeenCalledWith('x');
    expect(state.lastUpdateArgs).toEqual({
      preferences: {
        theme: 'dark',
        notifications: {
          email_notifications: {
            ai_suggestions: {
              enabled: true,
              frequency: 'daily',
            },
            task_reminders: {
              enabled: true,
              frequency: 'daily',
            },
            urgent_tasks: {
              enabled: true,
              threshold_days: 7,
            },
            establishment_updates: {
              enabled: true,
            },
            team_mentions: {
              enabled: true,
            },
          },
          in_app_notifications: {
            ai_suggestions: true,
            task_assignments: true,
            task_completions: true,
            establishment_status_changes: true,
            comments_mentions: true,
          },
          quiet_hours: {
            enabled: true,
            start_time: '20:00',
            end_time: '06:00',
          },
        },
      },
    });
  });
});