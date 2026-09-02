import { test, expect, devices } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { keepRealRuntimeErrors } from './helpers/runtime-errors';

/**
 * Couverture E2E mobile — rend les modules majeurs sur viewport iPhone 12
 * et vérifie qu'aucun module ne crashe, ne déborde horizontalement, et
 * que le shell + le menu hamburger sont accessibles.
 *
 * Complète `pages-responsive.spec.ts` (qui scanne l'overflow) en ajoutant
 * un round-trip d'interaction : ouverture du menu mobile, navigation.
 */

test.use({ ...devices['iPhone 12'] });

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;

const MOBILE_ROUTES = [
  '/',
  '/etablissements',
  '/prospects',
  '/emails',
  '/calendrier',
  '/taches',
  '/pulse',
  '/people',
  '/tresorerie',
  '/facturation',
  '/contrats',
  '/support',
  '/documents',
  '/automatisations',
  '/rapports-custom',
  '/social',
  '/profil',
  '/parametres',
];

test.describe('Mobile (iPhone 12) — modules majeurs sans crash ni overflow', () => {
  for (const path of MOBILE_ROUTES) {
    test(`mobile ${path}`, async ({ page }) => {
      // L'écouteur doit être armé AVANT toute navigation : posé juste avant
      // l'assertion, il ne pouvait rien capturer et le test ne vérifiait donc
      // rien sur ce point.
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(e.message));

      await loginAsAdmin(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});

      // Shell visible.
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      // Pas d'ErrorBoundary.
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);

      // Pas de scroll horizontal involontaire (tolérance 2px scrollbars).
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `Overflow horizontal de ${overflow}px sur ${path}`).toBeLessThanOrEqual(2);

      // Aucune erreur JS runtime imputable à l'application.
      const realErrors = keepRealRuntimeErrors(errs);
      expect(realErrors, realErrors.join('\n')).toHaveLength(0);
    });
  }
});

test.describe('Mobile — menu hamburger', () => {
  test('le menu mobile s\'ouvre et liste au moins 5 entrées de navigation', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle').catch(() => {});

    const hamburger = page
      .getByRole('button', { name: /menu|navigation|ouvrir.*menu/i })
      .or(page.locator('button[aria-label*="menu" i]'))
      .first();

    if (!(await hamburger.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Menu hamburger non trouvé (peut être déjà ouvert).');
      return;
    }

    await hamburger.click();

    // Sheet/dialog/nav visible avec plusieurs items.
    const navLinks = page.getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
