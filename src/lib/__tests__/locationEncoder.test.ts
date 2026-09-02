import { describe, it, expect } from 'vitest';
import { parseLocation, encodeLocation, getDisplayAddress } from '../locationEncoder';

describe('locationEncoder', () => {
  describe('parseLocation', () => {
    it('returns empty for null/undefined/empty', () => {
      expect(parseLocation(null)).toEqual({ address: '', coords: null, raw: '' });
      expect(parseLocation(undefined)).toEqual({ address: '', coords: null, raw: '' });
      expect(parseLocation('')).toEqual({ address: '', coords: null, raw: '' });
    });

    it('parses address with coords', () => {
      const r = parseLocation('12 rue de Rivoli, Paris [48.8566,2.3522]');
      expect(r.address).toBe('12 rue de Rivoli, Paris');
      expect(r.coords).toEqual({ lat: 48.8566, lng: 2.3522 });
    });

    it('parses negative coords', () => {
      const r = parseLocation('Punta Arenas [-53.1638,-70.9171]');
      expect(r.coords).toEqual({ lat: -53.1638, lng: -70.9171 });
    });

    it('returns address only if no coords', () => {
      const r = parseLocation('Salle de réunion 3');
      expect(r.address).toBe('Salle de réunion 3');
      expect(r.coords).toBeNull();
    });

    it('ignores malformed brackets', () => {
      const r = parseLocation('Lieu [abc,def]');
      expect(r.coords).toBeNull();
      expect(r.address).toBe('Lieu [abc,def]');
    });
  });

  describe('encodeLocation', () => {
    it('returns empty for empty address', () => {
      expect(encodeLocation('', null)).toBe('');
      expect(encodeLocation('   ', { lat: 1, lng: 2 })).toBe('');
    });

    it('returns address only when no coords', () => {
      expect(encodeLocation('Salle 3', null)).toBe('Salle 3');
    });

    it('appends coords with 6 decimals', () => {
      expect(encodeLocation('Paris', { lat: 48.8566, lng: 2.3522 })).toBe('Paris [48.856600,2.352200]');
    });

    it('round-trips with parseLocation', () => {
      const encoded = encodeLocation('Lyon', { lat: 45.764, lng: 4.8357 });
      const parsed = parseLocation(encoded);
      expect(parsed.address).toBe('Lyon');
      expect(parsed.coords?.lat).toBeCloseTo(45.764, 3);
      expect(parsed.coords?.lng).toBeCloseTo(4.8357, 3);
    });
  });

  describe('getDisplayAddress', () => {
    it('strips coords for display', () => {
      expect(getDisplayAddress('Paris [48.8566,2.3522]')).toBe('Paris');
      expect(getDisplayAddress('Salle 3')).toBe('Salle 3');
      expect(getDisplayAddress(null)).toBe('');
    });
  });
});
