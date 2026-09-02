import { describe, it, expect } from 'vitest';
import {
  getWorkloadColor,
  getWorkloadLabel,
  getCompletionRateColor,
  formatLastActivity,
  filterAndSortProfiles,
} from '../teamUtils';

describe('teamUtils', () => {
  describe('getWorkloadColor', () => {
    it('returns green for low', () => {
      expect(getWorkloadColor('low')).toBe('bg-green-500');
    });
    it('returns yellow for medium', () => {
      expect(getWorkloadColor('medium')).toBe('bg-yellow-500');
    });
    it('returns red for high', () => {
      expect(getWorkloadColor('high')).toBe('bg-red-500');
    });
  });

  describe('getWorkloadLabel', () => {
    it('returns Faible for low', () => {
      expect(getWorkloadLabel('low')).toBe('Faible');
    });
    it('returns Élevée for high', () => {
      expect(getWorkloadLabel('high')).toBe('Élevée');
    });
  });

  describe('getCompletionRateColor', () => {
    it('returns green for high rate', () => {
      expect(getCompletionRateColor(80)).toBe('text-green-600');
    });
    it('returns yellow for medium rate', () => {
      expect(getCompletionRateColor(60)).toBe('text-yellow-600');
    });
    it('returns red for low rate', () => {
      expect(getCompletionRateColor(30)).toBe('text-red-600');
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
    it('returns days for recent', () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      expect(formatLastActivity(threeDaysAgo)).toBe('Il y a 3 jours');
    });
  });

  describe('filterAndSortProfiles', () => {
    const profiles = [
      { id: '1', prenom: 'Alice', nom: 'Dupont', email: 'alice@test.com', role: 'admin', actif: true },
      { id: '2', prenom: 'Bob', nom: 'Martin', email: 'bob@test.com', role: 'commercial', actif: true },
      { id: '3', prenom: 'Clara', nom: 'Petit', email: 'clara@test.com', role: 'csm', actif: false },
    ];
    const stats = {} as any;
    const baseFilters = { search: '', role: 'all' as const, status: 'all' as const, workload: 'all' as const, sortBy: 'name' as const, sortOrder: 'asc' as const };

    it('filters by search term', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, search: 'alice' });
      expect(result).toHaveLength(1);
      expect(result[0].prenom).toBe('Alice');
    });

    it('filters by role', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, role: 'commercial' });
      expect(result).toHaveLength(1);
    });

    it('sorts by name asc', () => {
      const result = filterAndSortProfiles(profiles, stats, baseFilters);
      expect(result[0].prenom).toBe('Alice');
    });

    it('sorts by name desc', () => {
      const result = filterAndSortProfiles(profiles, stats, { ...baseFilters, sortOrder: 'desc' });
      expect(result[0].prenom).toBe('Clara');
    });
  });
});
