import { describe, it, expect } from 'vitest';
import { getSmartTaskGroups, getGroupStats, getPriorityStyle } from '../agendaUtils';
import { format, addDays, subDays } from 'date-fns';

const makeTask = (echeance: string, statut = 'en_cours', responsable_id?: string) => ({
  id: Math.random().toString(),
  titre: 'Test task',
  echeance,
  statut,
  responsable_id,
});

describe('agendaUtils extended2', () => {
  describe('getSmartTaskGroups advanced', () => {
    it('overdue group only for non-terminee tasks', () => {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const tasks = [
        makeTask(yesterday, 'en_cours'),
        makeTask(yesterday, 'terminee'),
      ];
      const groups = getSmartTaskGroups(tasks);
      const overdue = groups.find(g => g.id === 'overdue');
      expect(overdue?.tasks).toHaveLength(1);
    });

    it('sorts tasks by date within groups', () => {
      const d1 = format(addDays(new Date(), 2), 'yyyy-MM-dd');
      const d2 = format(addDays(new Date(), 5), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([makeTask(d2), makeTask(d1)]);
      const weekGroup = groups.find(g => g.id === 'thisWeek');
      if (weekGroup && weekGroup.tasks.length >= 2) {
        expect(weekGroup.tasks[0].echeance).toBe(d1);
      }
    });

    it('creates later group for far future', () => {
      const future = format(addDays(new Date(), 30), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([makeTask(future)]);
      expect(groups.find(g => g.id === 'later')).toBeDefined();
    });

    it('skips tasks without echeance', () => {
      const groups = getSmartTaskGroups([{ id: '1', titre: 'No date', statut: 'en_cours' }]);
      expect(groups).toHaveLength(0);
    });

    it('group priority order', () => {
      const overdue = format(subDays(new Date(), 2), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');
      const future = format(addDays(new Date(), 20), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([
        makeTask(future),
        makeTask(overdue),
        makeTask(today),
      ]);
      const priorities = groups.map(g => g.priority);
      expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    });
  });

  describe('getGroupStats advanced', () => {
    it('completionRate 100% when all done', () => {
      const tasks = [
        makeTask('2026-03-01', 'terminee'),
        makeTask('2026-03-02', 'terminee'),
      ];
      expect(getGroupStats(tasks).completionRate).toBe(100);
    });

    it('completionRate 0% when none done', () => {
      expect(getGroupStats([makeTask('2026-03-01', 'en_cours')]).completionRate).toBe(0);
    });

    it('counts unique assignees', () => {
      const tasks = [
        makeTask('2026-03-01', 'en_cours', 'user-1'),
        makeTask('2026-03-02', 'en_cours', 'user-1'),
        makeTask('2026-03-03', 'en_cours', 'user-2'),
      ];
      expect(getGroupStats(tasks).assigneeCount).toBe(2);
    });

    it('avgDelay > 0 for overdue tasks', () => {
      const past = format(subDays(new Date(), 5), 'yyyy-MM-dd');
      const stats = getGroupStats([makeTask(past, 'en_cours')]);
      expect(stats.avgDelay).toBeGreaterThanOrEqual(4);
    });

    it('avgDelay 0 when no overdue', () => {
      const future = format(addDays(new Date(), 5), 'yyyy-MM-dd');
      expect(getGroupStats([makeTask(future)]).avgDelay).toBe(0);
    });
  });

  describe('getPriorityStyle', () => {
    it('high → destructive', () => {
      const s = getPriorityStyle('high');
      expect(s.icon).toBe('⚠️');
      expect(s.className).toContain('destructive');
    });
    it('medium → warning', () => {
      expect(getPriorityStyle('medium').className).toContain('warning');
    });
    it('low → muted', () => {
      expect(getPriorityStyle('low').className).toContain('muted');
    });
    it('unknown → muted', () => {
      expect(getPriorityStyle('other').className).toContain('muted');
    });
  });
});
