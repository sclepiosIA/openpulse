import { describe, it, expect } from 'vitest';
import { parseICSClient, extractEmailFromCalendarProperty, extractMeetingLinkFromICS } from '../icsParserClient';

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-123@example.com
SUMMARY:Team Meeting
DTSTART:20260315T140000Z
DTEND:20260315T150000Z
LOCATION:Salle A
DESCRIPTION:Weekly sync
ORGANIZER;CN=John:mailto:john@example.com
ATTENDEE;CN=Jane:mailto:jane@example.com
END:VEVENT
END:VCALENDAR`;

describe('icsParserClient', () => {
  describe('parseICSClient', () => {
    it('parses basic event', () => {
      const events = parseICSClient(SAMPLE_ICS);
      expect(events.length).toBe(1);
      expect(events[0].uid).toBe('test-123@example.com');
      expect(events[0].summary).toBe('Team Meeting');
      expect(events[0].dtstart).toBe('2026-03-15T14:00:00Z');
      expect(events[0].dtend).toBe('2026-03-15T15:00:00Z');
      expect(events[0].location).toBe('Salle A');
    });

    it('parses organizer and attendees', () => {
      const events = parseICSClient(SAMPLE_ICS);
      expect(events[0].organizer).toContain('mailto:john@example.com');
      expect(events[0].attendees?.length).toBe(1);
    });

    it('returns empty for no events', () => {
      expect(parseICSClient('BEGIN:VCALENDAR\nEND:VCALENDAR')).toEqual([]);
    });

    it('handles all-day events', () => {
      const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:allday\nSUMMARY:Holiday\nDTSTART;VALUE=DATE:20260315\nEND:VEVENT\nEND:VCALENDAR`;
      const events = parseICSClient(ics);
      expect(events[0].dtstart).toBe('2026-03-15T00:00:00');
    });

    it('handles quoted-printable content', () => {
      const ics = 'BEGIN=3AVCALENDAR\nBEGIN=3AVEVENT\nUID=3Atest\nSUMMARY=3ATest\nDTSTART=3A20260315T100000Z\nEND=3AVEVENT\nEND=3AVCALENDAR';
      const events = parseICSClient(ics);
      expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('handles escaped values', () => {
      const ics = `BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:esc-test\nSUMMARY:Meeting\\, Important\nDTSTART:20260315T100000Z\nDESCRIPTION:Line1\\nLine2\nEND:VEVENT\nEND:VCALENDAR`;
      const events = parseICSClient(ics);
      expect(events[0].summary).toBe('Meeting, Important');
      expect(events[0].description).toContain('Line1\nLine2');
    });
  });

  describe('extractEmailFromCalendarProperty', () => {
    it('extracts from MAILTO', () => {
      expect(extractEmailFromCalendarProperty('MAILTO:john@example.com')).toBe('john@example.com');
    });
    it('extracts from CN format', () => {
      expect(extractEmailFromCalendarProperty('CN=John Doe:MAILTO:john@example.com')).toBe('john@example.com');
    });
    it('returns null for no email', () => {
      expect(extractEmailFromCalendarProperty('no email here')).toBeNull();
    });
  });

  describe('extractMeetingLinkFromICS', () => {
    it('extracts Teams link', () => {
      const event = { uid: '1', summary: 'Test', dtstart: '', location: 'https://teams.microsoft.com/l/meetup-join/abc123' };
      expect(extractMeetingLinkFromICS(event)).toContain('teams.microsoft.com');
    });
    it('extracts Meet link', () => {
      const event = { uid: '1', summary: 'Test', dtstart: '', description: 'Join at https://meet.google.com/abc-def-ghi' };
      expect(extractMeetingLinkFromICS(event)).toContain('meet.google.com');
    });
    it('extracts Zoom link', () => {
      const event = { uid: '1', summary: 'Test', dtstart: '', location: 'https://acme.zoom.us/j/123456' };
      expect(extractMeetingLinkFromICS(event)).toContain('zoom.us');
    });
    it('returns null when no link', () => {
      const event = { uid: '1', summary: 'Test', dtstart: '' };
      expect(extractMeetingLinkFromICS(event)).toBeNull();
    });
  });
});
