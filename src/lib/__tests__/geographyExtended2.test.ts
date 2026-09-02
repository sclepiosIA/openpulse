import { describe, it, expect } from 'vitest';
import {
  getRegionFromDepartment,
  validateRegion,
  determineRegion,
  getAllRegions,
} from '../geography';

describe('geography (extended2)', () => {
  describe('getRegionFromDepartment', () => {
    it('paris → Île-de-France', () => expect(getRegionFromDepartment('paris')).toBe('Île-de-France'));
    it('Paris (capitalized) → Île-de-France', () => expect(getRegionFromDepartment('Paris')).toBe('Île-de-France'));
    it('calvados → Normandie', () => expect(getRegionFromDepartment('calvados')).toBe('Normandie'));
    it('morbihan → Bretagne', () => expect(getRegionFromDepartment('morbihan')).toBe('Bretagne'));
    it('nord → Hauts-de-France', () => expect(getRegionFromDepartment('nord')).toBe('Hauts-de-France'));
    it('unknown → null', () => expect(getRegionFromDepartment('pluto')).toBeNull());
    it('empty → null', () => expect(getRegionFromDepartment('')).toBeNull());
    it('moselle → Grand Est', () => expect(getRegionFromDepartment('moselle')).toBe('Grand Est'));
    it('gironde → Nouvelle-Aquitaine', () => expect(getRegionFromDepartment('gironde')).toBe('Nouvelle-Aquitaine'));
    it('aisne → Hauts-de-France', () => expect(getRegionFromDepartment('aisne')).toBe('Hauts-de-France'));
  });

  describe('validateRegion', () => {
    it('Île-de-France → Île-de-France', () => expect(validateRegion('Île-de-France')).toBe('Île-de-France'));
    it('case insensitive', () => expect(validateRegion('île-de-france')).toBe('Île-de-France'));
    it('without accent', () => expect(validateRegion('Ile-de-France')).toBe('Île-de-France'));
    it('Bretagne', () => expect(validateRegion('Bretagne')).toBe('Bretagne'));
    it('unknown → null', () => expect(validateRegion('Narnia')).toBeNull());
    it('empty → null', () => expect(validateRegion('')).toBeNull());
    it('DOM-TOM: Guadeloupe', () => expect(validateRegion('Guadeloupe')).toBe('Guadeloupe'));
    it('DOM-TOM: Mayotte', () => expect(validateRegion('Mayotte')).toBe('Mayotte'));
  });

  describe('determineRegion', () => {
    it('valid region passthrough', () => expect(determineRegion('Paris', 'Île-de-France')).toBe('Île-de-France'));
    it('department → region lookup', () => expect(determineRegion('Caen', 'calvados')).toBe('Normandie'));
    it('unknown → returns as-is', () => expect(determineRegion('', 'Unknown')).toBe('Unknown'));
  });

  describe('getAllRegions', () => {
    it('has 18 regions', () => expect(getAllRegions().length).toBe(18));
    it('includes Île-de-France', () => expect(getAllRegions()).toContain('Île-de-France'));
    it('includes Bretagne', () => expect(getAllRegions()).toContain('Bretagne'));
    it('includes DOM-TOM', () => {
      const regions = getAllRegions();
      expect(regions).toContain('Guadeloupe');
      expect(regions).toContain('Martinique');
      expect(regions).toContain('La Réunion');
      expect(regions).toContain('Mayotte');
      expect(regions).toContain('Guyane');
    });
    it('no duplicates', () => {
      const regions = getAllRegions();
      expect(new Set(regions).size).toBe(regions.length);
    });
  });
});
