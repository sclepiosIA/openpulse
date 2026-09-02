import { describe, it, expect } from 'vitest';
import {
  GENERIC_EMAIL_DOMAINS,
  isGenericDomain,
  formatContactRole,
  cleanImapResidues,
  fixMalformedEncoding,
} from '../emailUtils';

describe('emailUtils (extended2)', () => {
  describe('GENERIC_EMAIL_DOMAINS', () => {
    it('includes gmail.com', () => expect(GENERIC_EMAIL_DOMAINS).toContain('gmail.com'));
    it('includes hotmail.com', () => expect(GENERIC_EMAIL_DOMAINS).toContain('hotmail.com'));
    it('includes orange.fr', () => expect(GENERIC_EMAIL_DOMAINS).toContain('orange.fr'));
    it('includes protonmail.com', () => expect(GENERIC_EMAIL_DOMAINS).toContain('protonmail.com'));
    it('has 30+ entries', () => expect(GENERIC_EMAIL_DOMAINS.length).toBeGreaterThan(30));
  });

  describe('isGenericDomain', () => {
    it('gmail.com → true', () => expect(isGenericDomain('gmail.com')).toBe(true));
    it('GMAIL.COM → true', () => expect(isGenericDomain('GMAIL.COM')).toBe(true));
    it('custom.com → false', () => expect(isGenericDomain('custom.com')).toBe(false));
  });

  describe('formatContactRole', () => {
    it('null → null', () => expect(formatContactRole(null)).toBeNull());
    it('direction → Direction', () => expect(formatContactRole('direction')).toBe('Direction'));
    it('informatique → DSI', () => expect(formatContactRole('informatique')).toBe('DSI'));
    it('dsi → DSI', () => expect(formatContactRole('dsi')).toBe('DSI'));
    it('dim → DIM', () => expect(formatContactRole('dim')).toBe('DIM'));
    it('rh → RH', () => expect(formatContactRole('rh')).toBe('RH'));
    it('unknown → passthrough', () => expect(formatContactRole('CustomRole')).toBe('CustomRole'));
    it('case insensitive', () => expect(formatContactRole('DIRECTION')).toBe('Direction'));
  });

  describe('cleanImapResidues', () => {
    it('removes FETCH residues', () => {
      const input = 'Hello\n) A0001 OK FETCH completed';
      expect(cleanImapResidues(input)).toBe('Hello');
    });
    it('removes orphan leading parenthesis', () => {
      expect(cleanImapResidues(') Hello')).toBe('Hello');
    });
    it('removes OK lines', () => {
      const input = 'Content\nA0002 OK UID SEARCH completed';
      expect(cleanImapResidues(input)).toBe('Content');
    });
    it('returns empty for falsy', () => expect(cleanImapResidues('')).toBe(''));
  });

  describe('fixMalformedEncoding', () => {
    it('fixes Ã© → é', () => expect(fixMalformedEncoding('caf\u00c3\u00a9')).toContain('é'));
    it('fixes quoted-printable =C3=A9', () => expect(fixMalformedEncoding('caf=C3=A9')).toBe('café'));
    it('fixes =E9', () => expect(fixMalformedEncoding('caf=E9')).toBe('café'));
    it('returns empty for empty', () => expect(fixMalformedEncoding('')).toBe(''));
    it('preserves clean text', () => expect(fixMalformedEncoding('Hello World')).toBe('Hello World'));
  });
});
