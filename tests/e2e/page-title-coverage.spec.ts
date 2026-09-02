import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/prospects', '/emails', '/people', '/taches', '/calendrier', '/tresorerie'];

for (const route of routes) {
  test(`page title set on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(2);
    expect(title).not.toBe('Vite + React + TS');
  });
}
