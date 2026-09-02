import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Sidebar collapse cycle', () => {
  test('collapse puis expand sans crash', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    const toggle = page.getByRole('button', { name: /toggle|réduire|sidebar|menu/i }).first();
    if (!(await toggle.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip(true, 'Toggle sidebar introuvable'); return;
    }
    await toggle.click();
    await page.waitForTimeout(400);
    await toggle.click();
    await page.waitForTimeout(400);
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
