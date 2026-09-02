import { describe, it, expect } from 'vitest';
import {
  isOccurrenceId,
  parseOccurrenceId,
  parseRRule,
  isEvenWeek,
  formatRecurrenceRule,
} from '../recurrenceUtils';

describe('recurrenceUtils extended', () => {
  describe('isOccurrenceId', () => {
    it('true for valid occurrence ID', () => expect(isOccurrenceId('task-1_occ_2026-03-09')).toBe(true));
    it('false for UUID', () => expect(isOccurrenceId('123e4567-e89b-12d3-a456-426614174000')).toBe(false));
    it('false for empty', () => expect(isOccurrenceId('')).toBe(false));
  });

  describe('parseOccurrenceId', () => {
    it('extracts parentId and date', () => {
      const result = parseOccurrenceId('task-abc_occ_2026-03-09');
      expect(result).toEqual({ parentId: 'task-abc', occurrenceDate: '2026-03-09' });
    });
    it('returns null for non-occurrence', () => {
      expect(parseOccurrenceId('regular-id')).toBeNull();
    });
    it('handles UUID parent', () => {
      const result = parseOccurrenceId('123e4567-e89b-12d3-a456-426614174000_occ_2026-01-01');
      expect(result?.parentId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('parseRRule', () => {
    it('parses FREQ', () => {
      expect(parseRRule('FREQ=DAILY').freq).toBe('DAILY');
      expect(parseRRule('FREQ=MONTHLY').freq).toBe('MONTHLY');
      expect(parseRRule('FREQ=YEARLY').freq).toBe('YEARLY');
    });
    it('parses INTERVAL', () => {
      expect(parseRRule('FREQ=WEEKLY;INTERVAL=2').interval).toBe(2);
    });
    it('defaults interval to 1', () => {
      expect(parseRRule('FREQ=WEEKLY').interval).toBe(1);
    });
    it('parses BYDAY', () => {
      expect(parseRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR').byDay).toEqual(['MO', 'WE', 'FR']);
    });
    it('parses COUNT', () => {
      expect(parseRRule('FREQ=WEEKLY;COUNT=10').count).toBe(10);
    });
    it('parses UNTIL', () => {
      const result = parseRRule('FREQ=WEEKLY;UNTIL=2026-12-31');
      expect(result.until).toBeDefined();
    });
    it('returns defaults for empty', () => {
      const result = parseRRule('');
      expect(result.freq).toBe('WEEKLY');
      expect(result.interval).toBe(1);
      expect(result.byDay).toEqual([]);
    });
  });

  describe('isEvenWeek', () => {
    it('returns boolean', () => {
      const result = isEvenWeek(new Date(2026, 0, 5)); // Week 2
      expect(typeof result).toBe('boolean');
    });
  });

  describe('formatRecurrenceRule', () => {
    it('returns empty for empty rule', () => {
      expect(formatRecurrenceRule('')).toBe('');
    });
    it('formats daily', () => {
      expect(formatRecurrenceRule('FREQ=DAILY')).toContain('Tous les jours');
    });
    it('formats daily with interval', () => {
      expect(formatRecurrenceRule('FREQ=DAILY;INTERVAL=3')).toContain('3 jours');
    });
    it('formats weekly', () => {
      expect(formatRecurrenceRule('FREQ=WEEKLY')).toContain('semaines');
    });
    it('formats bi-weekly', () => {
      expect(formatRecurrenceRule('FREQ=WEEKLY;INTERVAL=2')).toContain('1 semaine sur 2');
    });
    it('formats monthly', () => {
      expect(formatRecurrenceRule('FREQ=MONTHLY')).toContain('mois');
    });
    it('formats quarterly', () => {
      expect(formatRecurrenceRule('FREQ=MONTHLY;INTERVAL=3')).toContain('trimestre');
    });
    it('formats yearly', () => {
      expect(formatRecurrenceRule('FREQ=YEARLY')).toContain('ans');
    });
    it('formats with weekdays', () => {
      const result = formatRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
      expect(result).toContain('ouvrés');
    });
    it('formats with weekend days', () => {
      const result = formatRecurrenceRule('FREQ=WEEKLY;BYDAY=SA,SU');
      expect(result).toContain('week-end');
    });
    it('formats with specific days', () => {
      const result = formatRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,WE');
      expect(result).toContain('lundi');
      expect(result).toContain('mercredi');
    });
  });
});
