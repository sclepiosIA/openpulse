import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les badges de notification (compteurs) affichent un nombre
 * valide ou rien (pas "NaN", "undefined", "null").
 */

const ROUTES = ['/', '/emails', '/notifications', '/taches'];

test.describe('Badges compteurs sans NaN/undefined', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : aucun badge NaN/undefined`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const bad = await page.locator('text=/\\b(NaN|undefined|null)\\b/').count();
      expect(bad, `Badge corrompu sur ${path}`).toBe(0);
    });
  }
});
