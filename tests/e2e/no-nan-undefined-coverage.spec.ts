import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/emails', '/people', '/taches', '/calendrier', '/tresorerie', '/parametres'];

for (const route of routes) {
  test(`no NaN / undefined leak on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1200);
    const leaked = await page.evaluate(() => {
      const t = document.getElementById('main-content')?.innerText || '';
      return /\bNaN\b|\bundefined\b|\[object Object\]/.test(t);
    });
    expect(leaked).toBe(false);
  });
}
