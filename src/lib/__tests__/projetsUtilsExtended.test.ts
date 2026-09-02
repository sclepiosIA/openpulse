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

describe('projetsUtils', () => {
  describe('constants', () => {
    it('TASK_STATUSES has 4', () => expect(TASK_STATUSES.length).toBe(4));
    it('TASK_PRIORITIES has 3', () => expect(TASK_PRIORITIES.length).toBe(3));
    it('STATUS_LABELS_FR maps A faire', () => expect(STATUS_LABELS_FR['A faire']).toBe('À faire'));
    it('PRIORITY_LABELS_FR maps high', () => expect(PRIORITY_LABELS_FR.high).toBe('Haute'));
    it('PRIORITY_COLORS has high', () => expect(PRIORITY_COLORS.high).toContain('destructive'));
    it('STATUS_COLORS has Terminé', () => expect(STATUS_COLORS['Terminé']).toContain('success'));
  });

  describe('getStatusLabelFr', () => {
    it('maps known', () => expect(getStatusLabelFr('A faire')).toBe('À faire'));
    it('returns raw for unknown', () => expect(getStatusLabelFr('Custom')).toBe('Custom'));
  });

  describe('getPriorityLabelFr', () => {
    it('maps high', () => expect(getPriorityLabelFr('high')).toBe('Haute'));
    it('maps medium', () => expect(getPriorityLabelFr('medium')).toBe('Moyenne'));
    it('returns raw for unknown', () => expect(getPriorityLabelFr('x')).toBe('x'));
  });

  describe('formatDateFr', () => {
    it('formats date', () => expect(formatDateFr('2026-03-09')).toContain('09'));
    it('returns N/A for null', () => expect(formatDateFr(null)).toBe('N/A'));
  });

  describe('isOverdue', () => {
    it('true for past date non-completed', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      expect(isOverdue(past.toISOString(), 'En cours')).toBe(true);
    });
    it('false for Terminé', () => {
      const past = new Date();
      past.setDate(past.getDate() - 5);
      expect(isOverdue(past.toISOString(), 'Terminé')).toBe(false);
    });
    it('false for null echeance', () => expect(isOverdue(null, 'En cours')).toBe(false));
    it('false for future date', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(isOverdue(future.toISOString(), 'En cours')).toBe(false);
    });
  });

  describe('getDaysUntilDue', () => {
    it('returns null for null', () => expect(getDaysUntilDue(null)).toBeNull());
    it('returns positive for future', () => {
      const future = new Date();
      future.setDate(future.getDate() + 5);
      expect(getDaysUntilDue(future.toISOString())).toBeGreaterThanOrEqual(4);
    });
    it('returns negative for past', () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      expect(getDaysUntilDue(past.toISOString())).toBeLessThan(0);
    });
  });

  describe('getEtablissementColor', () => {
    it('returns primary for empty', () => {
      expect(getEtablissementColor('', '')).toBe('hsl(var(--primary))');
    });
    it('returns hsl for valid', () => {
      expect(getEtablissementColor('id1', 'CHU Paris')).toMatch(/^hsl\(\d+, 70%, 45%\)$/);
    });
    it('is deterministic', () => {
      expect(getEtablissementColor('a', 'b')).toBe(getEtablissementColor('a', 'b'));
    });
  });
});
