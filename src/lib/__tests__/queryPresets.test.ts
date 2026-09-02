import { describe, it, expect } from 'vitest';
import { queryPresets, getQueryPreset } from '../queryPresets';

describe('queryPresets', () => {
  it('has realtime with 0 staleTime', () => {
    expect(queryPresets.realtime.staleTime).toBe(0);
  });

  it('has frequent with 30s staleTime', () => {
    expect(queryPresets.frequent.staleTime).toBe(30000);
  });

  it('has standard with 2min staleTime', () => {
    expect(queryPresets.standard.staleTime).toBe(2 * 60 * 1000);
  });

  it('has reference with 30min staleTime', () => {
    expect(queryPresets.reference.staleTime).toBe(30 * 60 * 1000);
  });

  it('has static with 1h staleTime', () => {
    expect(queryPresets.static.staleTime).toBe(60 * 60 * 1000);
  });

  it('staleTime increases: realtime < frequent < standard < reference < static', () => {
    const { realtime, frequent, standard, reference } = queryPresets;
    const staticPreset = queryPresets.static;
    expect(realtime.staleTime).toBeLessThan(frequent.staleTime);
    expect(frequent.staleTime).toBeLessThan(standard.staleTime);
    expect(standard.staleTime).toBeLessThan(reference.staleTime);
    expect(reference.staleTime).toBeLessThan(staticPreset.staleTime);
  });

  describe('getQueryPreset', () => {
    it('returns correct preset', () => {
      expect(getQueryPreset('standard')).toEqual(queryPresets.standard);
    });
  });
});
