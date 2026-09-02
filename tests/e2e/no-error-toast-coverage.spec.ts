import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune toast d'erreur n'est visible au chargement initial
 * des pages principales (signal régressions silencieuses).
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/tresorerie', '/taches'];

test.describe('Pas de toast d\'erreur au chargement', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : pas de toast destructive`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2500);
      const errToast = page.locator('[data-state="open"][data-type="destructive"], [data-sonner-toast][data-type="error"]');
      const count = await errToast.count();
      expect(count, `Toast d'erreur visible sur ${path}`).toBe(0);
    });
  }
});
