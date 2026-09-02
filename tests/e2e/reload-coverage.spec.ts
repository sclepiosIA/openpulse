import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'un Ctrl+R / reload pendant l'affichage d'une page restaure
 * correctement le shell (pas d'écran blanc post-reload).
 */

// `/taches` est un alias qui redirige (Navigate replace) vers `/todos` :
// après rechargement l'URL observée est `/todos`, jamais `/taches`.
const ROUTES = ['/etablissements', '/emails', '/people', '/todos'];

test.describe('Reload mid-page', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : reload restaure le shell`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }
});
