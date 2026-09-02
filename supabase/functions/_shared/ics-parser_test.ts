import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseICS, extractEmailFromCalendarProperty } from "./ics-parser.ts";

const sampleICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//FR
METHOD:REQUEST
BEGIN:VEVENT
UID:evt-1@example.com
SUMMARY:Réunion équipe
DTSTART:20260715T100000Z
DTEND:20260715T110000Z
LOCATION:Paris\\, France
DESCRIPTION:Sujet\\nLigne 2
ORGANIZER;CN=Alice:MAILTO:alice@example.com
ATTENDEE;CN=Bob:MAILTO:bob@example.com
ATTENDEE;CN=Carol:MAILTO:carol@example.com
END:VEVENT
END:VCALENDAR`;

Deno.test("parseICS - parses a single VEVENT", () => {
  const events = parseICS(sampleICS);
  assertEquals(events.length, 1);
  const e = events[0];
  assertEquals(e.uid, "evt-1@example.com");
  assertEquals(e.summary, "Réunion équipe");
  assertEquals(e.dtstart, "2026-07-15T10:00:00Z");
  assertEquals(e.dtend, "2026-07-15T11:00:00Z");
  assertEquals(e.location, "Paris, France");
  assertEquals(e.description, "Sujet\nLigne 2");
  assertEquals(e.attendees?.length, 2);
});

Deno.test("parseICS - all-day date format", () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:x
SUMMARY:All day
DTSTART;VALUE=DATE:20260715
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics);
  assertEquals(events.length, 1);
  assertEquals(events[0].dtstart, "2026-07-15T00:00:00");
});

Deno.test("parseICS - TZID date format", () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:x
SUMMARY:TZ
DTSTART;TZID=Europe/Paris:20260715T140000
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics);
  assertEquals(events[0].dtstart, "2026-07-15T14:00:00");
});

Deno.test("parseICS - skips incomplete events", () => {
  const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:incomplete
END:VEVENT
END:VCALENDAR`;
  assertEquals(parseICS(ics).length, 0);
});

Deno.test("parseICS - handles quoted-printable encoded ICS", () => {
  const qp = `Content-Transfer-Encoding: quoted-printable

BEGIN=3AVCALENDAR=0D=0ABEGIN=3AVEVENT=0D=0AUID=3Aqp-1=0D=0ASUMMARY=3AQP =\nEvent=0D=0ADTSTART=3A20260715T100000Z=0D=0AEND=3AVEVENT=0D=0AEND=3AVCALENDAR`;
  const events = parseICS(qp);
  assert(events.length >= 1);
  assertEquals(events[0].uid, "qp-1");
});

Deno.test("extractEmailFromCalendarProperty - returns email or null", () => {
  assertEquals(
    extractEmailFromCalendarProperty("CN=Alice:MAILTO:alice@example.com"),
    "alice@example.com"
  );
  assertEquals(
    extractEmailFromCalendarProperty("mailto:bob@example.com"),
    "bob@example.com"
  );
  assertEquals(extractEmailFromCalendarProperty("CN=NoEmail"), null);
});
