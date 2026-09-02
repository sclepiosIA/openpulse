import { describe, it, expect } from 'vitest';
import { getSmartTaskGroups, getGroupStats, getPriorityStyle } from '../agendaUtils';
import { addDays, subDays, format } from 'date-fns';

const makeTask = (echeance: string, statut = 'en_cours', responsable_id?: string) => ({
  id: `t-${Math.random()}`,
  titre: 'Test',
  echeance,
  statut,
  responsable_id,
});

describe('agendaUtils', () => {
  describe('getSmartTaskGroups', () => {
    it('returns empty for empty tasks', () => {
      expect(getSmartTaskGroups([])).toEqual([]);
    });

    it('returns empty for tasks without echeance', () => {
      expect(getSmartTaskGroups([{ id: '1', titre: 'No date' }])).toEqual([]);
    });

    it('groups overdue tasks', () => {
      const yesterday = format(subDays(new Date(), 2), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([makeTask(yesterday)]);
      expect(groups.length).toBe(1);
      expect(groups[0].id).toBe('overdue');
      expect(groups[0].tasks.length).toBe(1);
    });

    it('does not mark completed tasks as overdue', () => {
      const yesterday = format(subDays(new Date(), 2), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([makeTask(yesterday, 'terminee')]);
      // terminee tasks in the past are not overdue, but they may appear in other groups
      const overdueGroup = groups.find(g => g.id === 'overdue');
      expect(overdueGroup).toBeUndefined();
    });

    it('groups today tasks', () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([makeTask(today)]);
      const todayGroup = groups.find(g => g.id === 'today');
      expect(todayGroup).toBeDefined();
      expect(todayGroup!.tasks.length).toBe(1);
    });

    it('groups this week tasks', () => {
      const inThreeDays = format(addDays(new Date(), 3), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([makeTask(inThreeDays)]);
      const weekGroup = groups.find(g => g.id === 'thisWeek');
      expect(weekGroup).toBeDefined();
    });

    it('groups later tasks', () => {
      const inTwoMonths = format(addDays(new Date(), 60), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([makeTask(inTwoMonths)]);
      const laterGroup = groups.find(g => g.id === 'later');
      expect(laterGroup).toBeDefined();
    });

    it('sorts groups by priority', () => {
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      const today = format(new Date(), 'yyyy-MM-dd');
      const groups = getSmartTaskGroups([
        makeTask(today),
        makeTask(yesterday),
      ]);
      expect(groups[0].priority).toBeLessThan(groups[1].priority);
    });
  });

  describe('getGroupStats', () => {
    it('returns zeros for empty', () => {
      const stats = getGroupStats([]);
      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.avgDelay).toBe(0);
      expect(stats.assigneeCount).toBe(0);
    });

    it('calculates completion rate', () => {
      const tasks = [
        { statut: 'terminee' },
        { statut: 'terminee' },
        { statut: 'en_cours' },
      ];
      const stats = getGroupStats(tasks);
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(2);
      expect(stats.completionRate).toBe(67);
    });

    it('counts unique assignees', () => {
      const tasks = [
        { responsable_id: 'u1' },
        { responsable_id: 'u1' },
        { responsable_id: 'u2' },
        { responsable_id: null },
      ];
      expect(getGroupStats(tasks).assigneeCount).toBe(2);
    });

    it('calculates avg delay for overdue tasks', () => {
      const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');
      const tasks = [
        { echeance: twoDaysAgo, statut: 'en_cours' },
      ];
      const stats = getGroupStats(tasks);
      expect(stats.avgDelay).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPriorityStyle', () => {
    it('high → destructive', () => {
      const style = getPriorityStyle('high');
      expect(style.icon).toBe('⚠️');
      expect(style.className).toContain('destructive');
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
