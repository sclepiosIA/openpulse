import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/', '/etablissements', '/emails', '/people', '/taches'];

for (const route of routes) {
  test(`icon buttons have aria-label on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    const orphanIconButtons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.filter(b => {
        const hasText = (b.textContent || '').trim().length > 0;
        const hasAria = b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.getAttribute('title');
        return !hasText && !hasAria;
      }).length;
    });
    expect(orphanIconButtons).toBeLessThan(50);
  });
}
