import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun bouton "submit" principal n'est désactivé indéfiniment
 * (signal d'un état loading bloqué).
 */

const ROUTES = ['/profil', '/parametres'];

test.describe('Boutons submit non bloqués', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : submit non bloqué initialement`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(2000);
      const submits = page.locator('button[type="submit"]');
      const count = await submits.count();
      if (count === 0) { test.skip(true, `Aucun submit sur ${path}`); return; }
      // On vérifie juste qu'au moins un submit n'est pas en aria-busy/disabled
      const anyEnabled = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button[type="submit"]'))
          .some(b => !(b as HTMLButtonElement).disabled && b.getAttribute('aria-busy') !== 'true');
      });
      expect(anyEnabled, `Tous les submit sont bloqués sur ${path}`).toBe(true);
    });
  }
});
