import { describe, it, expect } from 'vitest';
import {
  getPriorityLabel,
  getStatusLabel,
  calculateWorkload,
  getStatusSolidColor,
  generateSingleEventICS,
} from '../calendarUtils';

describe('calendarUtils', () => {
  describe('getPriorityLabel', () => {
    it('returns Haute for high', () => {
      expect(getPriorityLabel('high')).toBe('Haute');
    });
    it('returns Non définie for unknown', () => {
      expect(getPriorityLabel('unknown')).toBe('Non définie');
    });
  });

  describe('getStatusLabel', () => {
    it('returns Terminée for terminee', () => {
      expect(getStatusLabel('terminee')).toBe('Terminée');
    });
    it('returns raw for unknown', () => {
      expect(getStatusLabel('custom')).toBe('custom');
    });
  });

  describe('calculateWorkload', () => {
    it('returns low for 0 tasks', () => {
      expect(calculateWorkload(0)).toBe('low');
    });
    it('returns low for 3 tasks', () => {
      expect(calculateWorkload(3)).toBe('low');
    });
    it('returns medium for 5 tasks', () => {
      expect(calculateWorkload(5)).toBe('medium');
    });
    it('returns high for 10 tasks', () => {
      expect(calculateWorkload(10)).toBe('high');
    });
  });

  describe('getStatusSolidColor', () => {
    it('returns emerald for terminee', () => {
      expect(getStatusSolidColor('terminee')).toBe('#10B981');
    });
    it('returns red for bloquee', () => {
      expect(getStatusSolidColor('bloquee')).toBe('#EF4444');
    });
    it('returns blue for en_cours', () => {
      expect(getStatusSolidColor('en_cours')).toBe('#3B82F6');
    });
    it('returns indigo for unknown', () => {
      expect(getStatusSolidColor('other')).toBe('#6366F1');
    });
  });

  describe('generateSingleEventICS', () => {
    it('generates valid ICS content', () => {
      const ics = generateSingleEventICS({
        id: 'test-123',
        title: 'Réunion',
        start: new Date('2025-03-10T10:00:00Z'),
        end: new Date('2025-03-10T11:00:00Z'),
      });
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('SUMMARY:Réunion');
      expect(ics).toContain('UID:event-test-123@marque.app');
    });

    it('includes optional fields', () => {
      const ics = generateSingleEventICS({
        id: 'test',
        title: 'Test',
        start: new Date('2025-03-10T10:00:00Z'),
        end: new Date('2025-03-10T11:00:00Z'),
        description: 'Description test',
        location: 'Paris',
        videoUrl: 'https://meet.example.com',
      });
      expect(ics).toContain('DESCRIPTION:Description test');
      expect(ics).toContain('LOCATION:Paris');
      expect(ics).toContain('URL:https://meet.example.com');
    });
  });
});
