import { describe, it, expect } from 'vitest';
import { mobileDesignTokens } from '../mobile-tokens';

describe('mobile-tokens', () => {
  describe('breakpoints', () => {
    it('xs < sm < md < lg', () => {
      const { xs, sm, md, lg } = mobileDesignTokens.breakpoints;
      expect(xs).toBeLessThan(sm);
      expect(sm).toBeLessThan(md);
      expect(md).toBeLessThan(lg);
    });
    it('xs = 320', () => expect(mobileDesignTokens.breakpoints.xs).toBe(320));
  });

  describe('touchTargets', () => {
    it('min ≥ 44 (WCAG)', () => expect(mobileDesignTokens.touchTargets.min).toBeGreaterThanOrEqual(44));
    it('comfortable > min', () => expect(mobileDesignTokens.touchTargets.comfortable).toBeGreaterThan(mobileDesignTokens.touchTargets.min));
    it('large > comfortable', () => expect(mobileDesignTokens.touchTargets.large).toBeGreaterThan(mobileDesignTokens.touchTargets.comfortable));
  });

  describe('spacing', () => {
    it('section has py + px', () => expect(mobileDesignTokens.spacing.section).toContain('py-'));
    it('card has p-', () => expect(mobileDesignTokens.spacing.card).toContain('p-'));
    it('safeArea has top/bottom', () => {
      expect(mobileDesignTokens.spacing.safeArea.top).toBeTruthy();
      expect(mobileDesignTokens.spacing.safeArea.bottom).toBeTruthy();
    });
  });

  describe('typography', () => {
    it('h1 is text-2xl', () => expect(mobileDesignTokens.typography.mobile.h1).toContain('text-2xl'));
    it('body is text-base', () => expect(mobileDesignTokens.typography.mobile.body).toContain('text-base'));
  });

  describe('animations', () => {
    it('fast < normal < slow', () => {
      const { fast, normal, slow } = mobileDesignTokens.animations;
      expect(parseInt(fast)).toBeLessThan(parseInt(normal));
      expect(parseInt(normal)).toBeLessThan(parseInt(slow));
    });
    it('reducedMotion is minimal', () => expect(parseInt(mobileDesignTokens.animations.reducedMotion)).toBeLessThanOrEqual(10));
  });

  describe('swipe', () => {
    it('threshold > 0', () => expect(mobileDesignTokens.swipe.threshold).toBeGreaterThan(0));
    it('maxDistance > threshold', () => expect(mobileDesignTokens.swipe.maxDistance).toBeGreaterThan(mobileDesignTokens.swipe.threshold));
    it('velocity > 0', () => expect(mobileDesignTokens.swipe.velocity).toBeGreaterThan(0));
  });
});
