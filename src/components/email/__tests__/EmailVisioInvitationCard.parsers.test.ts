import { describe, it, expect } from 'vitest';
import {
  detectVisioLink,
  convert12hTo24h,
  extractAttendees,
  cleanSubjectForDisplay,
} from '../EmailVisioInvitationCard.parsers';

describe('detectVisioLink', () => {
  it('detects Google Meet', () => {
    const r = detectVisioLink('Lien: https://meet.google.com/abc-defg-hij', '');
    expect(r?.provider).toBe('google_meet');
    expect(r?.providerName).toBe('Google Meet');
    expect(r?.link).toContain('meet.google.com');
    expect(r?.color).toMatch(/^bg-/);
  });

  it('detects Microsoft Teams', () => {
    const r = detectVisioLink('', 'https://teams.microsoft.com/l/meetup-join/xyz');
    expect(r?.provider).toBe('teams');
  });

  it('detects Zoom', () => {
    const r = detectVisioLink('https://example.zoom.us/j/12345', '');
    expect(r?.provider).toBe('zoom');
  });

  it('detects Webex', () => {
    const r = detectVisioLink('https://example.webex.com/meet/foo', '');
    expect(r?.provider).toBe('webex');
  });

  it('detects Nextcloud standard /call/', () => {
    const r = detectVisioLink('', 'https://cloud.example.com/call/abc123');
    expect(r?.provider).toBe('nextcloud');
    expect(r?.providerName).toBe('Nextcloud Talk');
  });

  it('detects Nextcloud /apps/spreed/call/', () => {
    const r = detectVisioLink('https://cloud.example.com/apps/spreed/call/xyz', '');
    expect(r?.provider).toBe('nextcloud');
  });

  it('detects Jitsi', () => {
    const r = detectVisioLink('', 'https://meet.jit.si/MyRoom');
    expect(r?.provider).toBe('jitsi');
  });

  it('detects self-hosted Jitsi (jitsi.exploitant.example.org)', () => {
    const r = detectVisioLink('https://jitsi.exploitant.example.org/room', '');
    expect(r?.provider).toBe('jitsi');
  });

  it('returns null when no link present', () => {
    expect(detectVisioLink('No link', 'nothing here')).toBeNull();
  });

  it('returns null for null/undefined inputs', () => {
    expect(detectVisioLink(null, undefined)).toBeNull();
  });
});

describe('convert12hTo24h', () => {
  it('handles am/pm/edge cases', () => {
    expect(convert12hTo24h(3, 'pm')).toBe(15);
    expect(convert12hTo24h(12, 'pm')).toBe(12);
    expect(convert12hTo24h(12, 'am')).toBe(0);
    expect(convert12hTo24h(7, 'am')).toBe(7);
  });
});

describe('extractAttendees (visio)', () => {
  it('returns [] for empty/non-matching', () => {
    expect(extractAttendees(undefined)).toEqual([]);
    expect(extractAttendees('nothing')).toEqual([]);
  });
  it('extracts unique non-noreply emails', () => {
    const list = extractAttendees('alice@x.com noreply@y.com alice@x.com bob@z.fr');
    expect(list.map((e) => e.email)).toEqual(['alice@x.com', 'bob@z.fr']);
  });
  it('caps results to 10', () => {
    const big = Array.from({ length: 20 }, (_, i) => `u${i}@x.com`).join(' ');
    expect(extractAttendees(big)).toHaveLength(10);
  });
});

describe('cleanSubjectForDisplay (visio)', () => {
  it('returns default for empty/missing', () => {
    expect(cleanSubjectForDisplay()).toBe('Réunion visioconférence');
    expect(cleanSubjectForDisplay('')).toBe('Réunion visioconférence');
  });
  it('strips [SPAM], RE:, FW:, Invitation: prefixes', () => {
    expect(cleanSubjectForDisplay('[SPAM] RE: Daily')).toBe('Daily');
    expect(cleanSubjectForDisplay('FW: Sync')).toBe('Sync');
    expect(cleanSubjectForDisplay('Invitation: Demo')).toBe('Demo');
  });
  it('strips parenthesised emails', () => {
    expect(cleanSubjectForDisplay('Meeting (john@x.com)')).toBe('Meeting');
  });
  it('strips (UTC+1) timezone tag', () => {
    expect(cleanSubjectForDisplay('Sync (UTC+1)')).toBe('Sync');
  });
  it('truncates to 60 chars max', () => {
    expect(cleanSubjectForDisplay('x'.repeat(150)).length).toBeLessThanOrEqual(60);
  });
});
