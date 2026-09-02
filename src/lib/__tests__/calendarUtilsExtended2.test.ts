import { describe, it, expect } from 'vitest';
import {
  calculateWorkload,
  organizeTasks,
  getTextColor,
  getTaskPriorityStyles,
  getTaskStatusStyles,
  getStatusSolidColor,
  generateSingleEventICS,
  getEtablissementColor,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from '../calendarUtils';

describe('calendarUtils (extended2)', () => {
  describe('calculateWorkload', () => {
    it('0 → low', () => expect(calculateWorkload(0)).toBe('low'));
    it('3 → low', () => expect(calculateWorkload(3)).toBe('low'));
    it('4 → medium', () => expect(calculateWorkload(4)).toBe('medium'));
    it('6 → medium', () => expect(calculateWorkload(6)).toBe('medium'));
    it('7 → high', () => expect(calculateWorkload(7)).toBe('high'));
  });

  describe('organizeTasks', () => {
    it('empty → [[]]', () => expect(organizeTasks([], 30)).toEqual([[]]));
    it('non-overlapping → single lane', () => {
      const tasks = [{ startDay: 0 }, { startDay: 10 }];
      const lanes = organizeTasks(tasks, 30);
      expect(lanes.length).toBe(1);
    });
    it('overlapping → multiple lanes', () => {
      const tasks = [{ startDay: 0 }, { startDay: 0 }, { startDay: 0 }];
      const lanes = organizeTasks(tasks, 30);
      expect(lanes.length).toBeGreaterThan(1);
    });
  });

  describe('getTextColor', () => {
    it('hsl destructive → white', () => expect(getTextColor('hsl(var(--destructive))')).toBe('#FFFFFF'));
    it('hsl primary → white', () => expect(getTextColor('hsl(var(--primary))')).toBe('#FFFFFF'));
    it('hsl light → black', () => expect(getTextColor('hsl(200, 50%, 80%)')).toBe('#000000'));
    it('hsl dark → white', () => expect(getTextColor('hsl(200, 50%, 30%)')).toBe('#FFFFFF'));
    it('fallback → white', () => expect(getTextColor('#333')).toBe('#FFFFFF'));
  });

  describe('getTaskPriorityStyles', () => {
    it('high → red', () => expect(getTaskPriorityStyles('high').bg).toContain('red'));
    it('medium → amber', () => expect(getTaskPriorityStyles('medium').bg).toContain('amber'));
    it('low → emerald', () => expect(getTaskPriorityStyles('low').bg).toContain('emerald'));
    it('undefined → slate', () => expect(getTaskPriorityStyles().bg).toContain('slate'));
  });

  describe('getTaskStatusStyles', () => {
    it('terminé → emerald', () => expect(getTaskStatusStyles('terminé').bg).toContain('emerald'));
    it('terminee → emerald', () => expect(getTaskStatusStyles('terminee').bg).toContain('emerald'));
    it('bloqué → red', () => expect(getTaskStatusStyles('bloqué').bg).toContain('red'));
    it('en cours → blue', () => expect(getTaskStatusStyles('en cours').bg).toContain('blue'));
    it('en_cours → blue', () => expect(getTaskStatusStyles('en_cours').bg).toContain('blue'));
    it('default → slate', () => expect(getTaskStatusStyles('other').bg).toContain('slate'));
  });

  describe('getStatusSolidColor', () => {
    it('terminé → emerald hex', () => expect(getStatusSolidColor('terminé')).toBe('#10B981'));
    it('bloqué → red hex', () => expect(getStatusSolidColor('bloqué')).toBe('#EF4444'));
    it('en cours → blue hex', () => expect(getStatusSolidColor('en cours')).toBe('#3B82F6'));
    it('default → indigo hex', () => expect(getStatusSolidColor('other')).toBe('#6366F1'));
  });

  describe('generateSingleEventICS', () => {
    it('generates valid ICS', () => {
      const ics = generateSingleEventICS({
        id: 'test-1',
        title: 'Test Event',
        start: new Date(2026, 2, 15, 14, 0),
        end: new Date(2026, 2, 15, 15, 0),
      });
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('SUMMARY:Test Event');
      expect(ics).toContain('UID:event-test-1@marque.app');
    });
    it('includes optional fields', () => {
      const ics = generateSingleEventICS({
        id: '2',
        title: 'Meeting',
        start: new Date(2026, 2, 15, 14, 0),
        end: new Date(2026, 2, 15, 15, 0),
        location: 'Salle A',
        description: 'Weekly sync',
        videoUrl: 'https://meet.google.com/abc',
      });
      expect(ics).toContain('LOCATION:Salle A');
      expect(ics).toContain('DESCRIPTION:Weekly sync');
      expect(ics).toContain('URL:https://meet.google.com/abc');
    });
  });

  describe('getEtablissementColor', () => {
    it('returns hsl color', () => expect(getEtablissementColor('id1', 'nom1')).toContain('hsl'));
    it('deterministic', () => {
      expect(getEtablissementColor('id1', 'nom1')).toBe(getEtablissementColor('id1', 'nom1'));
    });
  });

  describe('getPriorityColor/Label', () => {
    it('high → destructive', () => expect(getPriorityColor('high')).toContain('destructive'));
    it('medium → warning', () => expect(getPriorityColor('medium')).toContain('warning'));
    it('low → success', () => expect(getPriorityColor('low')).toContain('success'));
    it('high label', () => expect(getPriorityLabel('high')).toBe('Haute'));
    it('medium label', () => expect(getPriorityLabel('medium')).toBe('Moyenne'));
    it('unknown label', () => expect(getPriorityLabel('x')).toBe('Non définie'));
  });

  describe('getStatusColor/Label', () => {
    it('terminee → success', () => expect(getStatusColor('terminee')).toContain('success'));
    it('en_cours → primary', () => expect(getStatusColor('en_cours')).toContain('primary'));
    it('bloquee → destructive', () => expect(getStatusColor('bloquee')).toContain('destructive'));
    it('terminee label', () => expect(getStatusLabel('terminee')).toBe('Terminée'));
    it('en_attente label', () => expect(getStatusLabel('en_attente')).toBe('En attente'));
  });
});
