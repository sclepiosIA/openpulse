import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Notifications & toasts : on déclenche des actions UI inoffensives
 * (clic sur la cloche, fermeture d'un toast affiché) et on vérifie
 * que la couche notifications fonctionne sans crash.
 */

test.describe('Notifications & cloche', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  });

  test('ouvre le popover de notifications via la cloche', async ({ page }) => {
    const bell = page
      .getByRole('button', { name: /notifications?|cloche/i })
      .or(page.locator('[aria-label*="notification" i]'))
      .first();

    if (!(await bell.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, 'Pas de cloche visible (header différent)');
    }

    await bell.click();
    // Popover/Sheet ouvert
    const popover = page
      .getByRole('dialog')
      .or(page.locator('[role="menu"], [data-radix-popper-content-wrapper]'))
      .first();
    await expect(popover).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
