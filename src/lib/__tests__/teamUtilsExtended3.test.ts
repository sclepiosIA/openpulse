import { describe, it, expect } from 'vitest';
import { getWorkloadColor, getWorkloadLabel, getCompletionRateColor, formatLastActivity, filterAndSortProfiles } from '../teamUtils';

describe('teamUtils extended3', () => {
  describe('getWorkloadColor', () => {
    it('low → green', () => expect(getWorkloadColor('low')).toBe('bg-green-500'));
    it('medium → yellow', () => expect(getWorkloadColor('medium')).toBe('bg-yellow-500'));
    it('high → red', () => expect(getWorkloadColor('high')).toBe('bg-red-500'));
  });

  describe('getWorkloadLabel', () => {
    it('low → Faible', () => expect(getWorkloadLabel('low')).toBe('Faible'));
    it('medium → Moyenne', () => expect(getWorkloadLabel('medium')).toBe('Moyenne'));
    it('high → Élevée', () => expect(getWorkloadLabel('high')).toBe('Élevée'));
  });

  describe('getCompletionRateColor', () => {
    it('≥75 → green', () => expect(getCompletionRateColor(75)).toBe('text-green-600'));
    it('90 → green', () => expect(getCompletionRateColor(90)).toBe('text-green-600'));
    it('50 → yellow', () => expect(getCompletionRateColor(50)).toBe('text-yellow-600'));
    it('74 → yellow', () => expect(getCompletionRateColor(74)).toBe('text-yellow-600'));
    it('49 → red', () => expect(getCompletionRateColor(49)).toBe('text-red-600'));
    it('0 → red', () => expect(getCompletionRateColor(0)).toBe('text-red-600'));
  });

  describe('formatLastActivity', () => {
    it('null → Aucune activité', () => expect(formatLastActivity(null)).toBe('Aucune activité'));
    it("today → Aujourd'hui", () => expect(formatLastActivity(new Date())).toBe("Aujourd'hui"));
    it('yesterday → Hier', () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      expect(formatLastActivity(d)).toBe('Hier');
    });
    it('3 days → Il y a 3 jours', () => {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      expect(formatLastActivity(d)).toBe('Il y a 3 jours');
    });
    it('10 days → weeks', () => {
      const d = new Date();
      d.setDate(d.getDate() - 10);
      expect(formatLastActivity(d)).toContain('semaine');
    });
    it('60 days → months', () => {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      expect(formatLastActivity(d)).toContain('mois');
    });
  });

  describe('filterAndSortProfiles', () => {
    const profiles = [
      { id: '1', prenom: 'Alice', nom: 'Martin', email: 'alice@test.fr', role: 'admin', actif: true },
      { id: '2', prenom: 'Bob', nom: 'Dupont', email: 'bob@test.fr', role: 'commercial', actif: true },
      { id: '3', prenom: 'Claire', nom: 'Durand', email: 'claire@test.fr', role: 'admin', actif: false },
    ];
    const stats: any = {
      '1': { totalProjects: 5, totalTasks: 10, completionRate: 80, workload: 'high' },
      '2': { totalProjects: 2, totalTasks: 3, completionRate: 50, workload: 'low' },
      '3': { totalProjects: 0, totalTasks: 0, completionRate: 0, workload: 'low' },
    };
    const baseFilters = { search: '', role: 'all' as const, status: 'all' as const, workload: 'all' as const, sortBy: 'name' as const, sortOrder: 'asc' as const };

    it('no filters → all profiles', () => {
      expect(filterAndSortProfiles(profiles, stats, baseFilters)).toHaveLength(3);
    });

    it('search by name', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, search: 'alice' });
      expect(result).toHaveLength(1);
      expect(result[0].prenom).toBe('Alice');
    });

    it('search by email', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, search: 'bob@' });
      expect(result).toHaveLength(1);
    });

    it('filter by role', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, role: 'admin' as const });
      expect(result).toHaveLength(2);
    });

    it('filter by status actif', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, status: 'actif' as const });
      expect(result).toHaveLength(2);
    });

    it('filter by workload', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, workload: 'high' as const });
      expect(result).toHaveLength(1);
      expect(result[0].prenom).toBe('Alice');
    });

    it('sort by name asc', () => {
      const result = filterAndSortProfiles(profiles, stats, baseFilters);
      expect(result[0].prenom).toBe('Bob'); // Dupont before Durand before Martin
    });

    it('sort by projects desc', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, sortBy: 'projects' as const, sortOrder: 'desc' as const });
      expect(result[0].prenom).toBe('Alice');
    });

    it('sort by completion asc', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, sortBy: 'completion' as const, sortOrder: 'asc' as const });
      expect(stats[result[0].id]?.completionRate).toBe(0);
    });
  });
});
