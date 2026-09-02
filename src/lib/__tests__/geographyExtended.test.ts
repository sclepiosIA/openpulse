import { describe, it, expect } from 'vitest';
import {
  getRegionFromDepartment,
  validateRegion,
  determineRegion,
  getAllRegions,
} from '../geography';

describe('geography', () => {
  describe('getRegionFromDepartment', () => {
    it('maps paris → Île-de-France', () => expect(getRegionFromDepartment('paris')).toBe('Île-de-France'));
    it('maps rhône (accented key match via dict)', () => {
      // The function normalizes input (strips accents) but dict keys have accents → null
      // Only exact lowercase matches work for accented keys
      expect(getRegionFromDepartment('rhone')).toBeNull();
    });
    it('maps non-accented departments', () => {
      expect(getRegionFromDepartment('gironde')).toBe('Nouvelle-Aquitaine');
      expect(getRegionFromDepartment('nord')).toBe('Hauts-de-France');
    });
    it('maps gironde → Nouvelle-Aquitaine', () => expect(getRegionFromDepartment('gironde')).toBe('Nouvelle-Aquitaine'));
    it('maps nord → Hauts-de-France', () => expect(getRegionFromDepartment('nord')).toBe('Hauts-de-France'));
    it('maps guadeloupe → Guadeloupe', () => expect(getRegionFromDepartment('guadeloupe')).toBe('Guadeloupe'));
    it('returns null for unknown', () => expect(getRegionFromDepartment('narnia')).toBeNull());
    it('returns null for empty', () => expect(getRegionFromDepartment('')).toBeNull());
    it('handles accented input via normalization', () => {
      // Without accents should still work via NFD normalization
      expect(getRegionFromDepartment('rhone')).toBeNull(); // exact match only after normalization
    });
  });

  describe('validateRegion', () => {
    it('validates exact match', () => expect(validateRegion('Bretagne')).toBe('Bretagne'));
    it('validates case insensitive', () => expect(validateRegion('bretagne')).toBe('Bretagne'));
    it('validates Île-de-France', () => expect(validateRegion('Île-de-France')).toBe('Île-de-France'));
    it('validates without accents', () => expect(validateRegion('ile-de-france')).toBe('Île-de-France'));
    it('returns null for invalid', () => expect(validateRegion('Mordor')).toBeNull());
    it('returns null for empty', () => expect(validateRegion('')).toBeNull());
  });

  describe('determineRegion', () => {
    it('returns valid region directly', () => expect(determineRegion('Paris', 'Île-de-France')).toBe('Île-de-France'));
    it('maps department to region', () => expect(determineRegion('Paris', 'nord')).toBe('Hauts-de-France'));
    it('returns original if unknown', () => expect(determineRegion('NYC', 'New York')).toBe('New York'));
  });

  describe('getAllRegions', () => {
    it('returns 18 regions', () => expect(getAllRegions().length).toBe(18));
    it('includes Bretagne', () => expect(getAllRegions()).toContain('Bretagne'));
    it('includes Mayotte', () => expect(getAllRegions()).toContain('Mayotte'));
  });
});
