import { describe, it, expect } from 'vitest';
import { parseICSClient, extractEmailFromCalendarProperty, extractMeetingLinkFromICS } from '../icsParserClient';

describe('icsParserClient', () => {
  describe('parseICSClient', () => {
    it('parses a simple VEVENT', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:test-uid-123
SUMMARY:Réunion d'équipe
DTSTART:20250315T140000Z
DTEND:20250315T150000Z
LOCATION:Salle A
DESCRIPTION:Discussion projet
END:VEVENT
END:VCALENDAR`;
      const events = parseICSClient(ics);
      expect(events).toHaveLength(1);
      expect(events[0].uid).toBe('test-uid-123');
      expect(events[0].summary).toBe("Réunion d'équipe");
      expect(events[0].dtstart).toBe('2025-03-15T14:00:00Z');
      expect(events[0].dtend).toBe('2025-03-15T15:00:00Z');
      expect(events[0].location).toBe('Salle A');
    });

    it('parses all-day event', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:allday-1
SUMMARY:Journée formation
DTSTART;VALUE=DATE:20250320
END:VEVENT
END:VCALENDAR`;
      const events = parseICSClient(ics);
      expect(events).toHaveLength(1);
      expect(events[0].dtstart).toBe('2025-03-20T00:00:00');
    });

    it('parses TZID dates', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tz-1
SUMMARY:Test TZ
DTSTART;TZID=Europe/Paris:20250120T153000
END:VEVENT
END:VCALENDAR`;
      const events = parseICSClient(ics);
      expect(events[0].dtstart).toBe('2025-01-20T15:30:00');
    });

    it('parses multiple events', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:e1
SUMMARY:Event 1
DTSTART:20250101T100000Z
END:VEVENT
BEGIN:VEVENT
UID:e2
SUMMARY:Event 2
DTSTART:20250102T100000Z
END:VEVENT
END:VCALENDAR`;
      expect(parseICSClient(ics)).toHaveLength(2);
    });

    it('skips events without required fields', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:incomplete
END:VEVENT
END:VCALENDAR`;
      expect(parseICSClient(ics)).toHaveLength(0);
    });

    it('parses attendees', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:att-1
SUMMARY:Meeting
DTSTART:20250315T100000Z
ATTENDEE;CN=Alice:MAILTO:alice@test.com
ATTENDEE;CN=Bob:MAILTO:bob@test.com
END:VEVENT
END:VCALENDAR`;
      const events = parseICSClient(ics);
      expect(events[0].attendees).toHaveLength(2);
    });

    it('handles quoted-printable encoded content', () => {
      const ics = 'BEGIN=3AVCALENDAR\r\nBEGIN=3AVEVENT\r\nUID=3Aqp-1\r\nSUMMARY=3ATest\r\nDTSTART=3A20250315T100000Z\r\nEND=3AVEVENT\r\nEND=3AVCALENDAR';
      const events = parseICSClient(ics);
      expect(events).toHaveLength(1);
    });

    it('decodes escaped values', () => {
      const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:esc-1
SUMMARY:Test\\, with comma
DTSTART:20250315T100000Z
DESCRIPTION:Line 1\\nLine 2
END:VEVENT
END:VCALENDAR`;
      const events = parseICSClient(ics);
      expect(events[0].summary).toBe('Test, with comma');
      expect(events[0].description).toContain('Line 1\nLine 2');
    });
  });

  describe('extractEmailFromCalendarProperty', () => {
    it('extracts mailto email', () => {
      expect(extractEmailFromCalendarProperty('MAILTO:alice@test.com')).toBe('alice@test.com');
    });
    it('extracts from CN format', () => {
      expect(extractEmailFromCalendarProperty('CN=Alice Dupont:MAILTO:alice@test.com')).toBe('alice@test.com');
    });
    it('returns null for no mailto', () => {
      expect(extractEmailFromCalendarProperty('just a string')).toBeNull();
    });
  });

  describe('extractMeetingLinkFromICS', () => {
    it('extracts Teams link', () => {
      const event = { uid: '1', summary: 'Meet', dtstart: '2025-01-01', location: 'https://teams.microsoft.com/l/meetup-join/abc' };
      expect(extractMeetingLinkFromICS(event)).toContain('teams.microsoft.com');
    });
    it('extracts Google Meet link', () => {
      const event = { uid: '1', summary: 'Meet', dtstart: '2025-01-01', description: 'Join: https://meet.google.com/abc-def-ghi' };
      expect(extractMeetingLinkFromICS(event)).toContain('meet.google.com');
    });
    it('extracts Zoom link from description', () => {
      const event = { uid: '1', summary: 'Meet', dtstart: '2025-01-01', description: 'Join at https://zoom.zoom.us/j/123456' };
      const result = extractMeetingLinkFromICS(event);
      expect(result).not.toBeNull();
      expect(result!).toContain('zoom.us');
    });
    it('returns null when no meeting link', () => {
      const event = { uid: '1', summary: 'Meet', dtstart: '2025-01-01' };
      expect(extractMeetingLinkFromICS(event)).toBeNull();
    });
  });
});
