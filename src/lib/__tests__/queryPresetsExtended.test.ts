import { describe, it, expect } from 'vitest';
import { queryPresets, getQueryPreset } from '../queryPresets';

describe('queryPresets', () => {
  describe('preset values', () => {
    it('realtime has staleTime 0', () => expect(queryPresets.realtime.staleTime).toBe(0));
    it('frequent staleTime 30s', () => expect(queryPresets.frequent.staleTime).toBe(30000));
    it('standard staleTime 2min', () => expect(queryPresets.standard.staleTime).toBe(120000));
    it('reference staleTime 30min', () => expect(queryPresets.reference.staleTime).toBe(1800000));
    it('static staleTime 1h', () => expect(queryPresets.static.staleTime).toBe(3600000));
  });

  describe('gcTime ordering', () => {
    it('realtime < standard < reference < static', () => {
      expect(queryPresets.realtime.gcTime).toBeLessThan(queryPresets.standard.gcTime);
      expect(queryPresets.standard.gcTime).toBeLessThan(queryPresets.reference.gcTime);
      expect(queryPresets.reference.gcTime).toBeLessThan(queryPresets.static.gcTime);
    });
  });

  describe('getQueryPreset', () => {
    it('returns correct preset', () => {
      expect(getQueryPreset('realtime')).toEqual(queryPresets.realtime);
      expect(getQueryPreset('standard')).toEqual(queryPresets.standard);
      expect(getQueryPreset('static')).toEqual(queryPresets.static);
    });
  });
});
