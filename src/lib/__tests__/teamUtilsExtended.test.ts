import { describe, it, expect } from 'vitest';
import {
  filterAndSortProfiles,
  getWorkloadColor,
  getWorkloadLabel,
  getCompletionRateColor,
  formatLastActivity,
} from '../teamUtils';

const profiles = [
  { id: 'u1', prenom: 'Jean', nom: 'Dupont', email: 'jean@t.com', role: 'admin', actif: true },
  { id: 'u2', prenom: 'Marie', nom: 'Martin', email: 'marie@t.com', role: 'csm', actif: true },
  { id: 'u3', prenom: 'Paul', nom: 'Bernard', email: 'paul@t.com', role: 'admin', actif: false },
];

const stats: Record<string, any> = {
  u1: { totalProjects: 5, totalTasks: 20, completionRate: 80, workload: 'high', lastActivity: new Date() },
  u2: { totalProjects: 3, totalTasks: 10, completionRate: 60, workload: 'medium', lastActivity: new Date(Date.now() - 86400000) },
  u3: { totalProjects: 1, totalTasks: 2, completionRate: 100, workload: 'low', lastActivity: null },
};

describe('teamUtils', () => {
  describe('filterAndSortProfiles', () => {
    it('filters by search', () => {
      const result = filterAndSortProfiles(profiles, stats, { search: 'jean', role: 'all', status: 'all', workload: 'all', sortBy: 'name', sortOrder: 'asc' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('u1');
    });

    it('filters by role', () => {
      const result = filterAndSortProfiles(profiles, stats, { search: '', role: 'admin', status: 'all', workload: 'all', sortBy: 'name', sortOrder: 'asc' });
      expect(result.length).toBe(2);
    });

    it('filters by status actif', () => {
      const result = filterAndSortProfiles(profiles, stats, { search: '', role: 'all', status: 'actif', workload: 'all', sortBy: 'name', sortOrder: 'asc' });
      expect(result.length).toBe(2);
    });

    it('filters by status inactif', () => {
      const result = filterAndSortProfiles(profiles, stats, { search: '', role: 'all', status: 'inactif', workload: 'all', sortBy: 'name', sortOrder: 'asc' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('u3');
    });

    it('filters by workload', () => {
      const result = filterAndSortProfiles(profiles, stats, { search: '', role: 'all', status: 'all', workload: 'high', sortBy: 'name', sortOrder: 'asc' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('u1');
    });

    it('sorts by tasks desc', () => {
      const result = filterAndSortProfiles(profiles, stats, { search: '', role: 'all', status: 'all', workload: 'all', sortBy: 'tasks', sortOrder: 'desc' });
      expect(result[0].id).toBe('u1'); // 20 tasks
    });

    it('sorts by completion asc', () => {
      const result = filterAndSortProfiles(profiles, stats, { search: '', role: 'all', status: 'all', workload: 'all', sortBy: 'completion', sortOrder: 'asc' });
      expect(result[0].id).toBe('u2'); // 60%
    });
  });

  describe('getWorkloadColor', () => {
    it('low → green', () => expect(getWorkloadColor('low')).toContain('green'));
    it('medium → yellow', () => expect(getWorkloadColor('medium')).toContain('yellow'));
    it('high → red', () => expect(getWorkloadColor('high')).toContain('red'));
  });

  describe('getWorkloadLabel', () => {
    it('low → Faible', () => expect(getWorkloadLabel('low')).toBe('Faible'));
    it('medium → Moyenne', () => expect(getWorkloadLabel('medium')).toBe('Moyenne'));
    it('high → Élevée', () => expect(getWorkloadLabel('high')).toBe('Élevée'));
  });

  describe('getCompletionRateColor', () => {
    it('75+ → green', () => expect(getCompletionRateColor(80)).toContain('green'));
    it('50-74 → yellow', () => expect(getCompletionRateColor(60)).toContain('yellow'));
    it('<50 → red', () => expect(getCompletionRateColor(30)).toContain('red'));
  });

  describe('formatLastActivity', () => {
    it('null → Aucune activité', () => expect(formatLastActivity(null)).toBe('Aucune activité'));
    it("today → Aujourd'hui", () => expect(formatLastActivity(new Date())).toBe("Aujourd'hui"));
    it('yesterday → Hier', () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(formatLastActivity(yesterday)).toBe('Hier');
    });
    it('3 days ago → Il y a 3 jours', () => {
      const d = new Date(Date.now() - 3 * 86400000);
      expect(formatLastActivity(d)).toBe('Il y a 3 jours');
    });
    it('2 weeks ago → Il y a 2 semaines', () => {
      const d = new Date(Date.now() - 14 * 86400000);
      expect(formatLastActivity(d)).toBe('Il y a 2 semaines');
    });
    it('2 months ago → Il y a 2 mois', () => {
      const d = new Date(Date.now() - 60 * 86400000);
      expect(formatLastActivity(d)).toBe('Il y a 2 mois');
    });
  });
});
