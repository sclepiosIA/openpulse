import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/emails', '/people', '/taches', '/parametres'];

for (const route of routes) {
  test(`viewport meta + favicon on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    const viewport = await page.locator('meta[name="viewport"]').count();
    expect(viewport).toBeGreaterThan(0);
    const favicon = await page.locator('link[rel*="icon"]').count();
    expect(favicon).toBeGreaterThan(0);
  });
}
