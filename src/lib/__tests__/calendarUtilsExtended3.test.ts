import { describe, it, expect } from 'vitest';
import {
  getEtablissementColor,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
  calculateWorkload,
} from '../calendarUtils';

describe('calendarUtils extended3', () => {
  describe('getEtablissementColor', () => {
    it('returns a chart color', () => {
      const color = getEtablissementColor('abc', 'Hôpital');
      expect(color).toMatch(/^hsl\(var\(--chart-\d\)\)$/);
    });
    it('deterministic', () => {
      expect(getEtablissementColor('id1', 'N')).toBe(getEtablissementColor('id1', 'N'));
    });
  });

  describe('getPriorityColor', () => {
    it('high → destructive', () => expect(getPriorityColor('high')).toContain('destructive'));
    it('medium → warning', () => expect(getPriorityColor('medium')).toContain('warning'));
    it('low → success', () => expect(getPriorityColor('low')).toContain('success'));
    it('unknown → muted', () => expect(getPriorityColor('unknown')).toContain('muted'));
  });

  describe('getPriorityLabel', () => {
    it('high → Haute', () => expect(getPriorityLabel('high')).toBe('Haute'));
    it('medium → Moyenne', () => expect(getPriorityLabel('medium')).toBe('Moyenne'));
    it('low → Basse', () => expect(getPriorityLabel('low')).toBe('Basse'));
    it('unknown → Non définie', () => expect(getPriorityLabel('x')).toBe('Non définie'));
  });

  describe('getStatusColor', () => {
    it('terminee → success', () => expect(getStatusColor('terminee')).toContain('success'));
    it('en_cours → primary', () => expect(getStatusColor('en_cours')).toContain('primary'));
    it('en_attente → warning', () => expect(getStatusColor('en_attente')).toContain('warning'));
    it('bloquee → destructive', () => expect(getStatusColor('bloquee')).toContain('destructive'));
    it('unknown → muted', () => expect(getStatusColor('x')).toContain('muted'));
  });

  describe('getStatusLabel', () => {
    it('terminee → Terminée', () => expect(getStatusLabel('terminee')).toBe('Terminée'));
    it('en_cours → En cours', () => expect(getStatusLabel('en_cours')).toBe('En cours'));
    it('en_attente → En attente', () => expect(getStatusLabel('en_attente')).toBe('En attente'));
    it('bloquee → Bloquée', () => expect(getStatusLabel('bloquee')).toBe('Bloquée'));
    it('unknown → passthrough', () => expect(getStatusLabel('custom')).toBe('custom'));
  });

  describe('calculateWorkload', () => {
    it('0 → low', () => expect(calculateWorkload(0)).toBe('low'));
    it('1 → low', () => expect(calculateWorkload(1)).toBe('low'));
    it('3 → low', () => expect(calculateWorkload(3)).toBe('low'));
    it('4 → medium', () => expect(calculateWorkload(4)).toBe('medium'));
    it('6 → medium', () => expect(calculateWorkload(6)).toBe('medium'));
    it('7 → high', () => expect(calculateWorkload(7)).toBe('high'));
    it('100 → high', () => expect(calculateWorkload(100)).toBe('high'));
  });
});
