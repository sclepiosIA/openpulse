import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/emails', '/people', '/taches'];

for (const route of routes) {
  test(`escape closes any open dialog on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
    const openDialogs = await page.locator('[role="dialog"][data-state="open"]').count();
    expect(openDialogs).toBe(0);
  });
}
