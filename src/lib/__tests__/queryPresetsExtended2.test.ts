import { describe, it, expect } from 'vitest';
import {
  queryPresets,
  getQueryPreset,
} from '../queryPresets';

describe('queryPresets extended2', () => {
  describe('queryPresets structure', () => {
    const presetKeys = ['realtime', 'frequent', 'standard', 'reference', 'static'] as const;

    it('has all expected presets', () => {
      presetKeys.forEach(key => {
        expect(queryPresets[key]).toBeDefined();
      });
    });

    it('all presets have staleTime', () => {
      presetKeys.forEach(key => {
        expect(typeof queryPresets[key].staleTime).toBe('number');
      });
    });

    it('all presets have gcTime', () => {
      presetKeys.forEach(key => {
        expect(typeof queryPresets[key].gcTime).toBe('number');
      });
    });

    it('realtime staleTime < frequent staleTime', () => {
      expect(queryPresets.realtime.staleTime).toBeLessThan(queryPresets.frequent.staleTime);
    });

    it('frequent staleTime < standard staleTime', () => {
      expect(queryPresets.frequent.staleTime).toBeLessThan(queryPresets.standard.staleTime);
    });

    it('standard staleTime < reference staleTime', () => {
      expect(queryPresets.standard.staleTime).toBeLessThan(queryPresets.reference.staleTime);
    });

    it('reference staleTime < static staleTime', () => {
      expect(queryPresets.reference.staleTime).toBeLessThan(queryPresets.static.staleTime);
    });

    it('gcTime >= staleTime for all presets', () => {
      presetKeys.forEach(key => {
        expect(queryPresets[key].gcTime).toBeGreaterThanOrEqual(queryPresets[key].staleTime);
      });
    });
  });

  describe('getQueryPreset', () => {
    it('returns realtime preset', () => {
      expect(getQueryPreset('realtime')).toEqual(queryPresets.realtime);
    });
    it('returns frequent preset', () => {
      expect(getQueryPreset('frequent')).toEqual(queryPresets.frequent);
    });
    it('returns standard preset', () => {
      expect(getQueryPreset('standard')).toEqual(queryPresets.standard);
    });
    it('returns reference preset', () => {
      expect(getQueryPreset('reference')).toEqual(queryPresets.reference);
    });
    it('returns static preset', () => {
      expect(getQueryPreset('static')).toEqual(queryPresets.static);
    });
  });

  describe('specific preset values', () => {
    it('realtime staleTime is 0', () => expect(queryPresets.realtime.staleTime).toBe(0));
    it('frequent staleTime is 30s', () => expect(queryPresets.frequent.staleTime).toBe(30 * 1000));
    it('standard staleTime is 2min', () => expect(queryPresets.standard.staleTime).toBe(2 * 60 * 1000));
    it('reference staleTime is 30min', () => expect(queryPresets.reference.staleTime).toBe(30 * 60 * 1000));
    it('static staleTime is 1h', () => expect(queryPresets.static.staleTime).toBe(60 * 60 * 1000));
  });
});
