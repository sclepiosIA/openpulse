import { describe, it, expect } from 'vitest';
import {
  isOccurrenceId,
  parseOccurrenceId,
  parseRRule,
  isEvenWeek,
  formatRecurrenceRule,
  expandRecurringTask,
} from '../recurrenceUtils';

describe('recurrenceUtils', () => {
  it('isOccurrenceId', () => {
    expect(isOccurrenceId('abc_occ_2024-01-01')).toBe(true);
    expect(isOccurrenceId('abc')).toBe(false);
  });

  it('parseOccurrenceId', () => {
    expect(parseOccurrenceId('parent-id_occ_2024-03-15')).toEqual({
      parentId: 'parent-id',
      occurrenceDate: '2024-03-15',
    });
    expect(parseOccurrenceId('no-match')).toBeNull();
  });

  it('parseRRule defaults', () => {
    const r = parseRRule('');
    expect(r.freq).toBe('WEEKLY');
    expect(r.interval).toBe(1);
  });

  it('parseRRule complex', () => {
    const r = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR;COUNT=10');
    expect(r.freq).toBe('WEEKLY');
    expect(r.interval).toBe(2);
    expect(r.byDay).toEqual(['MO', 'WE', 'FR']);
    expect(r.count).toBe(10);
  });

  it('isEvenWeek', () => {
    expect(typeof isEvenWeek(new Date('2024-01-08'))).toBe('boolean');
  });

  it('formatRecurrenceRule daily', () => {
    expect(formatRecurrenceRule('FREQ=DAILY;INTERVAL=1')).toBe('Tous les jours');
    expect(formatRecurrenceRule('FREQ=DAILY;INTERVAL=3')).toBe('Tous les 3 jours');
  });

  it('formatRecurrenceRule weekly', () => {
    expect(formatRecurrenceRule('FREQ=WEEKLY;INTERVAL=1')).toBe('Toutes les semaines');
    expect(formatRecurrenceRule('FREQ=WEEKLY;INTERVAL=2')).toBe('1 semaine sur 2');
    expect(formatRecurrenceRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toContain('(jours ouvrés)');
    expect(formatRecurrenceRule('FREQ=WEEKLY;BYDAY=SA,SU')).toContain('(week-ends)');
  });

  it('formatRecurrenceRule monthly + yearly', () => {
    expect(formatRecurrenceRule('FREQ=MONTHLY;INTERVAL=1')).toBe('Tous les mois');
    expect(formatRecurrenceRule('FREQ=MONTHLY;INTERVAL=3')).toBe('Tous les trimestres');
    expect(formatRecurrenceRule('FREQ=YEARLY;INTERVAL=1')).toBe('Tous les ans');
  });

  it('formatRecurrenceRule empty', () => {
    expect(formatRecurrenceRule('')).toBe('');
  });

  it('expandRecurringTask returns original when no rule', () => {
    const t = { id: '1' };
    expect(expandRecurringTask(t, new Date('2024-01-01'), new Date('2024-12-31'))).toEqual([t]);
  });

  it('expandRecurringTask generates daily occurrences', () => {
    const out = expandRecurringTask(
      {
        id: 't1',
        date_debut: '2024-01-01',
        echeance: '2024-01-01',
        recurrence_rule: 'FREQ=DAILY;INTERVAL=1',
      },
      new Date('2024-01-01'),
      new Date('2024-01-05'),
    );
    expect(out.length).toBeGreaterThan(1);
    expect(out[0].id).toBe('t1');
    expect(out[1]._isRecurrenceOccurrence).toBe(true);
    expect(out[1]._parentTaskId).toBe('t1');
  });
});
