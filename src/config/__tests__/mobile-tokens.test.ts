import { describe, it, expect } from 'vitest';
import { mobileDesignTokens } from '../mobile-tokens';

describe('mobile-tokens', () => {
  it('breakpoints sont strictement croissants', () => {
    const { xs, sm, md, lg } = mobileDesignTokens.breakpoints;
    expect(xs).toBeLessThan(sm);
    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
  });

  it('touch targets respectent le minimum WCAG (44px)', () => {
    const { min, comfortable, large } = mobileDesignTokens.touchTargets;
    expect(min).toBeGreaterThanOrEqual(44);
    expect(comfortable).toBeGreaterThanOrEqual(min);
    expect(large).toBeGreaterThanOrEqual(comfortable);
  });

  it('animations: durées numériquement croissantes', () => {
    const ms = (v: string) => parseInt(v.replace('ms', ''), 10);
    const { fast, normal, slow, reducedMotion } = mobileDesignTokens.animations;
    expect(ms(fast)).toBeLessThan(ms(normal));
    expect(ms(normal)).toBeLessThan(ms(slow));
    expect(ms(reducedMotion)).toBeLessThan(ms(fast));
  });

  it('swipe: seuils cohérents (threshold < maxDistance, velocity in 0-1)', () => {
    const { threshold, velocity, maxDistance } = mobileDesignTokens.swipe;
    expect(threshold).toBeLessThan(maxDistance);
    expect(velocity).toBeGreaterThan(0);
    expect(velocity).toBeLessThanOrEqual(1);
  });

  it('typography mobile expose h1/h2/h3/body', () => {
    const t = mobileDesignTokens.typography.mobile;
    expect(t.h1).toContain('text-');
    expect(t.h2).toContain('text-');
    expect(t.body).toContain('text-');
  });
});
