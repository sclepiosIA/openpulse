import { describe, it, expect } from 'vitest';
import { processIcsUids } from '../icsLinkPostProcessor';

describe('icsLinkPostProcessor', () => {
  describe('processIcsUids', () => {
    it('returns input unchanged when html is empty', () => {
      expect(processIcsUids('')).toBe('');
    });

    it('returns input unchanged when no ICS UID pattern present', () => {
      const html = '<p>Bonjour, ceci est un test sans UID.</p>';
      expect(processIcsUids(html)).toBe(html);
    });

    it('replaces a single [ICS UID: xxx] bracket pattern with a styled span', () => {
      const html = 'Voir événement [ICS UID: abc123@example.com] ci-dessous';
      const result = processIcsUids(html);
      expect(result).toContain('<span class="ics-uid"');
      expect(result).toContain('title="ICS: abc123@example.com"');
      expect(result).toContain('abc123@example.com');
      expect(result).not.toContain('[ICS UID:');
    });

    it('handles case-insensitive ICS UID prefix', () => {
      const html = '[ics uid: foo-bar-uid@cal.local]';
      const result = processIcsUids(html);
      expect(result).toContain('<span class="ics-uid"');
      expect(result).toContain('foo-bar-uid@cal.local');
    });

    it('truncates very long UIDs in the visible label', () => {
      const longUid = 'very-long-uid-' + 'x'.repeat(40) + '@example.com';
      const html = `[ICS UID: ${longUid}]`;
      const result = processIcsUids(html);
      // Visible label should be truncated (contains ellipsis), title keeps full UID
      expect(result).toContain('…');
      expect(result).toContain(`title="ICS: ${longUid}"`);
    });

    it('replaces multiple bracket patterns in one pass', () => {
      const html = '[ICS UID: a@x.com] et [ICS UID: b@y.com]';
      const result = processIcsUids(html);
      expect(result.match(/<span class="ics-uid"/g)?.length).toBe(2);
    });

    it('preserves surrounding HTML', () => {
      const html = '<div><p>Avant [ICS UID: foo@bar.com] après</p></div>';
      const result = processIcsUids(html);
      expect(result.startsWith('<div><p>Avant ')).toBe(true);
      expect(result.endsWith(' après</p></div>')).toBe(true);
    });

    it('trims whitespace inside the UID brackets', () => {
      const html = '[ICS UID:   spaced-uid@host.com  ]';
      const result = processIcsUids(html);
      expect(result).toContain('title="ICS: spaced-uid@host.com"');
    });
  });
});
