import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Persistance des filtres URL : on visite chaque module avec un query-string
 * de filtre courant et on vérifie qu'il survit à un reload sans crash.
 */

const ROUTES = [
  '/etablissements?statut=production',
  '/prospects?statut=qualifie',
  '/taches?status=todo',
  '/emails?folder=inbox',
  '/people?onglet=vue-ensemble',
];

test.describe('Persistance des filtres via URL', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of ROUTES) {
    test(`${path} → reload conserve l'URL`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      const before = page.url();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      expect(page.url()).toBe(before);
    });
  }
});
