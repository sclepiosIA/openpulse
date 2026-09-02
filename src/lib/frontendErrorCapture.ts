/**
 * Frontend Error Capture - Sends JS errors to Supabase for admin monitoring.
 * Captures: uncaught errors, unhandled rejections, ErrorBoundary catches.
 * Deduplicates via fingerprint (message hash) with a 10s cooldown.
 */
import { supabase } from "@/integrations/supabase/client";

interface ErrorReport {
  error_message: string;
  error_stack?: string;
  error_type: 'runtime' | 'unhandled_rejection' | 'react_boundary' | 'network' | 'user_toast' | 'realtime';
  component_name?: string;
  current_route?: string;
  browser_info?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

class FrontendErrorCapture {
  private recentFingerprints = new Map<string, number>();
  private cooldownMs = 10_000;
  private maxPerMinute = 20;
  private minuteCount = 0;
  private minuteResetTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  /**
   * Filter out known noise patterns that pollute logs without being actionable:
   * - Playwright/devtools probes (`__pw_*`)
   * - ResizeObserver loop (benign browser warning)
   * - JWT expired (auth refresh handles it)
   * - upstream timeouts on background SSE (already retried)
   * - script errors from third-party iframes
   */
  private isNoise(message: string, stack?: string): boolean {
    if (!message) return true;
    const m = message.toLowerCase();
    const s = (stack || '').toLowerCase();
    // Injected automation / eval'd probes (browser-use, Playwright validators…)
    // Stacks pointing at `<anonymous>:` or known validator names aren't our code.
    if (
      s.includes('validationonpage') ||
      s.includes('at <anonymous>:') ||
      s.includes('(<anonymous>:')
    ) {
      return true;
    }
    // react-grid-layout internal crashes ("na is not a function") — GridErrorBoundary
    // déjà actif dans ReportGrid avec fallback grille simple. Pas de signal actionnable.
    if (s.includes('reportgrid') && m.includes('is not a function')) {
      return true;
    }
    return (
      m.includes('__pw_') ||
      m.includes('resizeobserver loop') ||
      m.includes('jwt expired') ||
      m.includes('upstream request timeout') ||
      m.includes('upstream connect error') ||
      m.includes('failed to fetch') ||
      m.includes('networkerror when attempting') ||
      m.includes('load failed') ||
      m === 'script error.' ||
      m === 'script error' ||
      // --- Bruit extensions navigateur / trackers tiers ---
      m.includes('[meta pixel]') ||
      m.includes('[tr-ws]') ||
      m.includes('port disconnected from addon') ||
      m.includes('browser-integration.js') ||
      m.includes('chrome-extension://') ||
      m.includes('moz-extension://') ||
      m.includes('firestore') ||                  // pas utilisé par l'app
      m.includes('@firebase/firestore') ||
      m.includes('webchannelconnection') ||
      m.includes('err_quic_protocol_error') ||
      m.includes('err_network_changed') ||
      // --- Warnings iframe sandbox / Permissions-Policy hors contrôle ---
      m.includes("unrecognized feature: 'vr'") ||
      m.includes("unrecognized feature: 'ambient-light-sensor'") ||
      m.includes("unrecognized feature: 'battery'") ||
      m.includes('iframe which has both allow-scripts and allow-same-origin') ||
      // --- Warning Radix Tooltip (controlled/uncontrolled, non bloquant) ---
      m.includes('tooltip is changing from controlled to uncontrolled') ||
      m.includes('tooltip is changing from uncontrolled to controlled') ||
      // --- Supabase plateforme (incidents transitoires GoTrue/PostgREST) ---
      m.includes('context deadline exceeded') ||
      m.includes('processing this request timed out') ||
      m.includes('error finding refresh token') ||
      // --- Realtime status transients (auto-retry côté supabase-js, badge dégrade à 0) ---
      m.includes('[realtime:status]') ||
      m.includes('channel_error') ||
      m.includes('timed_out') ||
      // --- Legacy "after subscribe" (corrigé via safeRealtimeChannel + suffixe unique) ---
      m.includes('cannot add `postgres_changes` callbacks') ||
      m.includes('cannot add postgres_changes callbacks') ||
      // --- Validations formulaire remontées par sonner (ce n'est pas une erreur applicative) ---
      /^(le|la|les|un|une) .{0,80}(est|sont) (requis|obligatoire|invalide)/.test(m) ||
      m.startsWith('veuillez ') ||
      m.startsWith('merci de ') ||
      m.startsWith('champ requis') ||
      m.includes('email invalide') ||
      m.includes('format invalide') ||
      // --- Erreurs HTTP transitoires (300/0) sans info actionnable ---
      /^\[300\] http error$/.test(m) ||
      /^\[0\] failed to fetch$/.test(m)
    );
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    window.addEventListener('error', (event) => {
      const msg = event.message || 'Unknown error';
      const stack = event.error?.stack;
      if (this.isNoise(msg, stack)) return;
      this.report({
        error_message: msg,
        error_stack: stack,
        error_type: 'runtime',
        current_route: window.location.pathname,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason) || 'Unhandled promise rejection';
      const stack = reason?.stack;
      if (this.isNoise(msg, stack)) return;
      this.report({
        error_message: msg,
        error_stack: stack,
        error_type: 'unhandled_rejection',
        current_route: window.location.pathname,
      });
    });
  }

  reportBoundaryError(error: Error, componentStack?: string, componentName?: string) {
    this.report({
      error_message: error.message,
      error_stack: error.stack,
      error_type: 'react_boundary',
      component_name: componentName,
      current_route: window.location.pathname,
      metadata: { componentStack },
    });
  }

  reportNetworkError(url: string, status: number, message: string) {
    this.report({
      error_message: `[${status}] ${message}`,
      error_type: 'network',
      current_route: window.location.pathname,
      metadata: { url, status },
    });
  }

  /**
   * Exceptions Supabase Realtime (subscribe / removeChannel / addBinding…)
   * Capturées par `safeRealtimeChannel()` pour ne jamais casser l'UI tout
   * en gardant une trace en base — root cause des crashs shell admin (audit
   * run-1782663570 : "cannot add postgres_changes callbacks after subscribe()").
   */
  reportRealtimeError(
    phase: 'subscribe' | 'remove' | 'bind' | 'callback' | 'status',
    channelName: string,
    err: unknown,
    extra?: Record<string, unknown>,
  ) {
    const e = err as { message?: string; stack?: string; status?: string } | null;
    const message = e?.message || (typeof err === 'string' ? err : 'Realtime error');
    if (this.isNoise(message, e?.stack)) return;
    this.report({
      error_message: `[realtime:${phase}] ${channelName} — ${message}`.slice(0, 500),
      error_stack: e?.stack,
      error_type: 'realtime',
      component_name: 'SupabaseRealtime',
      current_route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      metadata: { phase, channel: channelName, status: e?.status, ...extra },
    });
  }



  /**
   * Toasts shown to the user (sonner toast.error / toast.warning).
   * Captures the actual UX failure surface — what the user really sees.
   */
  reportToastError(message: string, severity: 'error' | 'warning' = 'error') {
    if (this.isNoise(message)) return;
    this.report({
      error_message: message.slice(0, 500),
      error_type: 'user_toast',
      current_route: window.location.pathname,
      metadata: { severity },
    });
  }

  private fingerprint(msg: string): string {
    let hash = 0;
    const str = msg.slice(0, 200);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async report(report: ErrorReport) {
    try {
      if (this.minuteCount >= this.maxPerMinute) return;
      
      const fp = this.fingerprint(report.error_message);
      const now = Date.now();
      const lastSeen = this.recentFingerprints.get(fp);
      if (lastSeen && now - lastSeen < this.cooldownMs) return;
      this.recentFingerprints.set(fp, now);

      this.minuteCount++;
      if (!this.minuteResetTimer) {
        this.minuteResetTimer = setTimeout(() => {
          this.minuteCount = 0;
          this.minuteResetTimer = null;
        }, 60_000);
      }

      // Use getSession() (cached, no browser lock) instead of getUser() to avoid auth contention
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        screenWidth: screen.width,
        screenHeight: screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };

      // Use RPC instead of direct table access
      await supabase.rpc('log_frontend_error' as never, {
        p_error_message: report.error_message,
        p_error_type: report.error_type,
        p_error_stack: report.error_stack || undefined,
        p_component_name: report.component_name || undefined,
        p_current_route: report.current_route || undefined,
        p_browser_info: JSON.parse(JSON.stringify(browserInfo)),
        p_metadata: report.metadata ? JSON.parse(JSON.stringify(report.metadata)) : undefined,
        p_fingerprint: fp,
      } as never);
    } catch {
      // Silently fail - don't create error loops
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, time] of this.recentFingerprints) {
      if (now - time > 60_000) this.recentFingerprints.delete(key);
    }
  }
}

export const frontendErrorCapture = new FrontendErrorCapture();
