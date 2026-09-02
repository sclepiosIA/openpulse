import { describe, it, expect } from 'vitest';
import { buildQuotedBody } from '../emailQuotedBody';

describe('emailQuotedBody extended2', () => {
  const makeMsg = (overrides: Partial<{ from_name: string; from_address: string; body_text: string; sent_date: string }> = {}) => ({
    from_address: 'test@test.com',
    body_text: 'Hello',
    sent_date: '2026-03-09T10:00:00Z',
    ...overrides,
  });

  it('returns empty for empty array', () => expect(buildQuotedBody([])).toBe(''));
  it('returns empty for null-ish', () => expect(buildQuotedBody(null as any)).toBe(''));

  it('quotes single message', () => {
    const result = buildQuotedBody([makeMsg({ from_name: 'Jean', body_text: 'Bonjour' })]);
    expect(result).toContain('Jean a écrit');
    expect(result).toContain('> Bonjour');
  });

  it('uses email when no from_name', () => {
    const result = buildQuotedBody([makeMsg({ from_address: 'jean@test.com', body_text: 'Hi' })]);
    expect(result).toContain('jean@test.com a écrit');
  });

  it('nests multiple messages with increasing depth', () => {
    const msgs = [
      makeMsg({ from_name: 'Alice', body_text: 'First' }),
      makeMsg({ from_name: 'Bob', body_text: 'Second' }),
    ];
    const result = buildQuotedBody(msgs);
    expect(result).toContain('> First');
    expect(result).toContain('>> Second');
  });

  it('limits to maxMessages (default 5)', () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      makeMsg({ from_name: `User${i}`, body_text: `Message ${i}` })
    );
    const result = buildQuotedBody(msgs);
    expect(result).toContain('User0');
    expect(result).toContain('User4');
    expect(result).not.toContain('User5');
  });

  it('respects custom maxMessages', () => {
    const msgs = Array.from({ length: 5 }, (_, i) =>
      makeMsg({ from_name: `User${i}`, body_text: `Msg ${i}` })
    );
    const result = buildQuotedBody(msgs, 2);
    expect(result).toContain('User0');
    expect(result).toContain('User1');
    expect(result).not.toContain('User2');
  });

  it('handles multiline body', () => {
    const result = buildQuotedBody([makeMsg({ from_name: 'A', body_text: 'Line1\nLine2\nLine3' })]);
    expect(result).toContain('> Line1');
    expect(result).toContain('> Line2');
    expect(result).toContain('> Line3');
  });

  it('handles empty body_text', () => {
    const result = buildQuotedBody([makeMsg({ body_text: '' })]);
    expect(result).toContain('a écrit');
  });

  it('formats date in French', () => {
    const result = buildQuotedBody([makeMsg({ sent_date: '2026-01-15T14:30:00Z' })]);
    expect(result).toContain('janvier');
  });
});
