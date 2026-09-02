/* @vitest-environment jsdom */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBadgeByKey, useNavigationBadges, usePWABadgeCount } from './useNavigationBadges';
import { useCurrentPWAApp } from '../system/useCurrentPWAApp';

const {
  EMAILS_COUNT,
  PULSE_COUNT,
  TODOS_COUNT,
  CALENDAR_COUNT,
  SUPPORT_COUNT,
  CALLS_COUNT,
  BOOKINGS_COUNT,
  RD_COUNT,
  ZERO_COUNT,
  CURRENT_APP,
  EMAIL_STATE,
  PULSE_STATE,
  TODOS_STATE,
  CALENDAR_STATE,
  SUPPORT_STATE,
  CALLS_STATE,
  BOOKINGS_STATE,
  RD_STATE,
  mockUseCurrentPWAApp,
} = vi.hoisted(() => ({
  EMAILS_COUNT: 2,
  PULSE_COUNT: 5,
  TODOS_COUNT: 3,
  CALENDAR_COUNT: 1,
  SUPPORT_COUNT: 4,
  CALLS_COUNT: 6,
  BOOKINGS_COUNT: 2,
  RD_COUNT: 7,
  ZERO_COUNT: 0,
  CURRENT_APP: { value: 'main' as 'main' | 'mail' | 'pulse' | 'todos' | 'calendar' },
  EMAIL_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 2 },
  PULSE_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 5 },
  TODOS_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 3 },
  CALENDAR_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 1 },
  SUPPORT_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 4 },
  CALLS_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 6 },
  BOOKINGS_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 2 },
  RD_STATE: { mode: 'success' as 'loading' | 'success' | 'error', value: 7 },
  mockUseCurrentPWAApp: vi.fn(() => 'main' as 'main' | 'mail' | 'pulse' | 'todos' | 'calendar'),
}));

vi.mock('../email/useEmailCounts', () => ({
  useEmailCounts: () => {
    if (EMAIL_STATE.mode === 'loading') {
      return { unreadCount: 0 };
    }
    if (EMAIL_STATE.mode === 'error') {
      return { unreadCount: 0 };
    }
    return { unreadCount: EMAIL_STATE.value };
  },
}));

vi.mock('../pulse/usePulseUnreadCount', () => ({
  usePulseTotalUnread: () => {
    if (PULSE_STATE.mode === 'loading') {
      return 0;
    }
    if (PULSE_STATE.mode === 'error') {
      return 0;
    }
    return PULSE_STATE.value;
  },
}));

vi.mock('../tasks/useTodosUnreadCount', () => ({
  useTodosUnreadCount: () => {
    if (TODOS_STATE.mode === 'loading') {
      return 0;
    }
    if (TODOS_STATE.mode === 'error') {
      return 0;
    }
    return TODOS_STATE.value;
  },
}));

vi.mock('../calendar/useCalendarTodayCount', () => ({
  useCalendarTodayCount: () => {
    if (CALENDAR_STATE.mode === 'loading') {
      return 0;
    }
    if (CALENDAR_STATE.mode === 'error') {
      return 0;
    }
    return CALENDAR_STATE.value;
  },
}));

vi.mock('../support/useSupportOpenCount', () => ({
  useSupportOpenCount: () => SUPPORT_STATE.mode === 'success' ? SUPPORT_STATE.value : 0,
}));

vi.mock('../voice/useMissedCallsCount', () => ({
  useMissedCallsCount: () => CALLS_STATE.mode === 'success' ? CALLS_STATE.value : 0,
}));

vi.mock('../bookings/usePendingBookingsCount', () => ({
  usePendingBookingsCount: () => BOOKINGS_STATE.mode === 'success' ? BOOKINGS_STATE.value : 0,
}));

vi.mock('../rd/useRDOpenTasksCount', () => ({
  useRDOpenTasksCount: () => RD_STATE.mode === 'success' ? RD_STATE.value : 0,
}));

