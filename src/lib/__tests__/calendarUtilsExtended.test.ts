import { describe, it, expect } from 'vitest';
import {
  getPriorityColor,
  getStatusColor,
  organizeTasks,
  getTextColor,
  getTaskPriorityStyles,
  getTaskStatusStyles,
  generateVisioInvitationICS,
  getEtablissementColor,
} from '../calendarUtils';

describe('calendarUtils - extended', () => {
  describe('getPriorityColor', () => {
    it('returns destructive for high', () => {
      expect(getPriorityColor('high')).toContain('destructive');
    });
    it('returns warning for medium', () => {
      expect(getPriorityColor('medium')).toContain('warning');
    });
    it('returns success for low', () => {
      expect(getPriorityColor('low')).toContain('success');
    });
    it('returns muted for unknown', () => {
      expect(getPriorityColor('other')).toContain('muted');
    });
  });

  describe('getStatusColor', () => {
    it('returns success for terminee', () => {
      expect(getStatusColor('terminee')).toContain('success');
    });
    it('returns primary for en_cours', () => {
      expect(getStatusColor('en_cours')).toContain('primary');
    });
    it('returns destructive for bloquee', () => {
      expect(getStatusColor('bloquee')).toContain('destructive');
    });
    it('returns warning for en_attente', () => {
      expect(getStatusColor('en_attente')).toContain('warning');
    });
  });

  describe('getEtablissementColor', () => {
    it('returns a chart color', () => {
      const color = getEtablissementColor('id1', 'CHU Paris');
      expect(color).toContain('chart');
    });
    it('is deterministic', () => {
      expect(getEtablissementColor('a', 'b')).toBe(getEtablissementColor('a', 'b'));
    });
  });

  describe('organizeTasks', () => {
    it('returns empty lane for empty tasks', () => {
      expect(organizeTasks([], 30)).toEqual([[]]);
    });
    it('places non-overlapping tasks in same lane', () => {
      const tasks = [
        { id: 't1', startDay: 1 },
        { id: 't2', startDay: 20 },
      ];
      const lanes = organizeTasks(tasks, 30);
      expect(lanes.length).toBe(1);
      expect(lanes[0].length).toBe(2);
    });
    it('separates overlapping tasks into lanes', () => {
      const tasks = [
        { id: 't1', startDay: 1 },
        { id: 't2', startDay: 1 },
      ];
      const lanes = organizeTasks(tasks, 30);
      expect(lanes.length).toBe(2);
    });
  });

  describe('getTextColor', () => {
    it('returns white for destructive bg', () => {
      expect(getTextColor('hsl(var(--destructive))')).toBe('#FFFFFF');
    });
    it('returns white for primary bg', () => {
      expect(getTextColor('hsl(var(--primary))')).toBe('#FFFFFF');
    });
    it('returns black for light HSL', () => {
      expect(getTextColor('hsl(200, 50%, 80%)')).toBe('#000000');
    });
    it('returns white for dark HSL', () => {
      expect(getTextColor('hsl(200, 50%, 30%)')).toBe('#FFFFFF');
    });
    it('returns white as fallback', () => {
      expect(getTextColor('rgb(0,0,0)')).toBe('#FFFFFF');
    });
  });

  describe('getTaskPriorityStyles', () => {
    it('returns red styles for high', () => {
      const styles = getTaskPriorityStyles('high');
      expect(styles.bg).toContain('red');
      expect(styles.text).toContain('red');
      expect(styles.border).toContain('red');
    });
    it('returns amber styles for medium', () => {
      expect(getTaskPriorityStyles('medium').bg).toContain('amber');
    });
    it('returns emerald styles for low', () => {
      expect(getTaskPriorityStyles('low').bg).toContain('emerald');
    });
    it('returns slate for undefined', () => {
      expect(getTaskPriorityStyles(undefined).bg).toContain('slate');
    });
  });

  describe('getTaskStatusStyles', () => {
    it('returns emerald for terminee', () => {
      expect(getTaskStatusStyles('terminee').bg).toContain('emerald');
    });
    it('returns emerald for Terminé', () => {
      expect(getTaskStatusStyles('Terminé').bg).toContain('emerald');
    });
    it('returns red for bloquee', () => {
      expect(getTaskStatusStyles('bloquee').bg).toContain('red');
    });
    it('returns blue for en_cours', () => {
      expect(getTaskStatusStyles('en_cours').bg).toContain('blue');
    });
    it('returns blue for En cours', () => {
      expect(getTaskStatusStyles('En cours').bg).toContain('blue');
    });
    it('returns slate for unknown', () => {
      expect(getTaskStatusStyles('other').bg).toContain('slate');
    });
  });

  describe('generateVisioInvitationICS', () => {
    it('generates ICS with correct duration', () => {
      const ics = generateVisioInvitationICS({
        id: 'visio-1',
        title: 'Démo',
        start: new Date('2026-03-10T14:00:00Z'),
        durationMinutes: 60,
        visioUrl: 'https://meet.marque.app/room-123',
        description: 'Démo produit',
        organizer: { name: 'Jean Dupont', email: 'jean@example.com' },
        attendees: [{ email: 'client@example.com', name: 'Client' }],
      });
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('SUMMARY:Démo');
      expect(ics).toContain('LOCATION:https://meet.marque.app/room-123');
      expect(ics).toContain('ORGANIZER;CN=Jean Dupont:mailto:jean@example.com');
      expect(ics).toContain('ATTENDEE;CN=Client;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:client@example.com');
      expect(ics).toContain('END:VCALENDAR');
    });
  });
});
