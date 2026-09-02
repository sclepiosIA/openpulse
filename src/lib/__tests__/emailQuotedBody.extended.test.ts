import { describe, it, expect } from 'vitest';
import { buildQuotedBody } from '../emailQuotedBody';

describe('buildQuotedBody', () => {
  it('returns empty string for empty messages', () => {
    expect(buildQuotedBody([])).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(buildQuotedBody(null as any)).toBe('');
    expect(buildQuotedBody(undefined as any)).toBe('');
  });

  it('quotes a single message', () => {
    const result = buildQuotedBody([
      { from_name: 'Jean', from_address: 'jean@test.com', body_text: 'Bonjour', sent_date: '2026-03-09T10:00:00Z' },
    ]);
    expect(result).toContain('Jean a écrit');
    expect(result).toContain('> Bonjour');
  });

  it('uses from_address when from_name is missing', () => {
    const result = buildQuotedBody([
      { from_address: 'anon@test.com', body_text: 'Test', sent_date: '2026-03-09T10:00:00Z' },
    ]);
    expect(result).toContain('anon@test.com a écrit');
  });

  it('nests quotes for multiple messages', () => {
    const messages = [
      { from_name: 'Alice', from_address: 'a@t.com', body_text: 'Re', sent_date: '2026-03-09T12:00:00Z' },
      { from_name: 'Bob', from_address: 'b@t.com', body_text: 'Original', sent_date: '2026-03-09T10:00:00Z' },
    ];
    const result = buildQuotedBody(messages);
    expect(result).toContain('> Re');
    expect(result).toContain('>> Original');
  });

  it('respects maxMessages limit', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      from_name: `User${i}`,
      from_address: `u${i}@t.com`,
      body_text: `Message ${i}`,
      sent_date: `2026-03-0${Math.min(i + 1, 9)}T10:00:00Z`,
    }));
    const result = buildQuotedBody(messages, 3);
    // Should only include 3 messages
    expect(result).toContain('User0');
    expect(result).toContain('User2');
    expect(result).not.toContain('User3');
  });

  it('handles multiline body_text', () => {
    const result = buildQuotedBody([
      { from_name: 'X', from_address: 'x@t.com', body_text: 'Line1\nLine2\nLine3', sent_date: '2026-03-09T10:00:00Z' },
    ]);
    expect(result).toContain('> Line1');
    expect(result).toContain('> Line2');
    expect(result).toContain('> Line3');
  });

  it('handles empty body_text', () => {
    const result = buildQuotedBody([
      { from_name: 'X', from_address: 'x@t.com', body_text: '', sent_date: '2026-03-09T10:00:00Z' },
    ]);
    expect(result).toContain('X a écrit');
  });
});
