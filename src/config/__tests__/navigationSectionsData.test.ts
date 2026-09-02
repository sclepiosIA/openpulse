import { describe, it, expect } from 'vitest';
import { navigationSections } from '../navigationSectionsData';

describe('navigationSectionsData', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(navigationSections)).toBe(true);
    expect(navigationSections.length).toBeGreaterThan(0);
  });

  it('every section has a name and items array', () => {
    navigationSections.forEach((s) => {
      expect(typeof s.section).toBe('string');
      expect(s.section.length).toBeGreaterThan(0);
      expect(Array.isArray(s.items)).toBe(true);
      expect(s.items.length).toBeGreaterThan(0);
    });
  });

  it('every item has label, path, and icon', () => {
    navigationSections.forEach((s) => {
      s.items.forEach((it: any) => {
        expect(typeof it.label).toBe('string');
        expect(it.label.length).toBeGreaterThan(0);
        expect(typeof it.path).toBe('string');
        expect(it.path.startsWith('/')).toBe(true);
        expect(it.icon).toBeTruthy();
      });
    });
  });

  it('paths are unique across all sections', () => {
    const paths = navigationSections.flatMap((s) => s.items.map((i: any) => i.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('contains the General section with dashboard', () => {
    const general = navigationSections.find((s) => s.section === 'Général');
    expect(general).toBeTruthy();
    const dashboard = general?.items.find((i: any) => i.path === '/');
    expect(dashboard).toBeTruthy();
    expect((dashboard as any).exactMatch).toBe(true);
  });
});
