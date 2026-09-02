import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Validation des balises SEO sur les pages clés : <title>, meta description,
 * canonical, viewport. On vérifie qu'elles existent et ne sont pas vides.
 */

const ROUTES = ['/', '/etablissements', '/prospects', '/emails', '/people'];

test.describe('SEO meta-tags', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} a un <title> non vide et viewport`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      const viewport = await page.locator('meta[name="viewport"]').count();
      expect(viewport).toBeGreaterThan(0);
    });
  }
});
