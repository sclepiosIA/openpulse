import { describe, it, expect } from 'vitest';
import {
  statusColors,
  getPriorityColor,
  getEtablissementStatusColor,
  getCategoryColor,
  getPartenaireStatusColor,
} from '../emailStatusColors';

describe('emailStatusColors', () => {
  describe('statusColors', () => {
    it('has etablissement colors', () => expect(statusColors.etablissement.Prospect).toBeDefined());
    it('has priority colors', () => expect(statusColors.priority.haute).toBeDefined());
    it('has category colors', () => expect(statusColors.category.commercial).toBeDefined());
    it('has partenaire colors', () => expect(statusColors.partenaire.actif).toBeDefined());
  });

  describe('getPriorityColor', () => {
    it('haute → red', () => expect(getPriorityColor('haute')).toContain('red'));
    it('moyenne → yellow', () => expect(getPriorityColor('moyenne')).toContain('yellow'));
    it('basse → blue', () => expect(getPriorityColor('basse')).toContain('blue'));
    it('null → empty', () => expect(getPriorityColor(null)).toBe(''));
    it('unknown → empty', () => expect(getPriorityColor('unknown')).toBe(''));
  });

  describe('getEtablissementStatusColor', () => {
    it('Prospect → blue', () => expect(getEtablissementStatusColor('Prospect')).toContain('blue'));
    it('Production → emerald', () => expect(getEtablissementStatusColor('Production')).toContain('emerald'));
    it('unknown → gray fallback', () => expect(getEtablissementStatusColor('xyz')).toContain('gray'));
  });

  describe('getCategoryColor', () => {
    it('commercial → purple', () => expect(getCategoryColor('commercial')).toContain('purple'));
    it('support → cyan', () => expect(getCategoryColor('support')).toContain('cyan'));
    it('null → empty', () => expect(getCategoryColor(null)).toBe(''));
    it('unknown → gray fallback', () => expect(getCategoryColor('xyz')).toContain('gray'));
  });

  describe('getPartenaireStatusColor', () => {
    it('actif → green', () => expect(getPartenaireStatusColor('actif')).toContain('green'));
    it('prospect → blue', () => expect(getPartenaireStatusColor('prospect')).toContain('blue'));
    it('unknown → gray fallback', () => expect(getPartenaireStatusColor('xyz')).toContain('gray'));
  });
});
