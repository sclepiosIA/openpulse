import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture du module Social Dashboard (P11) : visite les sous-routes
 * marketing/social et vérifie le rendu shell sans crash.
 */

// Aligné sur les routes réellement déclarées dans `src/routes/groups/FinanceRoutes.tsx`
// (vérifié le 2026-08-15). Les entrées précédentes — /social/planification,
// /social/analytics, /social/comptes, /social/historique — n'ont jamais existé
// dans le routeur : les tests atterrissaient sur la page 404 et échouaient sur
// leur propre garde-fou « page introuvable ».
const SOCIAL_ROUTES = [
  '/social',
  '/social/composer',
  '/social/calendrier',
  '/social/inbox',
];

test.describe('Social Dashboard — routes', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of SOCIAL_ROUTES) {
    test(`${path} se charge sans crash`, async ({ page }) => {
      const resp = await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => null);
      if (resp && resp.status() >= 500) {
        throw new Error(`HTTP ${resp.status()} sur ${path}`);
      }
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      await expect(page.getByText(/page introuvable|^404$/i)).toHaveCount(0);
    });
  }
});
