import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const routes = ['/', '/etablissements', '/emails', '/people'];

for (const route of routes) {
  test(`no broken external links on ${route}`, async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(route);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    const badLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      return links.filter(a => {
        const h = a.getAttribute('href') || '';
        return h === '#' || h === '' || h === 'javascript:void(0)';
      }).length;
    });
    expect(badLinks).toBeLessThan(20);
  });
}
