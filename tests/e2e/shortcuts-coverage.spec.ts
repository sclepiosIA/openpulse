import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des raccourcis clavier globaux (Cmd/Ctrl+K palette, ?, g+d, etc.).
 * On ne valide pas un contenu précis : on s'assure que les raccourcis ne crashent
 * pas et qu'aucun ErrorBoundary n'apparaît après usage.
 */

const SHORTCUTS: Array<{ name: string; combo: string }> = [
  { name: 'Palette globale Ctrl+K', combo: 'Control+k' },
  { name: 'Palette globale Meta+K', combo: 'Meta+k' },
  { name: 'Aide ?', combo: '?' },
  { name: 'Echap', combo: 'Escape' },
];

test.describe('Raccourcis clavier globaux', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  for (const s of SHORTCUTS) {
    test(`${s.name} ne crash pas`, async ({ page }) => {
      await page.keyboard.press(s.combo);
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape').catch(() => {});
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      await expect(page.locator('#main-content')).toBeVisible();
    });
  }
});
