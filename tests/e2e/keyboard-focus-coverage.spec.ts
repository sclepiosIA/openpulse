import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/prospects', '/emails', '/people', '/taches'];

for (const route of routes) {
  test(`keyboard focus reachable on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => document.activeElement?.tagName || '');
    expect(active).not.toBe('BODY');
  });
}
