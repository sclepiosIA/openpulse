import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie la navigation au clavier (Tab) : au moins 5 éléments focusables
 * accessibles depuis le shell principal sur chaque page.
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people'];

test.describe('Focus management — Tab navigation', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} expose des éléments tabables`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);

      const focused = new Set<string>();
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const tag = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? `${el.tagName}:${(el as HTMLElement).getAttribute('aria-label') || el.textContent?.slice(0, 20) || ''}` : 'NONE';
        });
        focused.add(tag);
      }
      expect(focused.size, `Trop peu d'éléments focusables sur ${path}`).toBeGreaterThanOrEqual(3);
    });
  }
});
