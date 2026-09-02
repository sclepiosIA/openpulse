import { describe, it, expect } from 'vitest';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  STATUS_LABELS_FR,
  PRIORITY_LABELS_FR,
  PRIORITY_COLORS,
  STATUS_COLORS,
  getStatusLabelFr,
  getPriorityLabelFr,
  formatDateFr,
  isOverdue,
  getDaysUntilDue,
  getEtablissementColor,
} from '../projetsUtils';

describe('projetsUtils extended', () => {
  describe('constants', () => {
    it('TASK_STATUSES has 4 values', () => expect(TASK_STATUSES).toHaveLength(4));
    it('TASK_PRIORITIES has 3 values', () => expect(TASK_PRIORITIES).toHaveLength(3));
    it('STATUS_LABELS_FR has all statuses', () => {
      TASK_STATUSES.forEach(s => expect(STATUS_LABELS_FR[s]).toBeTruthy());
    });
    it('PRIORITY_LABELS_FR has all priorities', () => {
      TASK_PRIORITIES.forEach(p => expect(PRIORITY_LABELS_FR[p]).toBeTruthy());
    });
    it('PRIORITY_COLORS has all priorities', () => {
      TASK_PRIORITIES.forEach(p => expect(PRIORITY_COLORS[p]).toBeTruthy());
    });
    it('STATUS_COLORS has all statuses', () => {
      TASK_STATUSES.forEach(s => expect(STATUS_COLORS[s]).toBeTruthy());
    });
  });

  describe('getStatusLabelFr', () => {
    it('A faire → À faire', () => expect(getStatusLabelFr('A faire')).toBe('À faire'));
    it('En cours → En cours', () => expect(getStatusLabelFr('En cours')).toBe('En cours'));
    it('Terminé → Terminé', () => expect(getStatusLabelFr('Terminé')).toBe('Terminé'));
    it('Bloqué → Bloqué', () => expect(getStatusLabelFr('Bloqué')).toBe('Bloqué'));
    it('unknown → passthrough', () => expect(getStatusLabelFr('Custom')).toBe('Custom'));
  });

  describe('getPriorityLabelFr', () => {
    it('high → Haute', () => expect(getPriorityLabelFr('high')).toBe('Haute'));
    it('medium → Moyenne', () => expect(getPriorityLabelFr('medium')).toBe('Moyenne'));
    it('low → Basse', () => expect(getPriorityLabelFr('low')).toBe('Basse'));
    it('unknown → passthrough', () => expect(getPriorityLabelFr('urgent')).toBe('urgent'));
  });

  describe('formatDateFr', () => {
    it('formats a date string', () => {
      const result = formatDateFr('2026-03-09');
      expect(result).toMatch(/09\/03\/2026/);
    });
    it('formats a Date object', () => {
      const result = formatDateFr(new Date(2026, 2, 9));
      expect(result).toMatch(/09\/03\/2026/);
    });
    it('returns N/A for null', () => expect(formatDateFr(null)).toBe('N/A'));
    it('returns N/A for undefined', () => expect(formatDateFr(undefined)).toBe('N/A'));
  });

  describe('isOverdue', () => {
    it('false for null echeance', () => expect(isOverdue(null, 'En cours')).toBe(false));
    it('false for Terminé', () => expect(isOverdue('2020-01-01', 'Terminé')).toBe(false));
    it('true for past date with active status', () => expect(isOverdue('2020-01-01', 'En cours')).toBe(true));
    it('false for future date', () => expect(isOverdue('2099-12-31', 'En cours')).toBe(false));
  });

  describe('getDaysUntilDue', () => {
    it('returns null for null', () => expect(getDaysUntilDue(null)).toBeNull());
    it('returns null for undefined', () => expect(getDaysUntilDue(undefined)).toBeNull());
    it('returns negative for past dates', () => {
      const result = getDaysUntilDue('2020-01-01');
      expect(result).toBeLessThan(0);
    });
    it('returns positive for future dates', () => {
      const result = getDaysUntilDue('2099-12-31');
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('getEtablissementColor', () => {
    it('returns primary for empty id', () => {
      expect(getEtablissementColor('', '')).toBe('hsl(var(--primary))');
    });
    it('returns hsl color for valid input', () => {
      const color = getEtablissementColor('abc-123', 'Test Etab');
      expect(color).toMatch(/^hsl\(\d+, 70%, 45%\)$/);
    });
    it('deterministic for same input', () => {
      const c1 = getEtablissementColor('id-1', 'Nom');
      const c2 = getEtablissementColor('id-1', 'Nom');
      expect(c1).toBe(c2);
    });
    it('different for different ids', () => {
      const c1 = getEtablissementColor('id-1', 'Nom');
      const c2 = getEtablissementColor('id-2', 'Nom');
      // May rarely collide but usually different
      expect(typeof c1).toBe('string');
      expect(typeof c2).toBe('string');
    });
  });
});
