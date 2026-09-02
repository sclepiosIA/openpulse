import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/hooks/email/useEmailCounts', () => ({
  useEmailCounts: () => ({ unreadCount: 5, unprocessedCount: 0 }),
}));
vi.mock('@/hooks/pulse/usePulseUnreadCount', () => ({
  usePulseTotalUnread: () => 3,
}));
vi.mock('@/hooks/tasks/useTodosUnreadCount', () => ({
  useTodosUnreadCount: () => 7,
}));
vi.mock('@/hooks/calendar/useCalendarTodayCount', () => ({
  useCalendarTodayCount: () => 2,
}));
vi.mock('@/hooks/system/useCurrentPWAApp', () => ({
  useCurrentPWAApp: () => 'main',
}));
vi.mock('@/hooks/support/useSupportOpenCount', () => ({
  useSupportOpenCount: () => 0,
}));
vi.mock('@/hooks/voice/useMissedCallsCount', () => ({
  useMissedCallsCount: () => 0,
}));
vi.mock('@/hooks/bookings/usePendingBookingsCount', () => ({
  usePendingBookingsCount: () => 0,
}));
vi.mock('@/hooks/rd/useRDOpenTasksCount', () => ({
  useRDOpenTasksCount: () => 0,
}));

import { useNavigationBadges, usePWABadgeCount } from '../ui/useNavigationBadges';

describe('useNavigationBadges', () => {
  it('returns all badge counts', () => {
    const { result } = renderHook(() => useNavigationBadges());
    expect(result.current.emails).toBe(5);
    expect(result.current.pulse).toBe(3);
    expect(result.current.todos).toBe(7);
    expect(result.current.calendar).toBe(2);
    expect(result.current.total).toBe(17);
  });
});

describe('usePWABadgeCount', () => {
  it('returns total count for main app', () => {
    const { result } = renderHook(() => usePWABadgeCount());
    expect(result.current).toBe(17);
  });
});
