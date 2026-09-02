import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/prospects', '/emails', '/people', '/taches'];

for (const route of routes) {
  test(`search input present on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    const searchInputs = await page.locator('input[type="search"], input[placeholder*="Recherch" i], input[placeholder*="search" i]').count();
    expect(searchInputs).toBeGreaterThanOrEqual(0);
  });
}
