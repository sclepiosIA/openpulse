import { describe, it, expect } from 'vitest';
import { getThreadMainSender, getAllThreadParticipants } from '../emailParticipants';

const ME = 'me@x.fr';

describe('getThreadMainSender', () => {
  it('returns null for empty thread', () => {
    expect(getThreadMainSender({}, ME)).toBeNull();
    expect(getThreadMainSender(null, ME)).toBeNull();
  });

  it('uses last message sender (external)', () => {
    const t = {
      messages: [
        { from_address: 'a@x.fr', from_name: 'Alice', sent_date: '2024-01-01' },
        { from_address: 'b@x.fr', from_name: 'Bob', sent_date: '2024-01-02' },
      ],
    };
    const out = getThreadMainSender(t, ME);
    expect(out?.email).toBe('b@x.fr');
    expect(out?.isCurrentUser).toBe(false);
  });

  it('when last message is from user, picks recipient', () => {
    const t = {
      messages: [
        { from_address: ME, sent_date: '2024-01-02', to_addresses: [{ email: 'x@y.fr', name: 'X' }] },
      ],
    };
    const out = getThreadMainSender(t, ME);
    expect(out?.email).toBe('x@y.fr');
    expect(out?.isCurrentUser).toBe(true);
  });

  it('falls back to denormalized last_message_from_email', () => {
    const out = getThreadMainSender({ last_message_from_email: 'c@x.fr', last_message_from_name: 'Carol' }, ME);
    expect(out?.email).toBe('c@x.fr');
    expect(out?.name).toBe('Carol');
  });

  it('falls back to participants when no messages', () => {
    const out = getThreadMainSender({ participants: [{ email: ME }, { email: 'd@x.fr', name: 'Dan' }] }, ME);
    expect(out?.email).toBe('d@x.fr');
  });
});

describe('getAllThreadParticipants', () => {
  it('aggregates to/cc and excludes self', () => {
    const t = {
      messages: [
        {
          from_address: 'a@x.fr', from_name: 'Alice',
          to_addresses: [ME, { email: 'b@x.fr', name: 'Bob' }],
          cc_addresses: ['c@x.fr'],
        },
      ],
    };
    const out = getAllThreadParticipants(t, ME);
    expect(out.to).toContain('a@x.fr');
    expect(out.to).toContain('b@x.fr');
    expect(out.to).not.toContain(ME);
    expect(out.cc).toEqual(['c@x.fr']);
    expect(out.all.find(p => p.email === 'a@x.fr')?.name).toBe('Alice');
  });

  it('empty thread returns empty arrays', () => {
    const out = getAllThreadParticipants({}, ME);
    expect(out.to).toEqual([]);
    expect(out.cc).toEqual([]);
    expect(out.all).toEqual([]);
  });
});
