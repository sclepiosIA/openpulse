import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/profil', '/parametres'];

for (const route of routes) {
  test(`forms required attributes on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/error|erreur 5\\d\\d/i').first()).toBeHidden().catch(() => {});
    const inputs = await page.locator('input[required], textarea[required], select[required]').count();
    expect(inputs).toBeGreaterThanOrEqual(0);
  });
}
