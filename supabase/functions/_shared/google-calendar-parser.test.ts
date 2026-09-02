import { assertEquals, assertExists, assertThrows, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGoogleCalendarEmail, parseTeamsInvitation } from "./google-calendar-parser.ts";

Deno.test("parseGoogleCalendarEmail parses a French Google Calendar invitation with Meet link", () => {
  const body = [
    "Quand : jeudi 29 janv. 2026 • 14:30 – 14:45",
    "Où : Salle Demo",
    "Organisateur : Alice Dupont <alice@example.com>",
    "Participants : bob@example.com, alice@example.com, noreply@google.com",
    "Rejoindre avec Google Meet : https://meet.google.com/abc-defg-hij",
  ].join("\n");

  const event = parseGoogleCalendarEmail(
    "Invitation : Démo Produit @ jeudi 29 janv. 2026",
    body,
    "calendar-notification@google.com",
  );

  assertExists(event);
  assertExists(event.uid);
  assertEquals(event.summary, "Démo Produit");
  assertEquals(event.dtstart, "2026-01-29T14:30:00");
  assertEquals(event.dtend, "2026-01-29T14:45:00");
  assertEquals(event.organizer, "alice@example.com");
  assertEquals(event.meetingLink, "https://meet.google.com/abc-defg-hij");
  assertEquals(event.attendees?.includes("alice@example.com"), true);
  assertEquals(event.attendees?.includes("bob@example.com"), true);
  assertEquals(event.attendees?.includes("noreply@google.com"), false);
});

Deno.test("parseGoogleCalendarEmail parses malformed UTF-8 date separators and explicit location", () => {
  const body = [
    "Quand : jeudi 29 janv. 2026 â 09:05 â 10:10",
    "Where: Bureau Paris",
    "Organizer: Jean Martin <jean@example.fr>",
  ].join("\n");

  const event = parseGoogleCalendarEmail(
    "Invitation : Café stratégie",
    body,
    "fallback@example.fr",
  );

  assertExists(event);
  assertEquals(event.summary, "Café stratégie");
  assertEquals(event.dtstart, "2026-01-29T09:05:00");
  assertEquals(event.dtend, "2026-01-29T10:10:00");
  assertEquals(event.location, "Bureau Paris");
  assertEquals(event.organizer, "jean@example.fr");
});

Deno.test("parseGoogleCalendarEmail parses Cal.com AM/PM format and converts to 24h", () => {
  const body = [
    "mardi, 20 janvier 2026 3:30pm - 4:00pm",
    "Location: https://conference.example.com/meeting/demo",
    "Organizer: Host Person <host@example.com>",
  ].join("\n");

  const event = parseGoogleCalendarEmail(
    "Invitation: Discovery Call",
    body,
    "host@example.com",
  );

  assertExists(event);
  assertEquals(event.summary, "Discovery Call");
  assertEquals(event.dtstart, "2026-01-20T15:30:00");
  assertEquals(event.dtend, "2026-01-20T16:00:00");
  assertEquals(event.meetingLink, "https://conference.example.com/meeting/demo");
  assertEquals(event.organizer, "host@example.com");
});

Deno.test("parseGoogleCalendarEmail parses US AM/PM format without end time", () => {
  const body = [
    "January 20, 2026 11am",
    "What: Investor update",
    "From: Founder Name <founder@example.com>",
  ].join("\n");

  const event = parseGoogleCalendarEmail(
    "Event: Investor update",
    body,
    "calendar@example.com",
  );

  assertExists(event);
  assertEquals(event.summary, "Investor update");
  assertEquals(event.dtstart, "2026-01-20T11:00:00");
  assertEquals(event.dtend, undefined);
  assertEquals(event.organizer, "founder@example.com");
});

Deno.test("parseGoogleCalendarEmail parses Nextcloud between format", () => {
  const body = [
    "In 3 days on mardi 20 janvier 2026 between 10:00 - 10:30",
    "Location: Remote",
    "Organized by: Ops Team <ops@example.com>",
  ].join("\n");

  const event = parseGoogleCalendarEmail(
    "Invitation: Daily Ops",
    body,
    "ops-fallback@example.com",
  );

  assertExists(event);
  assertEquals(event.summary, "Daily Ops");
  assertEquals(event.dtstart, "2026-01-20T10:00:00");
  assertEquals(event.dtend, "2026-01-20T10:30:00");
  assertEquals(event.location, "Remote");
  assertEquals(event.organizer, "ops@example.com");
});

Deno.test("parseGoogleCalendarEmail parses French from-to format", () => {
  const body = [
    "26 janvier 2026 de 14:00 à 15:00",
    "Lieu : Atelier",
    "Organisateur : Atelier Team <atelier@example.com>",
  ].join("\n");

  const event = parseGoogleCalendarEmail(
    "Invitation : Atelier onboarding",
    body,
    "fallback@example.com",
  );

  assertExists(event);
  assertEquals(event.summary, "Atelier onboarding");
  assertEquals(event.dtstart, "2026-01-26T14:00:00");
  assertEquals(event.dtend, "2026-01-26T15:00:00");
  assertEquals(event.location, "Atelier");
  assertEquals(event.organizer, "atelier@example.com");
});

