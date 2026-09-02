import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie le ScrollToTop : changer de route remet le scroll en haut.
 */

test.describe('Scroll to top on navigation', () => {
  test('scroll restauré au top après changement de route', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/etablissements', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    await page.goto('/emails', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);
    const y = await page.evaluate(() => window.scrollY);
    expect(y, `Scroll non remis au top après navigation : ${y}px`).toBeLessThanOrEqual(50);
  });
});
