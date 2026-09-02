import { describe, it, expect } from 'vitest';
import { groupRecurringTasks, GroupedTask } from '../tasks/useRecurringTaskGrouping';

describe('groupRecurringTasks', () => {
  it('returns empty for empty input', () => {
    expect(groupRecurringTasks([])).toEqual([]);
  });

  it('wraps non-recurring tasks as single-occurrence groups', () => {
    const tasks = [
      { id: 't1', titre: 'Normal task', created_at: '2026-01-01' },
      { id: 't2', titre: 'Another task', created_at: '2026-01-02' },
    ];
    const result = groupRecurringTasks(tasks);
    expect(result).toHaveLength(2);
    result.forEach(g => {
      expect(g.isRecurring).toBe(false);
      expect(g.occurrences).toHaveLength(1);
      expect(g.parentTask).toBeDefined();
    });
  });

  it('groups recurring occurrences under parent', () => {
    const tasks = [
      { id: 'parent1', titre: 'Daily standup', recurrence_rule: 'FREQ=DAILY', date_debut: '2026-01-01' },
      { id: 'occ1', titre: 'Daily standup', _isRecurrenceOccurrence: true, _parentTaskId: 'parent1', date_debut: '2026-01-02' },
      { id: 'occ2', titre: 'Daily standup', _isRecurrenceOccurrence: true, _parentTaskId: 'parent1', date_debut: '2026-01-03' },
    ];
    const result = groupRecurringTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].isRecurring).toBe(true);
    expect(result[0].occurrences).toHaveLength(3); // parent + 2 occurrences
    expect(result[0].parentTask.id).toBe('parent1');
  });

  it('sorts occurrences by date', () => {
    const tasks = [
      { id: 'parent1', recurrence_rule: 'FREQ=WEEKLY', date_debut: '2026-01-10' },
      { id: 'occ2', _isRecurrenceOccurrence: true, _parentTaskId: 'parent1', date_debut: '2026-01-03' },
      { id: 'occ1', _isRecurrenceOccurrence: true, _parentTaskId: 'parent1', date_debut: '2026-01-01' },
    ];
    const result = groupRecurringTasks(tasks);
    expect(result[0].occurrences[0].date_debut).toBe('2026-01-01');
    expect(result[0].occurrences[1].date_debut).toBe('2026-01-03');
  });

  it('filters out orphan occurrences without parent', () => {
    const tasks = [
      { id: 'occ1', _isRecurrenceOccurrence: true, _parentTaskId: 'missing', date_debut: '2026-01-01' },
    ];
    const result = groupRecurringTasks(tasks);
    expect(result).toHaveLength(0); // No parent found → filtered out
  });

  it('mixes recurring and non-recurring', () => {
    const tasks = [
      { id: 't1', titre: 'Normal', created_at: '2026-01-01' },
      { id: 'parent1', recurrence_rule: 'FREQ=DAILY', date_debut: '2026-01-01' },
      { id: 'occ1', _isRecurrenceOccurrence: true, _parentTaskId: 'parent1', date_debut: '2026-01-02' },
    ];
    const result = groupRecurringTasks(tasks);
    expect(result).toHaveLength(2);
    const normal = result.find(g => !g.isRecurring);
    const recurring = result.find(g => g.isRecurring);
    expect(normal).toBeDefined();
    expect(recurring).toBeDefined();
    expect(recurring!.occurrences).toHaveLength(2);
  });

  it('handles occurrences arriving before parent', () => {
    const tasks = [
      { id: 'occ1', _isRecurrenceOccurrence: true, _parentTaskId: 'p1', date_debut: '2026-01-02' },
      { id: 'p1', recurrence_rule: 'FREQ=WEEKLY', date_debut: '2026-01-01' },
    ];
    const result = groupRecurringTasks(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].parentTask.id).toBe('p1');
    expect(result[0].occurrences.length).toBeGreaterThanOrEqual(2);
  });
});