vi.mock('../system/useCurrentPWAApp', () => ({
  useCurrentPWAApp: mockUseCurrentPWAApp,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function resetBadgeStates() {
  EMAIL_STATE.mode = 'success';
  EMAIL_STATE.value = EMAILS_COUNT;
  PULSE_STATE.mode = 'success';
  PULSE_STATE.value = PULSE_COUNT;
  TODOS_STATE.mode = 'success';
  TODOS_STATE.value = TODOS_COUNT;
  CALENDAR_STATE.mode = 'success';
  CALENDAR_STATE.value = CALENDAR_COUNT;
  SUPPORT_STATE.mode = 'success';
  SUPPORT_STATE.value = SUPPORT_COUNT;
  CALLS_STATE.mode = 'success';
  CALLS_STATE.value = CALLS_COUNT;
  BOOKINGS_STATE.mode = 'success';
  BOOKINGS_STATE.value = BOOKINGS_COUNT;
  RD_STATE.mode = 'success';
  RD_STATE.value = RD_COUNT;
}

describe('useNavigationBadges', () => {
  beforeEach(() => {
    resetBadgeStates();
    CURRENT_APP.value = 'main';
    mockUseCurrentPWAApp.mockReset();
    mockUseCurrentPWAApp.mockImplementation(() => CURRENT_APP.value);
  });

  it('returns aggregated navigation badge values and total', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useNavigationBadges(), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({
        emails: EMAILS_COUNT,
        pulse: PULSE_COUNT,
        todos: TODOS_COUNT,
        calendar: CALENDAR_COUNT,
        support: SUPPORT_COUNT,
        calls: CALLS_COUNT,
        bookings: BOOKINGS_COUNT,
        rd: RD_COUNT,
        total: EMAILS_COUNT + PULSE_COUNT + TODOS_COUNT + CALENDAR_COUNT
          + SUPPORT_COUNT + CALLS_COUNT + BOOKINGS_COUNT + RD_COUNT,
      });
    });
  });

  it('reflects loading-like dependencies with zeroed counts initially', async () => {
    EMAIL_STATE.mode = 'loading';
    PULSE_STATE.mode = 'loading';
    TODOS_STATE.mode = 'loading';
    CALENDAR_STATE.mode = 'loading';
    SUPPORT_STATE.mode = 'loading';
    CALLS_STATE.mode = 'loading';
    BOOKINGS_STATE.mode = 'loading';
    RD_STATE.mode = 'loading';

    const wrapper = createWrapper();
    const { result } = renderHook(() => useNavigationBadges(), { wrapper });

    await waitFor(() => {
      expect(result.current.emails).toBe(0);
      expect(result.current.pulse).toBe(0);
      expect(result.current.todos).toBe(0);
      expect(result.current.calendar).toBe(0);
      expect(result.current.support).toBe(0);
      expect(result.current.calls).toBe(0);
      expect(result.current.bookings).toBe(0);
      expect(result.current.rd).toBe(0);
      expect(result.current.total).toBe(0);
    });
  });

  it('reflects error-like dependencies with zeroed counts', async () => {
    EMAIL_STATE.mode = 'error';
    PULSE_STATE.mode = 'error';
    TODOS_STATE.mode = 'error';
    CALENDAR_STATE.mode = 'error';
    SUPPORT_STATE.mode = 'error';
    CALLS_STATE.mode = 'error';
    BOOKINGS_STATE.mode = 'error';
    RD_STATE.mode = 'error';

    const wrapper = createWrapper();
    const { result } = renderHook(() => useNavigationBadges(), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({
        emails: ZERO_COUNT,
        pulse: ZERO_COUNT,
        todos: ZERO_COUNT,
        calendar: ZERO_COUNT,
        support: ZERO_COUNT,
        calls: ZERO_COUNT,
        bookings: ZERO_COUNT,
        rd: ZERO_COUNT,
        total: ZERO_COUNT,
      });
    });
  });
});

