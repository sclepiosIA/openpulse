import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les boutons destructifs (Supprimer/Archiver) ouvrent un dialog
 * de confirmation au lieu d'agir directement (sécurité UX).
 */

const ROUTES = ['/etablissements', '/prospects', '/taches'];

test.describe('Confirmation destructive', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : Supprimer ouvre une confirmation`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      const del = page.getByRole('button', { name: /^supprimer$|^archiver$|^delete$/i }).first();
      if (!(await del.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, `Pas de bouton destructif sur ${path}`); return;
      }
      await del.click();
      await page.waitForTimeout(500);
      const confirm = page.locator('[role="alertdialog"], [role="dialog"]').first();
      expect(await confirm.isVisible({ timeout: 2000 }).catch(() => false), 'Pas de dialog de confirmation').toBe(true);
      await page.keyboard.press('Escape');
    });
  }
});
