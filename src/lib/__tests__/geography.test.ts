import { describe, it, expect } from 'vitest';
import { getRegionFromDepartment, validateRegion, determineRegion, getAllRegions } from '../geography';

describe('geography', () => {
  describe('getRegionFromDepartment', () => {
    it('returns null for empty', () => expect(getRegionFromDepartment('')).toBeNull());
    it('maps paris to Île-de-France', () => expect(getRegionFromDepartment('paris')).toBe('Île-de-France'));
    it('maps gironde to Nouvelle-Aquitaine', () => expect(getRegionFromDepartment('gironde')).toBe('Nouvelle-Aquitaine'));
    it('returns null for unknown department', () => expect(getRegionFromDepartment('unknown')).toBeNull());
    it('maps guadeloupe to Guadeloupe', () => expect(getRegionFromDepartment('guadeloupe')).toBe('Guadeloupe'));
    it('maps nord to Hauts-de-France', () => expect(getRegionFromDepartment('nord')).toBe('Hauts-de-France'));
    it('maps doubs to Bourgogne-Franche-Comté', () => expect(getRegionFromDepartment('doubs')).toBe('Bourgogne-Franche-Comté'));
  });

  describe('validateRegion', () => {
    it('returns null for empty', () => expect(validateRegion('')).toBeNull());
    it('validates exact region', () => expect(validateRegion('Bretagne')).toBe('Bretagne'));
    it('validates case-insensitive', () => expect(validateRegion('bretagne')).toBe('Bretagne'));
    it('validates with accent normalization', () => expect(validateRegion('ile-de-france')).toBe('Île-de-France'));
    it('returns null for invalid', () => expect(validateRegion('Unknown Region')).toBeNull());
  });

  describe('determineRegion', () => {
    it('returns valid region directly', () => expect(determineRegion('Lyon', 'Auvergne-Rhône-Alpes')).toBe('Auvergne-Rhône-Alpes'));
    it('maps department to region', () => expect(determineRegion('Lyon', 'doubs')).toBe('Bourgogne-Franche-Comté'));
    it('returns original if nothing matches', () => expect(determineRegion('City', 'Unknown')).toBe('Unknown'));
  });

  describe('getAllRegions', () => {
    it('returns 18 regions', () => expect(getAllRegions()).toHaveLength(18));
    it('includes metropolitan regions', () => {
      const regions = getAllRegions();
      expect(regions).toContain('Bretagne');
      expect(regions).toContain('Île-de-France');
    });
    it('includes overseas territories', () => {
      const regions = getAllRegions();
      expect(regions).toContain('Guadeloupe');
      expect(regions).toContain('Mayotte');
    });
  });
});
