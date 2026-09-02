import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarNotifications } from '../calendar/useCalendarNotifications';
import { addDays, subDays, format } from 'date-fns';

describe('useCalendarNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty array for empty tasks', () => {
    const { result } = renderHook(() => useCalendarNotifications([]));
    expect(result.current).toEqual([]);
  });

  it('returns overdue notification for past deadline', () => {
    const tasks = [{
      id: '1',
      titre: 'Task overdue',
      echeance: format(subDays(new Date(), 3), 'yyyy-MM-dd'),
      statut: 'en_cours',
    }];
    const { result } = renderHook(() => useCalendarNotifications(tasks));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].type).toBe('overdue');
    expect(result.current[0].priority).toBe('high');
  });

  it('returns today notification for due today', () => {
    const tasks = [{
      id: '2',
      titre: 'Task today',
      echeance: format(new Date(), 'yyyy-MM-dd'),
      statut: 'en_cours',
    }];
    const { result } = renderHook(() => useCalendarNotifications(tasks));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].type).toBe('today');
  });

  it('returns deadline notification for upcoming deadline', () => {
    const tasks = [{
      id: '3',
      titre: 'Task soon',
      echeance: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
      statut: 'en_cours',
    }];
    const { result } = renderHook(() => useCalendarNotifications(tasks));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].type).toBe('deadline');
  });

  it('ignores completed tasks', () => {
    const tasks = [{
      id: '4',
      titre: 'Task done',
      echeance: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
      statut: 'terminee',
    }];
    const { result } = renderHook(() => useCalendarNotifications(tasks));
    expect(result.current).toHaveLength(0);
  });

  it('filters by currentUserId when provided', () => {
    const tasks = [
      {
        id: '5',
        titre: 'My task',
        echeance: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
        statut: 'en_cours',
        responsable_id: 'user-1',
      },
      {
        id: '6',
        titre: 'Other task',
        echeance: format(subDays(new Date(), 2), 'yyyy-MM-dd'),
        statut: 'en_cours',
        responsable_id: 'user-2',
      },
    ];
    const { result } = renderHook(() => useCalendarNotifications(tasks, 'user-1'));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].taskId).toBe('5');
  });

  it('sorts by priority then date', () => {
    const tasks = [
      {
        id: '7',
        titre: 'Low priority',
        echeance: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
        statut: 'en_cours',
      },
      {
        id: '8',
        titre: 'High priority',
        echeance: format(subDays(new Date(), 5), 'yyyy-MM-dd'),
        statut: 'en_cours',
      },
    ];
    const { result } = renderHook(() => useCalendarNotifications(tasks));
    expect(result.current[0].priority).toBe('high');
  });
});
