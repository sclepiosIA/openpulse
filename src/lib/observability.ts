/**
 * Observability — OBS-1 (navigation tracking) + OBS-3 (fetch interceptor).
 *
 * - Navigation : buffer in-memory (50 dernières routes) consultable via
 *   `getNavigationTrail()` ; utilisé par `frontendErrorCapture` pour enrichir
 *   les rapports d'erreur (savoir d'où vient l'utilisateur).
 * - Fetch : intercepte `window.fetch` et signale via
 *   `frontendErrorCapture.reportNetworkError` les erreurs HTTP 5xx (et 4xx hors
 *   401/403/404 attendus). Filtre Supabase auth/realtime, web-vitals, sentry
 *   pour éviter le bruit.
 *
 * Léger, pas de table dédiée, pas de dépendance externe.
 */
import { frontendErrorCapture } from './frontendErrorCapture';
import { debug } from './debug';

const NAV_BUFFER_SIZE = 50;

class Observability {
  private navTrail: Array<{ route: string; ts: number }> = [];
  private fetchInstalled = false;
  private lastReported = new Map<string, number>();
  private reportCooldownMs = 30_000;

  // ---------- Navigation ----------
  trackNavigation(route: string) {
    if (!route) return;
    const last = this.navTrail[this.navTrail.length - 1];
    if (last && last.route === route) return;
    this.navTrail.push({ route, ts: Date.now() });
    if (this.navTrail.length > NAV_BUFFER_SIZE) this.navTrail.shift();
  }

  getNavigationTrail() {
    return [...this.navTrail];
  }

  // ---------- Fetch interceptor ----------
  installFetchInterceptor() {
    if (this.fetchInstalled || typeof window === 'undefined') return;
    this.fetchInstalled = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

      try {
        const response = await originalFetch(input, init);

        // Ignore non-error responses
        if (response.ok) return response;

        if (this.isIgnoredEndpoint(url)) return response;
        if (this.isExpectedStatus(response.status)) return response;

        if (this.shouldReport(`${response.status}:${url}`)) {
          frontendErrorCapture.reportNetworkError(url, response.status, response.statusText || 'HTTP error');
        }
        return response;
      } catch (err: unknown) {
        // Network error (offline, CORS, abort, etc.) — only report unexpected ones
        const message = err instanceof Error ? err.message : String(err);
        if (this.isAbortError(err) || this.isIgnoredEndpoint(url)) throw err;
        if (this.shouldReport(`network:${url}`)) {
          frontendErrorCapture.reportNetworkError(url, 0, message);
        }
        throw err;
      }
    };

    if (import.meta.env.DEV) debug.log('[Observability] fetch interceptor installed');
  }

  private isAbortError(err: unknown): boolean {
    return err instanceof Error && (err.name === 'AbortError' || err.message.includes('aborted'));
  }

  private isExpectedStatus(status: number): boolean {
    // 401/403 = auth flow normal, 404 = entité supprimée, 409 = conflit attendu (upsert)
    return status === 401 || status === 403 || status === 404 || status === 409;
  }

  private isIgnoredEndpoint(url: string): boolean {
    if (!url) return true;
    const u = url.toLowerCase();
    return (
      u.includes('/auth/v1/') ||         // Supabase auth refresh (504 plateforme silencés)
      u.includes('/realtime/v1/') ||     // Supabase realtime
      u.includes('/storage/v1/object/public/') || // Public assets — pas critique
      u.includes('web-vitals') ||
      u.includes('sentry.io') ||
      u.includes('plateforme-edition-api.com') ||   // SDK la plateforme initiale
      u.includes('chrome-extension://') ||
      u.includes('moz-extension://') ||
      u.includes('firestore.googleapis.com') ||  // extension navigateur, pas notre stack
      u.includes('googleapis.com/identitytoolkit') ||
      u.includes('manifest.webmanifest') ||      // 401 attendu en preview non auth
      u.startsWith('blob:') ||
      u.startsWith('data:')
    );
  }

  private shouldReport(key: string): boolean {
    const now = Date.now();
    const last = this.lastReported.get(key);
    if (last && now - last < this.reportCooldownMs) return false;
    this.lastReported.set(key, now);
    // Cleanup map si > 100 entrées
    if (this.lastReported.size > 100) {
      for (const [k, t] of this.lastReported) {
        if (now - t > this.reportCooldownMs * 2) this.lastReported.delete(k);
      }
    }
    return true;
  }
}

export const observability = new Observability();
