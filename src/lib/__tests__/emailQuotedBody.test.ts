import { describe, it, expect } from 'vitest';
import { buildQuotedBody } from '../emailQuotedBody';

describe('buildQuotedBody', () => {
  it('returns empty string for no messages', () => {
    expect(buildQuotedBody([])).toBe('');
    expect(buildQuotedBody(null as any)).toBe('');
  });

  it('quotes single message with sender name', () => {
    const out = buildQuotedBody([
      { from_name: 'Alice', from_address: 'a@x.fr', body_text: 'Hello\nWorld', sent_date: '2024-03-15T10:00:00Z' },
    ]);
    expect(out).toContain('Alice a écrit');
    expect(out).toContain('> Hello');
    expect(out).toContain('> World');
  });

  it('falls back to from_address when no name', () => {
    const out = buildQuotedBody([
      { from_address: 'a@x.fr', body_text: 'Hi', sent_date: '2024-03-15T10:00:00Z' },
    ]);
    expect(out).toContain('a@x.fr');
  });

  it('caps at maxMessages', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({
      from_address: `u${i}@x.fr`,
      body_text: `msg${i}`,
      sent_date: '2024-03-15T10:00:00Z',
    }));
    const out = buildQuotedBody(msgs, 3);
    expect(out).toContain('msg0');
    expect(out).toContain('msg2');
    expect(out).not.toContain('msg5');
  });

  it('handles invalid date gracefully', () => {
    const out = buildQuotedBody([
      { from_address: 'a@x.fr', body_text: 'Hi', sent_date: 'not-a-date' },
    ]);
    expect(out).toContain('a@x.fr');
  });
});
