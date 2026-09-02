import { describe, it, expect } from "vitest";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_COLOR_CLASSES, REACTION_EMOJIS } from "@/types/activity";
import { createApplicationError } from "@/types/admin";
import { AVOIR_MOTIF_LABELS, AVOIR_STATUT_LABELS, AVOIR_STATUT_COLORS } from "@/types/avoir";
import { VIDEO_PROVIDERS } from "@/types/booking";
import { CALL_STATUS_LABELS, CALL_DIRECTION_LABELS } from "@/types/calls";

describe("types/activity constants", () => {
  it("has labels and colors", () => {
    expect(typeof ACTIVITY_TYPE_LABELS).toBe("object");
    expect(Object.keys(ACTIVITY_TYPE_LABELS).length).toBeGreaterThan(0);
    expect(typeof ACTIVITY_COLOR_CLASSES).toBe("object");
  });
  it("REACTION_EMOJIS is a non-empty array", () => {
    expect(Array.isArray(REACTION_EMOJIS)).toBe(true);
    expect(REACTION_EMOJIS.length).toBeGreaterThan(0);
  });
});

describe("types/admin createApplicationError", () => {
  it("creates an Error with details flag", () => {
    const err = createApplicationError("oops", "more");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("oops");
    expect(err.details).toBe("more");
    expect(err.isApplicationError).toBe(true);
  });
  it("works without details", () => {
    const err = createApplicationError("x");
    expect(err.details).toBeUndefined();
    expect(err.isApplicationError).toBe(true);
  });
});

describe("types/avoir constants", () => {
  it("exposes label maps", () => {
    expect(Object.keys(AVOIR_MOTIF_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(AVOIR_STATUT_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(AVOIR_STATUT_COLORS).length).toBeGreaterThan(0);
  });
});

describe("types/booking VIDEO_PROVIDERS", () => {
  it("is a non-empty array with value+label", () => {
    expect(VIDEO_PROVIDERS.length).toBeGreaterThan(0);
    for (const p of VIDEO_PROVIDERS) {
      expect(typeof p.value).toBe("string");
      expect(typeof p.label).toBe("string");
    }
  });
});

describe("types/calls constants", () => {
  it("has status and direction labels", () => {
    expect(Object.keys(CALL_STATUS_LABELS).length).toBeGreaterThan(0);
    expect(Object.keys(CALL_DIRECTION_LABELS).length).toBeGreaterThan(0);
  });
});
