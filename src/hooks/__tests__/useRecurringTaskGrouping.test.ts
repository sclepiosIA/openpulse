import { describe, it, expect } from 'vitest';
import { groupRecurringTasks, useRecurringTaskGrouping } from '../tasks/useRecurringTaskGrouping';
import { renderHook } from '@testing-library/react';

describe('groupRecurringTasks', () => {
  it('returns empty for empty array', () => {
    expect(groupRecurringTasks([])).toEqual([]);
  });

  it('wraps non-recurring tasks as single-occurrence groups', () => {
    const tasks = [{ id: 't1', titre: 'A', created_at: '2026-01-01' }];
    const groups = groupRecurringTasks(tasks);
    expect(groups).toHaveLength(1);
    expect(groups[0].isRecurring).toBe(false);
    expect(groups[0].occurrences).toHaveLength(1);
  });

  it('groups recurring parent with occurrences', () => {
    const tasks = [
      { id: 'p1', titre: 'Parent', recurrence_rule: 'FREQ=WEEKLY', date_debut: '2026-01-01' },
      { id: 'o1', _isRecurrenceOccurrence: true, _parentTaskId: 'p1', date_debut: '2026-01-08' },
      { id: 'o2', _isRecurrenceOccurrence: true, _parentTaskId: 'p1', date_debut: '2026-01-15' },
    ];
    const groups = groupRecurringTasks(tasks);
    expect(groups).toHaveLength(1);
    expect(groups[0].isRecurring).toBe(true);
    expect(groups[0].occurrences).toHaveLength(3); // parent + 2 occurrences
    expect(groups[0].parentTask.id).toBe('p1');
  });

  it('sorts occurrences by date', () => {
    const tasks = [
      { id: 'p1', recurrence_rule: 'FREQ=DAILY', date_debut: '2026-01-03' },
      { id: 'o1', _isRecurrenceOccurrence: true, _parentTaskId: 'p1', date_debut: '2026-01-01' },
      { id: 'o2', _isRecurrenceOccurrence: true, _parentTaskId: 'p1', date_debut: '2026-01-02' },
    ];
    const groups = groupRecurringTasks(tasks);
    const dates = groups[0].occurrences.map((o: any) => o.date_debut);
    expect(dates).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('filters out orphaned occurrences without parent', () => {
    const tasks = [
      { id: 'o1', _isRecurrenceOccurrence: true, _parentTaskId: 'p_missing', date_debut: '2026-01-01' },
    ];
    const groups = groupRecurringTasks(tasks);
    expect(groups).toHaveLength(0); // no parentTask so filtered
  });
});

describe('useRecurringTaskGrouping', () => {
  it('returns grouped tasks via hook', () => {
    const tasks = [{ id: 't1', created_at: '2026-01-01' }];
    const { result } = renderHook(() => useRecurringTaskGrouping(tasks));
    expect(result.current).toHaveLength(1);
  });
});
