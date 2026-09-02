/**
 * ICS (iCalendar) generator for bookings.
 * Supports REQUEST (create/update) and CANCEL methods, with SEQUENCE for reschedules.
 */

export interface IcsBooking {
  id: string;
  start_time: string; // ISO
  end_time: string; // ISO
  guest_name: string;
  guest_email: string;
  location?: string | null;
  video_conference_url?: string | null;
  description?: string | null;
}

export interface IcsHost {
  name: string;
  email: string;
}

export interface IcsOptions {
  method: "REQUEST" | "CANCEL";
  sequence?: number; // increment on reschedule
  summary: string;
  status?: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
}

const formatICSDate = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

const escapeText = (s: string): string =>
  (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

export function generateBookingICS(
  booking: IcsBooking,
  host: IcsHost,
  options: IcsOptions
): string {
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const now = new Date();
  const uid = `booking-${booking.id}@exploitant.example.org`;

  const descriptionParts: string[] = [];
  if (booking.description) descriptionParts.push(booking.description);
  if (booking.video_conference_url)
    descriptionParts.push(`Lien visio : ${booking.video_conference_url}`);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marque IA//Booking//FR",
    "CALSCALE:GREGORIAN",
    `METHOD:${options.method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SEQUENCE:${options.sequence ?? 0}`,
    `SUMMARY:${escapeText(options.summary)}`,
    `DESCRIPTION:${escapeText(descriptionParts.join("\n"))}`,
    `LOCATION:${escapeText(
      booking.location || booking.video_conference_url || "À confirmer"
    )}`,
    `ORGANIZER;CN=${escapeText(host.name)}:mailto:${host.email}`,
    `ATTENDEE;RSVP=TRUE;PARTSTAT=ACCEPTED;CN=${escapeText(
      booking.guest_name
    )}:mailto:${booking.guest_email}`,
    `STATUS:${options.status ?? (options.method === "CANCEL" ? "CANCELLED" : "CONFIRMED")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}
