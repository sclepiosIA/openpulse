import { describe, it, expect } from 'vitest';
import {
  JARVIS_COLORS,
  JARVIS_ANIMATIONS,
  JARVIS_LAYOUT,
  JARVIS_TYPOGRAPHY,
  JARVIS_COMPONENTS,
  JARVIS_DESIGN,
} from '../JarvisDesignSystem';

describe('JarvisDesignSystem', () => {
  it('exposes status colors using HSL', () => {
    expect(JARVIS_COLORS.status.online).toMatch(/^hsl\(/);
    expect(JARVIS_COLORS.status.error).toMatch(/^hsl\(/);
    expect(JARVIS_COLORS.primary.from).toMatch(/^hsl\(/);
  });

  it('animation duration presets are increasing', () => {
    const { instant, fast, normal, slow, slowest } = JARVIS_ANIMATIONS.duration;
    expect(instant).toBeLessThan(fast);
    expect(fast).toBeLessThan(normal);
    expect(normal).toBeLessThan(slow);
    expect(slow).toBeLessThan(slowest);
  });

  it('easing arrays have 4 numeric entries (cubic-bezier)', () => {
    for (const key of ['apple', 'smooth', 'bouncy'] as const) {
      const arr = JARVIS_ANIMATIONS.easing[key];
      expect(arr).toHaveLength(4);
      arr.forEach((n) => expect(typeof n).toBe('number'));
    }
  });

  it('layout radius/spacing/padding keys are tailwind tokens', () => {
    expect(JARVIS_LAYOUT.radius.full).toBe('rounded-full');
    expect(JARVIS_LAYOUT.spacing.md).toMatch(/^gap-/);
    expect(JARVIS_LAYOUT.padding.md).toMatch(/^p-/);
  });

  it('typography body uses semantic text classes', () => {
    expect(JARVIS_TYPOGRAPHY.heading.xl).toMatch(/text-/);
    expect(JARVIS_TYPOGRAPHY.body.sm).toMatch(/text-sm/);
  });

  it('components classes do not contain hardcoded hex colors', () => {
    const allStrings = JSON.stringify(JARVIS_COMPONENTS);
    expect(allStrings).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('JARVIS_DESIGN aggregates all sections', () => {
    expect(JARVIS_DESIGN.colors).toBe(JARVIS_COLORS);
    expect(JARVIS_DESIGN.animations).toBe(JARVIS_ANIMATIONS);
    expect(JARVIS_DESIGN.layout).toBe(JARVIS_LAYOUT);
    expect(JARVIS_DESIGN.typography).toBe(JARVIS_TYPOGRAPHY);
    expect(JARVIS_DESIGN.components).toBe(JARVIS_COMPONENTS);
  });
});
