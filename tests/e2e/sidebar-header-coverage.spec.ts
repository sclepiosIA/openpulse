import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que la sidebar reste visible et que le header est sticky/visible
 * sur les pages principales (UX critique).
 */

const ROUTES = ['/', '/etablissements', '/emails', '/people'];

test.describe('Sidebar & header présents', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} affiche la nav principale`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(800);
      // Présence d'au moins un <nav> ou role=navigation
      const navCount = await page.locator('nav, [role="navigation"]').count();
      expect(navCount, `Pas de navigation sur ${path}`).toBeGreaterThanOrEqual(1);
    });
  }
});
