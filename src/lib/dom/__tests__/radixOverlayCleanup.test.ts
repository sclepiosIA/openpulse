import { describe, it, expect, beforeEach } from "vitest";
import {
  hasOpenDialog,
  isBodyLocked,
  cleanupRadixUIState,
  cleanupRadixUIStateDelayed,
  createRadixWatchdog,
} from "@/lib/dom/radixOverlayCleanup";

describe("radixOverlayCleanup", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-scroll-locked");
    document.body.style.cssText = "";
    document.documentElement.style.cssText = "";
  });

  it("hasOpenDialog detects open dialog", () => {
    expect(hasOpenDialog()).toBe(false);
    const d = document.createElement("div");
    d.setAttribute("role", "dialog");
    d.setAttribute("data-state", "open");
    document.body.appendChild(d);
    expect(hasOpenDialog()).toBe(true);
  });

  it("isBodyLocked detects scroll-locked attribute", () => {
    expect(isBodyLocked()).toBe(false);
    document.body.setAttribute("data-scroll-locked", "");
    expect(isBodyLocked()).toBe(true);
  });

  it("isBodyLocked detects overflow hidden", () => {
    document.body.style.overflow = "hidden";
    expect(isBodyLocked()).toBe(true);
  });

  it("cleanupRadixUIState removes locks when no dialog open", () => {
    document.body.setAttribute("data-scroll-locked", "");
    document.body.style.overflow = "hidden";
    document.body.style.pointerEvents = "none";
    cleanupRadixUIState();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.pointerEvents).toBe("");
  });

  it("cleanupRadixUIState skips when dialog open (non-aggressive)", () => {
    const d = document.createElement("div");
    d.setAttribute("role", "dialog");
    d.setAttribute("data-state", "open");
    document.body.appendChild(d);
    document.body.setAttribute("data-scroll-locked", "");
    cleanupRadixUIState();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);
  });

  it("aggressive cleanup removes orphan portals and focus guards", () => {
    const p = document.createElement("div");
    p.setAttribute("data-radix-portal", "");
    document.body.appendChild(p);
    const fg = document.createElement("div");
    fg.setAttribute("data-radix-focus-guard", "");
    document.body.appendChild(fg);
    cleanupRadixUIState({ aggressive: true });
    expect(document.querySelectorAll("[data-radix-portal]").length).toBe(0);
    expect(document.querySelectorAll("[data-radix-focus-guard]").length).toBe(0);
  });

  it("cleanupRadixUIStateDelayed runs without throwing", () => {
    expect(() => cleanupRadixUIStateDelayed()).not.toThrow();
  });

  it("createRadixWatchdog returns a cleanup function", () => {
    const stop = createRadixWatchdog(50);
    expect(typeof stop).toBe("function");
    stop();
  });
});
