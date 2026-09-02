import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// `/taches` redirige vers `/todos` (cf. DiversRoutes) : l'historique retient
// la destination, pas l'alias — l'assertion sur l'URL ne pouvait pas passer.
const routes = ['/etablissements', '/prospects', '/emails', '/people', '/todos'];

for (const route of routes) {
  test(`back/forward navigation on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.goBack();
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.goForward();
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    expect(page.url()).toContain(route);
  });
}
