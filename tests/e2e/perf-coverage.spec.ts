import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E — budgets de performance par route.
 *
 * Pour chaque route majeure on mesure :
 *   - Temps de paint initial (`page.goto` → DOMContentLoaded).
 *   - LCP (Largest Contentful Paint) via PerformanceObserver.
 *   - Nombre de requêtes réseau pendant le chargement.
 *
 * Les budgets sont volontairement larges (sandbox CI lente) ; objectif :
 * attraper les régressions de fond (bundle qui double, N+1 requêtes,
 * LCP qui passe de 3 s à 12 s). À ratcheter au fil du temps.
 *
 * Cf. mem://features/monitoring/web-vitals-capture pour la mesure
 * temps-réel en production.
 */

type Budget = {
  path: string;
  domContentLoadedMs: number;
  lcpMs: number;
  maxRequests: number;
};

const BUDGETS: Budget[] = [
  { path: '/', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 250 },
  { path: '/etablissements', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 250 },
  { path: '/emails', domContentLoadedMs: 15000, lcpMs: 22000, maxRequests: 300 },
  { path: '/calendrier', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 250 },
  { path: '/taches', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 200 },
  { path: '/tresorerie', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 250 },
  { path: '/people', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 250 },
  { path: '/automatisations', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 200 },
  { path: '/parametres', domContentLoadedMs: 12000, lcpMs: 18000, maxRequests: 200 },
];

async function measureLcp(page: Page): Promise<number | null> {
  return page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        let lcp: number | null = null;
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              const last = entries[entries.length - 1] as PerformanceEntry & {
                renderTime?: number;
                loadTime?: number;
              };
              lcp = last.renderTime || last.loadTime || last.startTime;
            }
          });
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(lcp);
          }, 4000);
        } catch {
          resolve(null);
        }
      }),
  );
}

test.describe('Performance — budgets par route', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { path, domContentLoadedMs, lcpMs, maxRequests } of BUDGETS) {
    test(`${path} respecte les budgets DOMContentLoaded / LCP / réseau`, async ({
      page,
    }) => {
      let requestCount = 0;
      page.on('request', () => {
        requestCount++;
      });

      const start = Date.now();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const dclMs = Date.now() - start;

      expect(
        dclMs,
        `DOMContentLoaded ${dclMs}ms > budget ${domContentLoadedMs}ms sur ${path}`,
      ).toBeLessThan(domContentLoadedMs);

      // Attendre paint principal puis mesurer LCP.
      await page.waitForLoadState('networkidle').catch(() => {});
      const lcp = await measureLcp(page);
      if (lcp !== null) {
        expect(
          lcp,
          `LCP ${Math.round(lcp)}ms > budget ${lcpMs}ms sur ${path}`,
        ).toBeLessThan(lcpMs);
      }

      expect(
        requestCount,
        `${requestCount} requêtes > budget ${maxRequests} sur ${path}`,
      ).toBeLessThan(maxRequests);
    });
  }
});
