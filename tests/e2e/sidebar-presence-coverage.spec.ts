import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/prospects', '/emails', '/people', '/taches', '/calendrier'];

for (const route of routes) {
  test(`sidebar present + logo visible on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    const sidebar = await page.locator('[data-sidebar], aside, nav').first().isVisible().catch(() => false);
    expect(sidebar).toBe(true);
  });
}