describe('usePWABadgeCount', () => {
  beforeEach(() => {
    resetBadgeStates();
    CURRENT_APP.value = 'main';
    mockUseCurrentPWAApp.mockReset();
    mockUseCurrentPWAApp.mockImplementation(() => CURRENT_APP.value);
  });

  it('returns total for main app', async () => {
    CURRENT_APP.value = 'main';
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePWABadgeCount(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(
        EMAILS_COUNT + PULSE_COUNT + TODOS_COUNT + CALENDAR_COUNT
          + SUPPORT_COUNT + CALLS_COUNT + BOOKINGS_COUNT + RD_COUNT,
      );
    });
  });

  it('returns email badge for mail app', async () => {
    CURRENT_APP.value = 'mail';
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePWABadgeCount(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(EMAILS_COUNT);
    });
  });

  it('returns pulse badge for pulse app', async () => {
    CURRENT_APP.value = 'pulse';
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePWABadgeCount(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(PULSE_COUNT);
    });
  });

  it('returns todos badge for todos app', async () => {
    CURRENT_APP.value = 'todos';
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePWABadgeCount(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(TODOS_COUNT);
    });
  });

  it('returns calendar badge for calendar app', async () => {
    CURRENT_APP.value = 'calendar';
    const wrapper = createWrapper();
    const { result } = renderHook(() => usePWABadgeCount(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBe(CALENDAR_COUNT);
    });
  });

  it('uses the current PWA app hook', async () => {
    const wrapper = createWrapper();
    renderHook(() => usePWABadgeCount(), { wrapper });

    await waitFor(() => {
      expect(useCurrentPWAApp).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useBadgeByKey', () => {
  beforeEach(() => {
    resetBadgeStates();
    CURRENT_APP.value = 'main';
    mockUseCurrentPWAApp.mockReset();
    mockUseCurrentPWAApp.mockImplementation(() => CURRENT_APP.value);
  });

  it('returns undefined when no key is provided', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBadgeByKey(), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeUndefined();
    });
  });

  it('returns the matching positive badge count for each supported key', async () => {
    const wrapper = createWrapper();

    const { result: emailsResult } = renderHook(() => useBadgeByKey('emailsUnread'), { wrapper });
    const { result: pulseResult } = renderHook(() => useBadgeByKey('pulseUnread'), { wrapper });
    const { result: todosResult } = renderHook(() => useBadgeByKey('todosCount'), { wrapper });
    const { result: calendarResult } = renderHook(() => useBadgeByKey('calendarEvents'), { wrapper });
    const { result: supportResult } = renderHook(() => useBadgeByKey('supportTickets'), { wrapper });
    const { result: callsResult } = renderHook(() => useBadgeByKey('missedCalls'), { wrapper });
    const { result: bookingsResult } = renderHook(() => useBadgeByKey('pendingBookings'), { wrapper });
    const { result: rdResult } = renderHook(() => useBadgeByKey('rdOpenTasks'), { wrapper });

    await waitFor(() => {
      expect(emailsResult.current).toBe(EMAILS_COUNT);
      expect(pulseResult.current).toBe(PULSE_COUNT);
      expect(todosResult.current).toBe(TODOS_COUNT);
      expect(calendarResult.current).toBe(CALENDAR_COUNT);
      expect(supportResult.current).toBe(SUPPORT_COUNT);
      expect(callsResult.current).toBe(CALLS_COUNT);
      expect(bookingsResult.current).toBe(BOOKINGS_COUNT);
      expect(rdResult.current).toBe(RD_COUNT);
    });
  });

  it('returns undefined for unknown badge key', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useBadgeByKey('unknownKey'), { wrapper });

    await waitFor(() => {
      expect(result.current).toBeUndefined();
    });
  });

  it('returns undefined when a mapped badge value is zero', async () => {
    EMAIL_STATE.value = 0;
    PULSE_STATE.value = 0;
    TODOS_STATE.value = 0;
    CALENDAR_STATE.value = 0;
    SUPPORT_STATE.value = 0;
    CALLS_STATE.value = 0;
    BOOKINGS_STATE.value = 0;
    RD_STATE.value = 0;

    const wrapper = createWrapper();

    const { result: emailsResult } = renderHook(() => useBadgeByKey('emailsUnread'), { wrapper });
    const { result: pulseResult } = renderHook(() => useBadgeByKey('pulseUnread'), { wrapper });
    const { result: todosResult } = renderHook(() => useBadgeByKey('todosCount'), { wrapper });
    const { result: calendarResult } = renderHook(() => useBadgeByKey('calendarEvents'), { wrapper });
    const { result: supportResult } = renderHook(() => useBadgeByKey('supportTickets'), { wrapper });
    const { result: callsResult } = renderHook(() => useBadgeByKey('missedCalls'), { wrapper });
    const { result: bookingsResult } = renderHook(() => useBadgeByKey('pendingBookings'), { wrapper });
    const { result: rdResult } = renderHook(() => useBadgeByKey('rdOpenTasks'), { wrapper });

    await waitFor(() => {
      expect(emailsResult.current).toBeUndefined();
      expect(pulseResult.current).toBeUndefined();
      expect(todosResult.current).toBeUndefined();
      expect(calendarResult.current).toBeUndefined();
      expect(supportResult.current).toBeUndefined();
      expect(callsResult.current).toBeUndefined();
      expect(bookingsResult.current).toBeUndefined();
      expect(rdResult.current).toBeUndefined();
    });
  });
});