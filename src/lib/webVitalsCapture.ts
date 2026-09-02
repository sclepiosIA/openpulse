/**
 * Web Vitals capture (LCP, INP, CLS, FCP, TTFB) — native PerformanceObserver,
 * sampling 1/10 to keep volume low. Sends via `log_web_vital` RPC.
 *
 * No external dep (web-vitals lib is ~3KB but adds another bundle entry — we
 * keep this lightweight and dependency-free).
 */
import { supabase } from "@/integrations/supabase/client";

type Metric = "LCP" | "INP" | "CLS" | "FCP" | "TTFB";

interface VitalPayload {
  metric: Metric;
  value: number;
  rating?: "good" | "needs-improvement" | "poor";
  navigation_type?: string;
}

const THRESHOLDS: Record<Metric, [number, number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

function rate(metric: Metric, value: number): VitalPayload["rating"] {
  const [g, p] = THRESHOLDS[metric];
  if (value <= g) return "good";
  if (value <= p) return "needs-improvement";
  return "poor";
}

class WebVitalsCapture {
  private initialized = false;
  private sampleRate = 0.1; // 10 %
  private queue: VitalPayload[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private observers: PerformanceObserver[] = [];
  private clsValue = 0;
  private clsSessionValue = 0;
  private clsSessionEntries: PerformanceEntry[] = [];
  private inFlight = false;
  private lcp = 0;
  private worstINP = 0;
  private reported = { LCP: false, CLS: false, INP: false };

  init() {
    if (this.initialized || typeof window === "undefined") return;
    if (!("PerformanceObserver" in window)) return;
    // Sample at session level so a given user reports consistently
    if (Math.random() > this.sampleRate) {
      this.initialized = true;
      return;
    }
    this.initialized = true;

    this.observeLCP();
    this.observeCLS();
    this.observeINP();
    this.observePaintAndTTFB();

    // SPA/PWA: visibilitychange rarely fires inside a long-running session.
    // Report after a fixed delay so we actually capture data even when the
    // user never closes the tab.
    setTimeout(() => this.reportInteractive(), 15000);
    setTimeout(() => this.reportInteractive(), 60000);

    // Flush on page hide (most reliable for final values)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.reportInteractive();
        this.flush();
      }
    });
    window.addEventListener("pagehide", () => {
      this.reportInteractive();
      this.flush();
    });
  }

  private reportInteractive() {
    if (!this.reported.LCP && this.lcp > 0) {
      this.enqueue({ metric: "LCP", value: Math.round(this.lcp), rating: rate("LCP", this.lcp) });
      this.reported.LCP = true;
    }
    if (!this.reported.CLS && this.clsValue > 0) {
      this.enqueue({
        metric: "CLS",
        value: Number(this.clsValue.toFixed(3)),
        rating: rate("CLS", this.clsValue),
      });
      this.reported.CLS = true;
    }
    if (!this.reported.INP && this.worstINP > 0) {
      this.enqueue({
        metric: "INP",
        value: Math.round(this.worstINP),
        rating: rate("INP", this.worstINP),
      });
      this.reported.INP = true;
    }
  }

  private safeObserve(type: string, cb: PerformanceObserverCallback, buffered = true) {
    try {
      const po = new PerformanceObserver(cb);
      po.observe({ type, buffered } as PerformanceObserverInit);
      this.observers.push(po);
    } catch {
      // ignore unsupported entry types
    }
  }

  private observeLCP() {
    this.safeObserve("largest-contentful-paint", (list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (last) this.lcp = last.startTime;
    });
  }

  private observeCLS() {
    this.safeObserve("layout-shift", (list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (entry.hadRecentInput) continue;
        const first = this.clsSessionEntries[0];
        const last = this.clsSessionEntries[this.clsSessionEntries.length - 1];
        if (
          last &&
          entry.startTime - last.startTime < 1000 &&
          entry.startTime - first.startTime < 5000
        ) {
          this.clsSessionValue += entry.value;
          this.clsSessionEntries.push(entry);
        } else {
          this.clsSessionValue = entry.value;
          this.clsSessionEntries = [entry];
        }
        if (this.clsSessionValue > this.clsValue) {
          this.clsValue = this.clsSessionValue;
        }
      }
    });
  }

  private observeINP() {
    this.safeObserve("event", (list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { duration: number; interactionId?: number }>) {
        if (!entry.interactionId) continue;
        if (entry.duration > this.worstINP) this.worstINP = entry.duration;
      }
    });
  }

  private observePaintAndTTFB() {
    // FCP
    this.safeObserve("paint", (list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          const v = entry.startTime;
          this.enqueue({ metric: "FCP", value: Math.round(v), rating: rate("FCP", v) });
        }
      }
    });
    // TTFB via navigation timing
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (nav && nav.responseStart > 0) {
        const ttfb = nav.responseStart - nav.requestStart;
        if (ttfb > 0) {
          this.enqueue({
            metric: "TTFB",
            value: Math.round(ttfb),
            rating: rate("TTFB", ttfb),
            navigation_type: nav.type,
          });
        }
      }
    } catch {
      /* noop */
    }
  }

  private enqueue(p: VitalPayload) {
    this.queue.push(p);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), 5000);
  }

  private async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.inFlight || this.queue.length === 0) return;
    this.inFlight = true;
    const batch = this.queue.splice(0, this.queue.length);
    const route = window.location.pathname;
    const ua = navigator.userAgent.slice(0, 300);
    try {
      // Send sequentially to avoid PostgREST burst; small batches (<=5)
      for (const v of batch) {
        await supabase.rpc("log_web_vital" as never, {
          p_route: route,
          p_metric: v.metric,
          p_value: v.value,
          p_rating: v.rating ?? null,
          p_navigation_type: v.navigation_type ?? null,
          p_user_agent: ua,
        } as never);
      }
    } catch {
      // silent — never break the UX for telemetry
    } finally {
      this.inFlight = false;
    }
  }
}

export const webVitalsCapture = new WebVitalsCapture();
