import { describe, it, expect } from 'vitest';
import {
  isGenericDomain, GENERIC_EMAIL_DOMAINS, formatContactRole,
  cleanImapResidues, fixMalformedEncoding,
  sanitizeEmailSubject, sanitizeDisplayName, truncateSafe,
  formatEmailAddress, parseEmailAddresses, isValidEmail,
  stripMimeHeaders, decodeEmailContent,
} from '../emailUtils';

describe('emailUtils', () => {
  describe('isGenericDomain', () => {
    it('detects gmail', () => expect(isGenericDomain('gmail.com')).toBe(true));
    it('detects hotmail.fr', () => expect(isGenericDomain('hotmail.fr')).toBe(true));
    it('rejects custom domain', () => expect(isGenericDomain('company.com')).toBe(false));
    it('is case insensitive', () => expect(isGenericDomain('Gmail.COM')).toBe(true));
  });

  describe('GENERIC_EMAIL_DOMAINS', () => {
    it('includes major providers', () => {
      expect(GENERIC_EMAIL_DOMAINS).toContain('gmail.com');
      expect(GENERIC_EMAIL_DOMAINS).toContain('outlook.com');
      expect(GENERIC_EMAIL_DOMAINS).toContain('orange.fr');
    });
  });

  describe('formatContactRole', () => {
    it('maps direction', () => expect(formatContactRole('direction')).toBe('Direction'));
    it('maps dsi', () => expect(formatContactRole('dsi')).toBe('DSI'));
    it('returns null for null', () => expect(formatContactRole(null)).toBeNull());
    it('returns original for unknown', () => expect(formatContactRole('custom')).toBe('custom'));
  });

  describe('cleanImapResidues', () => {
    it('removes IMAP OK commands', () => {
      expect(cleanImapResidues('Hello) A0001 OK FETCH completed')).toBe('Hello');
    });
    it('removes orphan leading )', () => {
      expect(cleanImapResidues(') Content here')).toBe('Content here');
    });
    it('returns empty for empty', () => {
      expect(cleanImapResidues('')).toBe('');
    });
  });

  describe('fixMalformedEncoding', () => {
    it('fixes common patterns', () => {
      expect(fixMalformedEncoding('Ã©')).toBe('é');
      expect(fixMalformedEncoding('Ã§')).toBe('ç');
    });
    it('returns empty for empty', () => expect(fixMalformedEncoding('')).toBe(''));
    it('handles smart quotes', () => {
      expect(fixMalformedEncoding('â€™')).toBe("'");
    });
  });

  describe('sanitizeEmailSubject', () => {
    it('returns (Sans objet) for null', () => expect(sanitizeEmailSubject(null)).toBe('(Sans objet)'));
    it('returns (Sans objet) for empty', () => expect(sanitizeEmailSubject('')).toBe('(Sans objet)'));
    it('normalizes whitespace', () => expect(sanitizeEmailSubject('  Hello   World  ')).toBe('Hello World'));
    it('passes through normal subjects', () => expect(sanitizeEmailSubject('Meeting')).toBe('Meeting'));
  });

  describe('sanitizeDisplayName', () => {
    it('returns null for null', () => expect(sanitizeDisplayName(null)).toBeNull());
    it('normalizes whitespace', () => expect(sanitizeDisplayName('  Alice   Dupont  ')).toBe('Alice Dupont'));
  });

  describe('truncateSafe', () => {
    it('returns short text unchanged', () => expect(truncateSafe('hi', 10)).toBe('hi'));
    it('truncates long text', () => {
      const result = truncateSafe('Hello World this is a long text', 15);
      expect(result.length).toBeLessThanOrEqual(16);
      expect(result).toContain('…');
    });
  });

  describe('formatEmailAddress', () => {
    it('formats with name', () => expect(formatEmailAddress('Alice', 'a@b.com')).toBe('Alice <a@b.com>'));
    it('formats without name', () => expect(formatEmailAddress(null, 'a@b.com')).toBe('a@b.com'));
  });

  describe('parseEmailAddresses', () => {
    it('splits comma-separated', () => {
      expect(parseEmailAddresses('a@b.com, c@d.com')).toEqual(['a@b.com', 'c@d.com']);
    });
    it('filters empty entries', () => {
      expect(parseEmailAddresses('a@b.com, , c@d.com')).toEqual(['a@b.com', 'c@d.com']);
    });
  });

  describe('isValidEmail', () => {
    it('validates correct email', () => expect(isValidEmail('test@example.com')).toBe(true));
    it('rejects invalid email', () => expect(isValidEmail('not-an-email')).toBe(false));
    it('rejects empty', () => expect(isValidEmail('')).toBe(false));
  });

  describe('stripMimeHeaders', () => {
    it('returns plain text as-is', () => {
      expect(stripMimeHeaders('Hello world')).toBe('Hello world');
    });
    it('strips Content-Type headers', () => {
      const input = 'Content-Type: text/plain\n\nHello world';
      expect(stripMimeHeaders(input)).toContain('Hello world');
    });
  });

  describe('decodeEmailContent', () => {
    it('returns empty for empty', () => expect(decodeEmailContent('')).toBe(''));
    it('normalizes line breaks', () => {
      expect(decodeEmailContent('Hello\r\nWorld')).toBe('Hello\nWorld');
    });
  });
});
