import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/etablissements', '/emails', '/people', '/taches', '/calendrier'];

for (const route of routes) {
  test(`loading then settled on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    const spinners = await page.locator('[role="status"], .animate-spin').count();
    expect(spinners).toBeLessThan(10);
  });
}
