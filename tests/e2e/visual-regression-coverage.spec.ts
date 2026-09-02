import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Visual regression — capture/compare screenshot sur les routes clés.
 *
 * Gated : RUN_VISUAL=true (sinon skip). Au premier run, Playwright crée la baseline
 * (`*-snapshots/`). Les runs suivants comparent avec un seuil tolérant (3 %)
 * pour absorber le bruit anti-aliasing / fontes.
 *
 * Pour régénérer les baselines après un changement UI volontaire :
 *   RUN_VISUAL=true bunx playwright test visual-regression-coverage --update-snapshots
 */

const ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'dashboard' },
  { path: '/etablissements', name: 'etablissements' },
  { path: '/prospects', name: 'prospects' },
  { path: '/emails', name: 'emails' },
  { path: '/calendrier', name: 'calendrier' },
  { path: '/tresorerie', name: 'tresorerie' },
  { path: '/people', name: 'people' },
  { path: '/rd', name: 'rd' },
  { path: '/contrats', name: 'contrats' },
  { path: '/formations', name: 'formations' },
  { path: '/support', name: 'support' },
  { path: '/pulse', name: 'pulse' },
  { path: '/documents', name: 'documents' },
  { path: '/parametres', name: 'parametres' },
  { path: '/profil', name: 'profil' },
];

test.describe('Visual regression (gated)', () => {
  test.skip(process.env.RUN_VISUAL !== 'true', 'RUN_VISUAL != true');
  // Visual specs sont chromium-only : Firefox/WebKit rendent légèrement différemment.
  test.skip(({ browserName }) => browserName !== 'chromium', 'visual: chromium only');

  for (const { path, name } of ROUTES) {
    test(`screenshot ${name}`, async ({ page }) => {
      await loginAsAdmin(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      // Laisser les animations/spinners se stabiliser.
      await page.waitForTimeout(1500);
      // Masquer les zones bruyantes (dates, badges temps réel, avatars dynamiques).
      const masks = [
        page.locator('[data-testid="current-date"]'),
        page.locator('[data-realtime]'),
        page.locator('time'),
      ];
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.03,
        animations: 'disabled',
        mask: masks,
      });
    });
  }
});
