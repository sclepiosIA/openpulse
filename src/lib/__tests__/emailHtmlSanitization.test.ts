import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml, decodeHtmlEntities } from '../emailHtmlSanitization';

describe('sanitizeEmailHtml', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeEmailHtml('')).toBe('');
  });

  it('strips <script> tags', () => {
    const out = sanitizeEmailHtml('<p>Hi</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('Hi');
  });

  it('removes inline event handlers', () => {
    const out = sanitizeEmailHtml('<p onclick="alert(1)">x</p>');
    expect(out).not.toMatch(/onclick/i);
  });

  it('adds target+rel to external links', () => {
    const out = sanitizeEmailHtml('<a href="https://example.com">go</a>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('preserves safe formatting tags', () => {
    const out = sanitizeEmailHtml('<p><strong>x</strong> <em>y</em></p>');
    expect(out).toContain('<strong>');
    expect(out).toContain('<em>');
  });

  it('rewrites cid: images to placeholder data-cid', () => {
    const out = sanitizeEmailHtml('<img src="cid:abc123">');
    expect(out).toContain('data-cid="abc123"');
    expect(out).toContain('cid-image');
  });

  it('adds loading=lazy on http images', () => {
    const out = sanitizeEmailHtml('<img src="https://example.com/x.png">');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('referrerpolicy="no-referrer"');
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes basic entities', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&');
    expect(decodeHtmlEntities('&lt;b&gt;')).toBe('<b>');
  });

  it('handles double-encoded', () => {
    expect(decodeHtmlEntities('&amp;amp;')).toBe('&');
  });
});
