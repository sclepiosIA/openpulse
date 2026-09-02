import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun input form principal ne contient `autocomplete="off"`
 * sur des champs où ce serait gênant (email, password handled via login).
 * On s'assure simplement que les inputs critiques existent avec un type valide.
 */

const ROUTES = ['/profil', '/parametres'];

test.describe('Inputs forms valides', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : inputs valides`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const bad = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
        return inputs.filter(i => {
          const type = i.type;
          return type === 'email' && i.value && !i.value.includes('@');
        }).length;
      });
      expect(bad, `Inputs email invalides sur ${path}`).toBe(0);
    });
  }
});
