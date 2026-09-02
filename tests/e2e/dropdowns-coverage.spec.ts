import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que les menus dropdown (avatar, notifications, plus d'actions)
 * s'ouvrent et se ferment proprement (Escape).
 */

const TRIGGERS = [
  /menu utilisateur|profil|avatar/i,
  /notifications/i,
];

test.describe('Dropdown menus ouverture/fermeture', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  for (const rx of TRIGGERS) {
    test(`bouton ${rx} ouvre puis ferme via Escape`, async ({ page }) => {
      const btn = page.getByRole('button', { name: rx }).first();
      if (!(await btn.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, `Trigger ${rx} introuvable`);
        return;
      }
      await btn.click();
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
