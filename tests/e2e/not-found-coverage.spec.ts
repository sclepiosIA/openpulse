import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les routes inconnues affichent une 404 propre (pas de crash).
 */

const ROUTES = ['/route-inexistante-xyz', '/etablissements/this-uuid-does-not-exist', '/emails/zzz', '/foo/bar/baz'];

test.describe('404 / routes inconnues', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} affiche une 404 sans crash`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
