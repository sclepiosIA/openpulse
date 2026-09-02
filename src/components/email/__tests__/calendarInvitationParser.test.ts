import { describe, it, expect } from 'vitest';
import {
  detectCalendarInvitation,
  hasVisioLink,
  convert12hTo24h,
  extractAttendees,
  extractLocation,
  cleanSubjectForDisplay,
} from '../calendarInvitationParser';

describe('detectCalendarInvitation', () => {
  it('detects Google Calendar invitations via subject', () => {
    expect(detectCalendarInvitation('Invitation: Réunion', '', '')).toBe(true);
  });
  it('detects via calendar.google.com link', () => {
    expect(detectCalendarInvitation('Hi', '<a href="https://calendar.google.com/x">x</a>', '')).toBe(true);
  });
  it('detects BEGIN:VCALENDAR', () => {
    expect(detectCalendarInvitation('Test', '', 'BEGIN:VCALENDAR\nEND:VCALENDAR')).toBe(true);
  });
  it('detects Nextcloud "vous a invité" pattern', () => {
    expect(detectCalendarInvitation('', '', 'Jean vous a invité à un événement')).toBe(true);
  });
  it('detects English "has invited you to"', () => {
    expect(detectCalendarInvitation('', '', 'John has invited you to a meeting')).toBe(true);
  });
  it('detects Outlook empty body with keyword subject', () => {
    expect(detectCalendarInvitation('Rencontre projet', '<p>&nbsp;</p>', '')).toBe(true);
  });
  it('returns false for regular email', () => {
    expect(detectCalendarInvitation('Devis', 'Bonjour, voici le devis', 'Cordialement')).toBe(false);
  });
});

describe('hasVisioLink', () => {
  it('detects Google Meet', () => {
    expect(hasVisioLink('Join: https://meet.google.com/abc-defg-hij', '')).toBe(true);
  });
  it('detects Microsoft Teams', () => {
    expect(hasVisioLink('', 'https://teams.microsoft.com/l/meetup-join/xyz')).toBe(true);
  });
  it('detects Zoom', () => {
    expect(hasVisioLink('https://example.zoom.us/j/123456', '')).toBe(true);
  });
  it('detects Jitsi', () => {
    expect(hasVisioLink('', 'https://meet.jit.si/MyRoom')).toBe(true);
  });
  it('detects Nextcloud /call/', () => {
    expect(hasVisioLink('https://cloud.example.com/call/abc123', '')).toBe(true);
  });
  it('returns false when no link', () => {
    expect(hasVisioLink('Just text', 'no links here')).toBe(false);
  });
});

describe('convert12hTo24h', () => {
  it('converts pm hours (except 12)', () => {
    expect(convert12hTo24h(1, 'pm')).toBe(13);
    expect(convert12hTo24h(11, 'PM')).toBe(23);
  });
  it('leaves 12pm as 12', () => {
    expect(convert12hTo24h(12, 'pm')).toBe(12);
  });
  it('converts 12am to 0', () => {
    expect(convert12hTo24h(12, 'am')).toBe(0);
  });
  it('leaves am hours unchanged', () => {
    expect(convert12hTo24h(8, 'am')).toBe(8);
  });
});

describe('extractAttendees', () => {
  it('returns [] for empty input', () => {
    expect(extractAttendees(null)).toEqual([]);
    expect(extractAttendees('')).toEqual([]);
    expect(extractAttendees('No emails here')).toEqual([]);
  });
  it('extracts unique emails', () => {
    const res = extractAttendees('alice@x.com bob@y.com alice@x.com');
    expect(res).toHaveLength(2);
    expect(res.map((r) => r.email)).toEqual(['alice@x.com', 'bob@y.com']);
  });
  it('filters out noreply / calendar-notification', () => {
    const res = extractAttendees('noreply@google.com user@org.fr calendar-notification@google.com');
    expect(res.map((r) => r.email)).toEqual(['user@org.fr']);
  });
  it('caps at 10 results', () => {
    const emails = Array.from({ length: 15 }, (_, i) => `u${i}@x.com`).join(' ');
    expect(extractAttendees(emails)).toHaveLength(10);
  });
});

describe('extractLocation', () => {
  it('extracts "Où : ..."', () => {
    expect(extractLocation('Où : Salle 101', '')).toBe('Salle 101');
  });
  it('extracts "Lieu : ..."', () => {
    expect(extractLocation('', 'Lieu : 10 rue Paris')).toBe('10 rue Paris');
  });
  it('returns null when not found', () => {
    expect(extractLocation('Texte sans location', '')).toBeNull();
  });
});

describe('cleanSubjectForDisplay', () => {
  it('returns default when empty', () => {
    expect(cleanSubjectForDisplay()).toBe('Événement calendrier');
    expect(cleanSubjectForDisplay('')).toBe('Événement calendrier');
  });
  it('strips [SPAM] and RE:/FW: prefixes', () => {
    expect(cleanSubjectForDisplay('[SPAM] RE: Réunion')).toBe('Réunion');
    expect(cleanSubjectForDisplay('FW: Hello')).toBe('Hello');
  });
  it('strips Invitation: prefix', () => {
    expect(cleanSubjectForDisplay('Invitation: Café équipe')).toBe('Café équipe');
  });
  it('truncates to max 60 chars', () => {
    const long = 'a'.repeat(120);
    expect(cleanSubjectForDisplay(long).length).toBeLessThanOrEqual(60);
  });
});
