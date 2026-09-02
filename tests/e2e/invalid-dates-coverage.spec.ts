import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune date affichée n'est "Invalid Date" sur les pages clés.
 */

const ROUTES = ['/', '/etablissements', '/emails', '/taches', '/tresorerie', '/people'];

test.describe('Aucune Invalid Date affichée', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} sans Invalid Date`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const bad = await page.locator('text=/Invalid Date/i').count();
      expect(bad, `Invalid Date détecté sur ${path}`).toBe(0);
    });
  }
});
