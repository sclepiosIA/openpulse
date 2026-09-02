import { describe, it, expect } from 'vitest';
import {
  isGenericDomain,
  formatContactRole,
  cleanImapResidues,
  fixMalformedEncoding,
  decodeEmailContent,
  stripMimeHeaders,
  sanitizeAllEmailFields,
} from '../emailUtils';

describe('emailUtils - encoding & sanitization', () => {
  describe('isGenericDomain', () => {
    it('detects gmail', () => expect(isGenericDomain('gmail.com')).toBe(true));
    it('detects hotmail.fr', () => expect(isGenericDomain('hotmail.fr')).toBe(true));
    it('rejects company domain', () => expect(isGenericDomain('marque.com')).toBe(false));
    it('is case insensitive', () => expect(isGenericDomain('GMAIL.COM')).toBe(true));
  });

  describe('formatContactRole', () => {
    it('returns null for null', () => expect(formatContactRole(null)).toBeNull());
    it('maps direction', () => expect(formatContactRole('direction')).toBe('Direction'));
    it('maps dsi', () => expect(formatContactRole('dsi')).toBe('DSI'));
    it('maps informatique', () => expect(formatContactRole('informatique')).toBe('DSI'));
    it('returns raw for unknown', () => expect(formatContactRole('custom')).toBe('custom'));
    it('is case insensitive', () => expect(formatContactRole('DIRECTION')).toBe('Direction'));
  });

  describe('cleanImapResidues', () => {
    it('returns empty for empty', () => {
      expect(cleanImapResidues('')).toBe('');
    });
    it('strips IMAP OK lines', () => {
      const input = 'Hello\nA0001 OK FETCH completed';
      expect(cleanImapResidues(input)).toBe('Hello');
    });
    it('strips FLAGS lines', () => {
      const input = '* FLAGS (\\Seen \\Draft)\nContent';
      expect(cleanImapResidues(input)).toBe('Content');
    });
  });

  describe('fixMalformedEncoding', () => {
    it('returns empty for empty', () => expect(fixMalformedEncoding('')).toBe(''));
    it('fixes common double-encoded é', () => {
      // The function should handle Ã© → é via dictionary
      const result = fixMalformedEncoding('Ã©');
      // May be decoded via tryDecodeUTF8DoubleEncoded or dictionary
      expect(result).not.toContain('Ã');
    });
    it('fixes quoted-printable =C3=A9', () => {
      expect(fixMalformedEncoding('=C3=A9')).toBe('é');
    });
    it('fixes NBSP characters', () => {
      expect(fixMalformedEncoding('\u00A0')).toBe(' ');
    });
    it('leaves clean text unchanged', () => {
      expect(fixMalformedEncoding('Bonjour le monde')).toBe('Bonjour le monde');
    });
  });

  describe('stripMimeHeaders', () => {
    it('returns empty for empty', () => expect(stripMimeHeaders('')).toBe(''));
    it('returns text without MIME headers unchanged', () => {
      expect(stripMimeHeaders('Hello world')).toBe('Hello world');
    });
    it('strips Content-Type headers', () => {
      const input = 'Content-Type: text/plain; charset=utf-8\n\nHello';
      const result = stripMimeHeaders(input);
      expect(result).not.toContain('Content-Type');
      expect(result).toContain('Hello');
    });
    it('strips MIME boundaries', () => {
      const input = '--boundary123\nContent-Type: text/plain\n\nBody\n--boundary123--';
      const result = stripMimeHeaders(input);
      expect(result).not.toContain('--boundary123');
      expect(result).toContain('Body');
    });
  });

  describe('decodeEmailContent', () => {
    it('returns empty for empty', () => expect(decodeEmailContent('')).toBe(''));
    it('normalizes line breaks', () => {
      expect(decodeEmailContent('a\r\nb')).toBe('a\nb');
    });
    it('removes zero-width spaces', () => {
      expect(decodeEmailContent('a\u200Bb')).toBe('ab');
    });
  });

  describe('sanitizeAllEmailFields', () => {
    it('handles null fields', () => {
      const result = sanitizeAllEmailFields({ subject: null, from_name: null, body_html: null, body_text: null });
      expect(result.subject).toBe('(Sans objet)');
      expect(result.from_name).toBeNull();
    });
    it('preserves clean fields', () => {
      const result = sanitizeAllEmailFields({
        subject: 'Hello',
        from_name: 'Jean',
        body_html: '<p>Content</p>',
        body_text: 'Content',
      });
      expect(result.subject).toBe('Hello');
    });
    it('detects encoding corrections', () => {
      const result = sanitizeAllEmailFields({
        subject: '=C3=A9',
        from_name: 'Test',
        body_html: null,
        body_text: null,
      });
      // subject was corrected
      expect(result.encodingWasCorrected).toBe(true);
    });
  });
});
