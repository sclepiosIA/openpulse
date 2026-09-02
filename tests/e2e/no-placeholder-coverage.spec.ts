import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune page principale n'expose de texte de debug
 * (placeholder Lorem, TODO, FIXME, "Mock", "fake").
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/tresorerie', '/taches', '/parametres'];
const FORBIDDEN = /\b(lorem ipsum|TODO|FIXME|placeholder text|mock data|fake data)\b/i;

test.describe('Pas de contenu placeholder/debug', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} sans placeholder visible`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const text = await page.locator('#main-content').innerText();
      const match = text.match(FORBIDDEN);
      expect(match, `Placeholder détecté sur ${path} : ${match?.[0]}`).toBeNull();
    });
  }
});
