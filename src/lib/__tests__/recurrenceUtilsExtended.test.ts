import { describe, it, expect } from 'vitest';
import {
  isOccurrenceId,
  parseOccurrenceId,
  parseRRule,
  isEvenWeek,
  formatRecurrenceRule,
  expandRecurringTask,
  expandAllRecurringTasks,
} from '../recurrenceUtils';
import { addDays, addMonths } from 'date-fns';

describe('recurrenceUtils', () => {
  describe('isOccurrenceId', () => {
    it('true for occurrence id', () => expect(isOccurrenceId('abc_occ_2026-01-01')).toBe(true));
    it('false for normal uuid', () => expect(isOccurrenceId('abc-def-123')).toBe(false));
  });

  describe('parseOccurrenceId', () => {
    it('parses valid occurrence id', () => {
      const result = parseOccurrenceId('uuid-123_occ_2026-03-09');
      expect(result).toEqual({ parentId: 'uuid-123', occurrenceDate: '2026-03-09' });
    });
    it('returns null for invalid', () => {
      expect(parseOccurrenceId('normal-id')).toBeNull();
    });
  });

  describe('parseRRule', () => {
    it('parses FREQ', () => {
      expect(parseRRule('FREQ=DAILY').freq).toBe('DAILY');
    });
    it('parses INTERVAL', () => {
      expect(parseRRule('FREQ=WEEKLY;INTERVAL=2').interval).toBe(2);
    });
    it('parses BYDAY', () => {
      expect(parseRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR').byDay).toEqual(['MO', 'WE', 'FR']);
    });
    it('parses COUNT', () => {
      expect(parseRRule('FREQ=DAILY;COUNT=10').count).toBe(10);
    });
    it('defaults to WEEKLY interval 1', () => {
      const result = parseRRule('');
      expect(result.freq).toBe('WEEKLY');
      expect(result.interval).toBe(1);
    });
  });

  describe('isEvenWeek', () => {
    it('returns boolean', () => {
      expect(typeof isEvenWeek(new Date())).toBe('boolean');
    });
  });

  describe('formatRecurrenceRule', () => {
    it('daily', () => expect(formatRecurrenceRule('FREQ=DAILY')).toBe('Tous les jours'));
    it('daily interval 3', () => expect(formatRecurrenceRule('FREQ=DAILY;INTERVAL=3')).toBe('Tous les 3 jours'));
    it('weekly', () => expect(formatRecurrenceRule('FREQ=WEEKLY')).toBe('Toutes les semaines'));
    it('biweekly', () => expect(formatRecurrenceRule('FREQ=WEEKLY;INTERVAL=2')).toBe('1 semaine sur 2'));
    it('monthly', () => expect(formatRecurrenceRule('FREQ=MONTHLY')).toBe('Tous les mois'));
    it('quarterly', () => expect(formatRecurrenceRule('FREQ=MONTHLY;INTERVAL=3')).toBe('Tous les trimestres'));
    it('yearly', () => expect(formatRecurrenceRule('FREQ=YEARLY')).toBe('Tous les ans'));
    it('weekdays only', () => {
      const result = formatRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
      expect(result).toContain('jours ouvrés');
    });
    it('weekends', () => {
      const result = formatRecurrenceRule('FREQ=WEEKLY;BYDAY=SA,SU');
      expect(result).toContain('week-ends');
    });
    it('specific days', () => {
      const result = formatRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,WE');
      expect(result).toContain('lundi');
      expect(result).toContain('mercredi');
    });
    it('empty string for empty rule', () => expect(formatRecurrenceRule('')).toBe(''));
  });

  describe('expandRecurringTask', () => {
    const rangeStart = new Date('2026-01-01');
    const rangeEnd = new Date('2026-03-31');

    it('returns original task if no recurrence', () => {
      const task = { id: 't1', titre: 'Test' };
      expect(expandRecurringTask(task, rangeStart, rangeEnd)).toEqual([task]);
    });

    it('returns original if missing dates', () => {
      const task = { id: 't1', recurrence_rule: 'FREQ=WEEKLY' };
      expect(expandRecurringTask(task, rangeStart, rangeEnd)).toEqual([task]);
    });

    it('expands weekly task', () => {
      const task = {
        id: 't1',
        recurrence_rule: 'FREQ=WEEKLY',
        date_debut: '2026-01-05',
        echeance: '2026-01-06',
      };
      const result = expandRecurringTask(task, rangeStart, rangeEnd);
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].id).toBe('t1'); // original first
      expect(result[1].id).toContain('_occ_');
      expect(result[1]._isRecurrenceOccurrence).toBe(true);
    });
  });

  describe('expandAllRecurringTasks', () => {
    it('expands multiple tasks', () => {
      const rangeStart = new Date('2026-01-01');
      const rangeEnd = new Date('2026-02-01');
      const tasks = [
        { id: 't1', titre: 'A' },
        { id: 't2', titre: 'B', recurrence_rule: 'FREQ=WEEKLY', date_debut: '2026-01-05', echeance: '2026-01-06' },
      ];
      const result = expandAllRecurringTasks(tasks, rangeStart, rangeEnd);
      expect(result.length).toBeGreaterThan(2);
    });
  });
});
