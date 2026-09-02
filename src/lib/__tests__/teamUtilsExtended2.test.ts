import { describe, it, expect } from 'vitest';
import {
  filterAndSortProfiles,
  getWorkloadColor,
  getWorkloadLabel,
  getCompletionRateColor,
  formatLastActivity,
} from '../teamUtils';

const makeProfile = (overrides: Record<string, any> = {}) => ({
  id: `p-${Math.random()}`,
  prenom: 'Jean',
  nom: 'Dupont',
  email: 'jean@test.com',
  role: 'commercial',
  actif: true,
  ...overrides,
});

const defaultFilters: any = {
  search: '',
  role: 'all',
  status: 'all',
  workload: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
};

const stats: any = {};

describe('teamUtils extended', () => {
  describe('filterAndSortProfiles', () => {
    it('returns all with no filters', () => {
      const profiles = [makeProfile(), makeProfile()];
      expect(filterAndSortProfiles(profiles, stats, defaultFilters)).toHaveLength(2);
    });

    it('filters by search on prenom', () => {
      const profiles = [makeProfile({ prenom: 'Alice' }), makeProfile({ prenom: 'Bob' })];
      expect(filterAndSortProfiles(profiles, stats, { ...defaultFilters, search: 'Alice' })).toHaveLength(1);
    });

    it('filters by search on nom', () => {
      const profiles = [makeProfile({ nom: 'Martin' }), makeProfile({ nom: 'Durand' })];
      expect(filterAndSortProfiles(profiles, stats, { ...defaultFilters, search: 'Martin' })).toHaveLength(1);
    });

    it('filters by search on email', () => {
      const profiles = [makeProfile({ email: 'alice@test.com' }), makeProfile({ email: 'bob@test.com' })];
      expect(filterAndSortProfiles(profiles, stats, { ...defaultFilters, search: 'alice' })).toHaveLength(1);
    });

    it('filters by role', () => {
      const profiles = [makeProfile({ role: 'admin' }), makeProfile({ role: 'commercial' })];
      expect(filterAndSortProfiles(profiles, stats, { ...defaultFilters, role: 'admin' })).toHaveLength(1);
    });

    it('filters by active status', () => {
      const profiles = [makeProfile({ actif: true }), makeProfile({ actif: false })];
      expect(filterAndSortProfiles(profiles, stats, { ...defaultFilters, status: 'actif' })).toHaveLength(1);
    });

    it('filters by inactive status', () => {
      const profiles = [makeProfile({ actif: true }), makeProfile({ actif: false })];
      expect(filterAndSortProfiles(profiles, stats, { ...defaultFilters, status: 'inactif' })).toHaveLength(1);
    });

    it('filters by workload', () => {
      const p1 = makeProfile();
      const p2 = makeProfile();
      const localStats: any = {
        [p1.id]: { workload: 'high', totalProjects: 5, totalTasks: 10, completionRate: 50, lastActivity: null },
        [p2.id]: { workload: 'low', totalProjects: 1, totalTasks: 2, completionRate: 90, lastActivity: null },
      };
      expect(filterAndSortProfiles([p1, p2], localStats, { ...defaultFilters, workload: 'high' })).toHaveLength(1);
    });

    it('sorts by name ascending', () => {
      const profiles = [makeProfile({ nom: 'Z' }), makeProfile({ nom: 'A' })];
      const result = filterAndSortProfiles(profiles, stats, defaultFilters);
      expect(result[0].nom).toBe('A');
    });

    it('sorts by name descending', () => {
      const profiles = [makeProfile({ nom: 'A' }), makeProfile({ nom: 'Z' })];
      const result = filterAndSortProfiles(profiles, stats, { ...defaultFilters, sortOrder: 'desc' });
      expect(result[0].nom).toBe('Z');
    });

    it('sorts by projects', () => {
      const p1 = makeProfile();
      const p2 = makeProfile();
      const localStats: any = {
        [p1.id]: { totalProjects: 2, totalTasks: 0, completionRate: 0, lastActivity: null, workload: 'low' },
        [p2.id]: { totalProjects: 10, totalTasks: 0, completionRate: 0, lastActivity: null, workload: 'low' },
      };
      const result = filterAndSortProfiles([p1, p2], localStats, { ...defaultFilters, sortBy: 'projects' });
      expect(localStats[result[0].id].totalProjects).toBe(2);
    });
  });

  describe('formatLastActivity', () => {
    it('returns "Aucune activité" for null', () => {
      expect(formatLastActivity(null)).toBe('Aucune activité');
    });
    it('returns "Aujourd\'hui" for today', () => {
      expect(formatLastActivity(new Date())).toBe("Aujourd'hui");
    });
    it('returns "Hier" for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatLastActivity(yesterday)).toBe('Hier');
    });
    it('returns days for <7 days', () => {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      expect(formatLastActivity(d)).toBe('Il y a 3 jours');
    });
    it('returns weeks for <30 days', () => {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      expect(formatLastActivity(d)).toBe('Il y a 2 semaines');
    });
    it('returns months for 30+ days', () => {
      // Use millisecond arithmetic to avoid DST / clock-drift edge cases that
      // can make `setDate(-60)` resolve to a 59.99-day delta and floor to 1 month.
      const d = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);
      expect(formatLastActivity(d)).toBe('Il y a 2 mois');
    });
  });

  describe('getCompletionRateColor', () => {
    it('green for >= 75', () => expect(getCompletionRateColor(80)).toContain('green'));
    it('yellow for 50-74', () => expect(getCompletionRateColor(60)).toContain('yellow'));
    it('red for < 50', () => expect(getCompletionRateColor(30)).toContain('red'));
  });
});