Deno.test("parseGoogleCalendarEmail falls back to sender when organizer is absent", () => {
  const body = [
    "Quand : lundi 3 fev. 2025 • 10:00 – 11:00",
    "Où : Salle 2",
    "Participants : participant@example.com",
  ].join("\n");

  const event = parseGoogleCalendarEmail(
    "Invitation : Comité mensuel",
    body,
    "sender@example.com",
  );

  assertExists(event);
  assertEquals(event.summary, "Comité mensuel");
  assertEquals(event.dtstart, "2025-02-03T10:00:00");
  assertEquals(event.dtend, "2025-02-03T11:00:00");
  assertEquals(event.location, "Salle 2");
  assertEquals(event.organizer, "sender@example.com");
  assertEquals(event.attendees?.includes("participant@example.com"), true);
});

Deno.test("parseGoogleCalendarEmail returns null for unrelated email without date information", () => {
  const event = parseGoogleCalendarEmail(
    "Bonjour",
    "Ceci est un message simple sans invitation ni horaire.",
    "sender@example.com",
  );

  assertEquals(event, null);
});

Deno.test("parseGoogleCalendarEmail returns null when invitation date cannot be parsed", () => {
  const event = parseGoogleCalendarEmail(
    "Invitation : Rendez-vous incomplet",
    "Quand : bientôt\nOù : En ligne",
    "sender@example.com",
  );

  assertEquals(event, null);
});

Deno.test("parseTeamsInvitation parses French Teams invitation details", () => {
  const body = [
    "Rejoindre la réunion Microsoft Teams",
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzYx@thread.v2/0?context=%7b%7d",
    "Numéro de réunion : 123 456 789",
    "Code secret : AbC123",
  ].join("\n");

  const info = parseTeamsInvitation(
    "Réunion équipe produit",
    body,
    "organizer@example.com",
  );

  assertExists(info);
  assertEquals(info.summary, "Réunion équipe produit");
  assertEquals(
    info.meetingLink,
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzYx@thread.v2/0?context=%7b%7d",
  );
  assertEquals(info.meetingId, "123 456 789");
  assertEquals(info.passcode, "AbC123");
  assertEquals(info.organizer, "organizer@example.com");
  assertEquals(info.hasDateInfo, false);
  assertEquals(
    info.description,
    [
      "🔗 Rejoindre Teams: https://teams.microsoft.com/l/meetup-join/19%3ameeting_NzYx@thread.v2/0?context=%7b%7d",
      "📞 ID réunion: 123 456 789",
      "🔑 Code: AbC123",
    ].join("\n"),
  );
});

Deno.test("parseTeamsInvitation sets hasDateInfo when Teams body contains a parseable date", () => {
  const body = [
    "Meeting details",
    "mardi 20 janvier 2026 between 10:00 - 11:00",
    "Join Microsoft Teams:",
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc@thread.v2/0",
    "Meeting ID: 987 654 321",
    "Passcode: Secret42",
  ].join("\n");

  const info = parseTeamsInvitation(
    "Weekly sync",
    body,
    "lead@example.com",
  );

  assertExists(info);
  assertEquals(info.summary, "Weekly sync");
  assertEquals(info.meetingId, "987 654 321");
  assertEquals(info.passcode, "Secret42");
  assertEquals(info.organizer, "lead@example.com");
  assertEquals(info.hasDateInfo, true);
});

Deno.test("parseTeamsInvitation returns null when body has no Teams link", () => {
  const info = parseTeamsInvitation(
    "Zoom meeting",
    "Join here: https://example.zoom.us/j/123456789",
    "sender@example.com",
  );

  assertEquals(info, null);
});

Deno.test("parseTeamsInvitation returns null when Teams domain is mentioned but no valid meeting URL exists", () => {
  const info = parseTeamsInvitation(
    "Teams meeting",
    "The domain teams.microsoft.com is mentioned, but there is no meetup-join URL.",
    "sender@example.com",
  );

  assertEquals(info, null);
});

Deno.test("module exposes parser functions and invalid runtime inputs fail locally", async () => {
  const mod = await import("./google-calendar-parser.ts");

  assertEquals(typeof mod.parseGoogleCalendarEmail, "function");
  assertEquals(typeof mod.parseTeamsInvitation, "function");

  assertThrows(() => {
    parseGoogleCalendarEmail(
      "Invitation : Entrée invalide",
      undefined as unknown as string,
      "sender@example.com",
    );
  }, TypeError);

  await assertRejects(
    async () => {
      parseTeamsInvitation(
        "Teams invalid",
        undefined as unknown as string,
        "sender@example.com",
      );
    },
    TypeError,
  );
});