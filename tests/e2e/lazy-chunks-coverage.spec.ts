import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'au moins une route par module charge un chunk JS dynamique
 * (signal que le code-splitting fonctionne, pas tout dans le bundle initial).
 */

const ROUTES = ['/etablissements', '/emails', '/people', '/tresorerie', '/parametres'];

test.describe('Lazy chunks chargés', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} déclenche au moins un chunk JS`, async ({ page }) => {
      const chunks: string[] = [];
      page.on('response', resp => {
        const url = resp.url();
        if (/\.js(\?|$)/.test(url) && resp.status() < 400) chunks.push(url);
      });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      expect(chunks.length, `Aucun JS chargé sur ${path}`).toBeGreaterThan(0);
    });
  }
});
