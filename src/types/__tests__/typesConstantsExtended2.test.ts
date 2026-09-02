import { describe, it, expect } from "vitest";
import * as Pulse from "@/types/pulse";
import * as Rd from "@/types/rd";
import * as Recrutement from "@/types/recrutement";
import * as Report from "@/types/report";
import * as Rgpd from "@/types/rgpd";
import * as Signature from "@/types/signature";
import * as LiveChat from "@/types/live-chat";
import * as JarvisV6 from "@/types/jarvis-v6";
import { JARVIS_CAPABILITIES } from "@/types/jarvis";
import {
  AVAILABILITY_LABELS,
  REMINDER_OPTIONS,
  CALENDAR_COLORS,
  EVENT_STATUS_LABELS,
  ATTENDEE_STATUS_LABELS,
  ATTENDEE_ROLE_LABELS,
  createVideoProviders,
  VIDEO_PROVIDERS,
  detectProviderFromUrl,
  generateRoomId,
} from "@/types/calendar";
import {
  BEHAVIORAL_EVENT_LABELS,
  ATTRIBUTION_CHANNEL_LABELS,
  SCORE_TIERS,
  getScoreTier,
} from "@/types/scoring";

const nonEmpty = (o: unknown) =>
  expect(Object.keys(o as Record<string, unknown>).length).toBeGreaterThan(0);

describe("types/pulse, rd, recrutement, report, rgpd, signature, live-chat, jarvis", () => {
  it("pulse PRESENCE_STATUS_CONFIG is non-empty", () => nonEmpty(Pulse.PRESENCE_STATUS_CONFIG));
  it("rd exposes DPI/KANBAN/STORY_POINTS/PRIORITE", () => {
    nonEmpty(Rd.DPI_CONFIG);
    expect(Array.isArray(Rd.KANBAN_COLUMNS)).toBe(true);
    expect(Rd.KANBAN_COLUMNS.length).toBeGreaterThan(0);
    expect(Rd.STORY_POINTS).toEqual([1, 2, 3, 5, 8, 13, 21]);
    nonEmpty(Rd.PRIORITE_CONFIG);
  });
  it("recrutement pipeline & labels", () => {
    expect(Array.isArray(Recrutement.CANDIDATE_PIPELINE_COLUMNS)).toBe(true);
    expect(Recrutement.CANDIDATE_PIPELINE_COLUMNS.length).toBeGreaterThan(0);
    nonEmpty(Recrutement.CONTRACT_TYPE_LABELS);
    nonEmpty(Recrutement.JOB_STATUS_LABELS);
    nonEmpty(Recrutement.CANDIDATE_STATUS_LABELS);
    expect(Array.isArray(Recrutement.CANDIDATE_SOURCES)).toBe(true);
    expect(Recrutement.CANDIDATE_SOURCES.length).toBeGreaterThan(0);
  });
  it("report sources & limits", () => {
    expect(Array.isArray(Report.REPORT_SOURCES)).toBe(true);
    expect(Report.REPORT_SOURCES.length).toBeGreaterThan(0);
    nonEmpty(Report.WIDGET_DEFAULT_SIZE);
    expect(Report.MAX_WIDGETS_PER_DASHBOARD).toBeGreaterThan(0);
    expect(Report.MAX_DASHBOARDS_PER_USER).toBeGreaterThan(0);
  });
  it("rgpd label/color maps", () => {
    nonEmpty(Rgpd.BASE_LEGALE_LABELS);
    nonEmpty(Rgpd.DEMANDE_STATUT_LABELS);
    nonEmpty(Rgpd.DEMANDE_STATUT_COLORS);
    nonEmpty(Rgpd.DROIT_TYPE_LABELS);
    nonEmpty(Rgpd.VIOLATION_SEVERITE_LABELS);
    nonEmpty(Rgpd.VIOLATION_SEVERITE_COLORS);
  });
  it("signature maps", () => {
    nonEmpty(Signature.SIGNATURE_STATUS_LABELS);
    nonEmpty(Signature.SIGNATURE_STATUS_COLORS);
    nonEmpty(Signature.SIGNATURE_EVENT_LABELS);
  });
  it("live-chat maps", () => {
    nonEmpty(LiveChat.STATUS_LABELS);
    nonEmpty(LiveChat.STATUS_COLORS);
    nonEmpty(LiveChat.PRIORITY_LABELS);
    nonEmpty(LiveChat.PRIORITY_COLORS);
    nonEmpty(LiveChat.SENDER_TYPE_LABELS);
  });
  it("jarvis capabilities & v6 maps", () => {
    expect(Array.isArray(JARVIS_CAPABILITIES)).toBe(true);
    expect(JARVIS_CAPABILITIES.length).toBeGreaterThan(0);
    nonEmpty(JarvisV6.AGENT_VOICE_MAP);
    nonEmpty(JarvisV6.AUTONOMY_LEVELS);
  });
});

describe("types/calendar runtime", () => {
  it("exposes label & options arrays", () => {
    nonEmpty(AVAILABILITY_LABELS);
    expect(Array.isArray(REMINDER_OPTIONS)).toBe(true);
    expect(Array.isArray(CALENDAR_COLORS)).toBe(true);
    nonEmpty(EVENT_STATUS_LABELS);
    nonEmpty(ATTENDEE_STATUS_LABELS);
    nonEmpty(ATTENDEE_ROLE_LABELS);
  });
  it("createVideoProviders defaults & overrides", () => {
    const def = createVideoProviders();
    expect(def.length).toBeGreaterThan(3);
    const custom = createVideoProviders({ jitsi_url: "https://j.example.com" });
    const jitsi = custom.find((p) => p.id === "jitsi");
    expect(jitsi?.generateLink("room1")).toBe("https://j.example.com/room1");
    expect(VIDEO_PROVIDERS.length).toBeGreaterThan(0);
  });
  it("detectProviderFromUrl identifies providers", () => {
    expect(detectProviderFromUrl("")).toBe("none");
    expect(detectProviderFromUrl("https://meet.google.com/abc-def")).toBe("meet");
    expect(detectProviderFromUrl("https://teams.microsoft.com/x")).toBe("teams");
    expect(detectProviderFromUrl("https://zoom.us/j/123")).toBe("zoom");
    expect(detectProviderFromUrl("https://meet.jit.si/abc")).toBe("jitsi");
    expect(detectProviderFromUrl("https://x/visio/abc")).toBe("marque");
    expect(detectProviderFromUrl("https://nextcloud.org/call/x")).toBe("nextcloud");
    expect(detectProviderFromUrl("https://other.com")).toBe("custom");
  });
  it("generateRoomId slugifies title with suffix", () => {
    const id = generateRoomId("Réunion Équipe!");
    expect(id).toMatch(/^reunion-equipe-[a-z0-9]+$/);
    const noTitle = generateRoomId("");
    expect(noTitle).toMatch(/^[a-z0-9]+$/);
  });
});

describe("types/scoring runtime", () => {
  it("label maps non-empty", () => {
    nonEmpty(BEHAVIORAL_EVENT_LABELS);
    nonEmpty(ATTRIBUTION_CHANNEL_LABELS);
  });
  it("SCORE_TIERS ordered desc & getScoreTier returns right tier", () => {
    expect(SCORE_TIERS[0].min).toBe(80);
    expect(getScoreTier(95).label).toBe("Chaud");
    expect(getScoreTier(70).label).toBe("Tiède");
    expect(getScoreTier(45).label).toBe("À travailler");
    expect(getScoreTier(10).label).toBe("Froid");
    expect(getScoreTier(0).label).toBe("Froid");
  });
});
