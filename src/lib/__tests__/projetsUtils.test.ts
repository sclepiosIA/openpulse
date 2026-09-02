import { describe, it, expect } from 'vitest';
import {
  TASK_STATUSES, TASK_PRIORITIES,
  STATUS_LABELS_FR, PRIORITY_LABELS_FR,
  PRIORITY_COLORS, STATUS_COLORS,
  getStatusLabelFr, getPriorityLabelFr,
  formatDateFr, isOverdue, getDaysUntilDue,
  getEtablissementColor,
} from '../projetsUtils';

describe('projetsUtils', () => {
  describe('constants', () => {
    it('has 4 statuses', () => expect(TASK_STATUSES).toHaveLength(4));
    it('has 3 priorities', () => expect(TASK_PRIORITIES).toHaveLength(3));
    it('has color for each status', () => {
      TASK_STATUSES.forEach(s => expect(STATUS_COLORS[s]).toBeDefined());
    });
    it('has color for each priority', () => {
      TASK_PRIORITIES.forEach(p => expect(PRIORITY_COLORS[p]).toBeDefined());
    });
  });

  describe('getStatusLabelFr', () => {
    it('returns French label', () => expect(getStatusLabelFr('A faire')).toBe('À faire'));
    it('returns raw for unknown', () => expect(getStatusLabelFr('custom')).toBe('custom'));
  });

  describe('getPriorityLabelFr', () => {
    it('returns French label', () => expect(getPriorityLabelFr('high')).toBe('Haute'));
    it('returns raw for unknown', () => expect(getPriorityLabelFr('urgent')).toBe('urgent'));
  });

  describe('formatDateFr', () => {
    it('formats date string', () => {
      const result = formatDateFr('2025-03-15');
      expect(result).toContain('15');
      expect(result).toContain('03');
      expect(result).toContain('2025');
    });
    it('returns N/A for null', () => expect(formatDateFr(null)).toBe('N/A'));
    it('returns N/A for undefined', () => expect(formatDateFr(undefined)).toBe('N/A'));
  });

  describe('isOverdue', () => {
    it('returns true for past date', () => {
      expect(isOverdue('2020-01-01', 'En cours')).toBe(true);
    });
    it('returns false for completed tasks', () => {
      expect(isOverdue('2020-01-01', 'Terminé')).toBe(false);
    });
    it('returns false for null echeance', () => {
      expect(isOverdue(null, 'En cours')).toBe(false);
    });
    it('returns false for future date', () => {
      expect(isOverdue('2099-12-31', 'En cours')).toBe(false);
    });
  });

  describe('getDaysUntilDue', () => {
    it('returns null for null date', () => {
      expect(getDaysUntilDue(null)).toBeNull();
    });
    it('returns negative for past date', () => {
      expect(getDaysUntilDue('2020-01-01')).toBeLessThan(0);
    });
    it('returns positive for future date', () => {
      expect(getDaysUntilDue('2099-12-31')).toBeGreaterThan(0);
    });
  });

  describe('getEtablissementColor', () => {
    it('returns primary for empty ID', () => {
      expect(getEtablissementColor('', '')).toBe('hsl(var(--primary))');
    });
    it('returns HSL color for valid input', () => {
      const color = getEtablissementColor('abc-123', 'CHU Paris');
      expect(color).toMatch(/^hsl\(\d+, 70%, 45%\)$/);
    });
    it('returns deterministic color', () => {
      const c1 = getEtablissementColor('abc', 'Test');
      const c2 = getEtablissementColor('abc', 'Test');
      expect(c1).toBe(c2);
    });
  });
});
