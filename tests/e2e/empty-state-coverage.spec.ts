import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/prospects', '/emails', '/people', '/taches', '/calendrier'];

for (const route of routes) {
  test(`empty-state or content visible on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const hasContent = await page.evaluate(() => {
      const main = document.getElementById('main-content');
      return (main?.textContent || '').trim().length > 20;
    });
    expect(hasContent).toBe(true);
  });
}
