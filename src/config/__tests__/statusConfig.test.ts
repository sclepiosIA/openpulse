import { describe, it, expect } from 'vitest';
import {
  PHASE_STATUTS,
  getStatusStyle,
  getStatusBadgeVariant,
  getStatusBorderColor,
  getStatusBgColor,
  getStatusTextColor,
  getPhaseFromStatus,
  HEALTH_COLORS,
  getHealthColors,
} from '../statusConfig';

describe('statusConfig', () => {
  describe('PHASE_STATUTS', () => {
    it('prospect has Prospect', () => expect(PHASE_STATUTS.prospect).toContain('Prospect'));
    it('deploiement has Contractuel', () => expect(PHASE_STATUTS.deploiement).toContain('Contractuel'));
    it('production has Production', () => expect(PHASE_STATUTS.production).toContain('Production'));
  });

  describe('getStatusStyle', () => {
    it('Production → success', () => {
      const style = getStatusStyle('Production');
      expect(style.bgColor).toContain('success');
      expect(style.badgeVariant).toBe('default');
    });
    it('Bloqué → destructive', () => {
      expect(getStatusStyle('Bloqué').badgeVariant).toBe('destructive');
    });
    it('Prospect → outline', () => {
      expect(getStatusStyle('Prospect').badgeVariant).toBe('outline');
    });
    it('unknown → default style', () => {
      expect(getStatusStyle('Unknown').badgeVariant).toBe('outline');
    });
  });

  describe('getStatusBadgeVariant', () => {
    it('delegates to getStatusStyle', () => {
      expect(getStatusBadgeVariant('Production')).toBe('default');
      expect(getStatusBadgeVariant('Bloqué')).toBe('destructive');
    });
  });

  describe('getStatusBorderColor', () => {
    it('returns border class', () => {
      expect(getStatusBorderColor('Production')).toContain('border-l-');
    });
  });

  describe('getStatusBgColor', () => {
    it('returns bg class', () => {
      expect(getStatusBgColor('Déploiement')).toContain('bg-');
    });
  });

  describe('getStatusTextColor', () => {
    it('returns text class', () => {
      expect(getStatusTextColor('Négociation')).toContain('text-');
    });
  });

  describe('getPhaseFromStatus', () => {
    it('Production → production', () => expect(getPhaseFromStatus('Production')).toBe('production'));
    it('Contractuel → deploiement', () => expect(getPhaseFromStatus('Contractuel')).toBe('deploiement'));
    it('Prospect → prospect', () => expect(getPhaseFromStatus('Prospect')).toBe('prospect'));
    it('Unknown → prospect (default)', () => expect(getPhaseFromStatus('xyz')).toBe('prospect'));
  });

  describe('HEALTH_COLORS', () => {
    it('has healthy', () => expect(HEALTH_COLORS.healthy.bg).toContain('success'));
    it('has at-risk', () => expect(HEALTH_COLORS['at-risk'].bg).toContain('warning'));
    it('has blocked', () => expect(HEALTH_COLORS.blocked.bg).toContain('destructive'));
  });

  describe('getHealthColors', () => {
    it('returns colors for valid status', () => {
      expect(getHealthColors('healthy').bg).toContain('success');
    });
    it('fallback to healthy for invalid', () => {
      expect(getHealthColors('invalid' as any).bg).toContain('success');
    });
  });
});
