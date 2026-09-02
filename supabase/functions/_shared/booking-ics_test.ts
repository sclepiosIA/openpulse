import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateBookingICS } from "./booking-ics.ts";

const baseBooking = {
  id: "abc-123",
  start_time: "2026-07-15T10:00:00.000Z",
  end_time: "2026-07-15T10:30:00.000Z",
  guest_name: "Jean Dupont",
  guest_email: "jean@example.com",
  location: null,
  video_conference_url: "https://meet.example.com/xyz",
  description: "Démo produit",
};
const host = { name: "Alice", email: "alice@exploitant.example.org" };

Deno.test("generateBookingICS - REQUEST produces valid VCALENDAR", () => {
  const ics = generateBookingICS(baseBooking, host, {
    method: "REQUEST",
    summary: "Démo OpenPulse",
  });
  assert(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert(ics.endsWith("END:VCALENDAR"));
  assert(ics.includes("METHOD:REQUEST"));
  assert(ics.includes("UID:booking-abc-123@exploitant.example.org"));
  assert(ics.includes("DTSTART:20260715T100000Z"));
  assert(ics.includes("DTEND:20260715T103000Z"));
  assert(ics.includes("SEQUENCE:0"));
  assert(ics.includes("STATUS:CONFIRMED"));
  assert(ics.includes("SUMMARY:Démo OpenPulse"));
  assert(ics.includes("mailto:alice@exploitant.example.org"));
  assert(ics.includes("mailto:jean@example.com"));
  assert(ics.includes("https://meet.example.com/xyz"));
});

Deno.test("generateBookingICS - CANCEL flips status and method", () => {
  const ics = generateBookingICS(baseBooking, host, {
    method: "CANCEL",
    summary: "Annulation",
    sequence: 2,
  });
  assert(ics.includes("METHOD:CANCEL"));
  assert(ics.includes("STATUS:CANCELLED"));
  assert(ics.includes("SEQUENCE:2"));
});

Deno.test("generateBookingICS - escapes commas/semicolons/backslashes in text", () => {
  const ics = generateBookingICS(
    { ...baseBooking, description: "Item A, Item B; with \\ backslash" },
    host,
    { method: "REQUEST", summary: "x" }
  );
  assert(ics.includes("Item A\\, Item B\\; with \\\\ backslash"));
});

Deno.test("generateBookingICS - location falls back to visio then placeholder", () => {
  const noVisio = generateBookingICS(
    { ...baseBooking, video_conference_url: null, location: null },
    host,
    { method: "REQUEST", summary: "x" }
  );
  assert(noVisio.includes("LOCATION:À confirmer"));

  const withVisio = generateBookingICS(baseBooking, host, {
    method: "REQUEST",
    summary: "x",
  });
  assert(withVisio.includes("LOCATION:https://meet.example.com/xyz"));
});

Deno.test("generateBookingICS - CRLF line endings (RFC 5545)", () => {
  const ics = generateBookingICS(baseBooking, host, {
    method: "REQUEST",
    summary: "x",
  });
  // Must use CRLF, not bare LF
  const lfOnly = ics.split("\r\n").join("");
  assert(!lfOnly.includes("\n"), "ICS must not contain bare LF outside CRLF pairs");
});
