import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucune erreur console (level=error) sérieuse n'apparaît au
 * chargement des pages principales. Filtre les bruits connus.
 */

const IGNORE = [
  /favicon/i,
  /ResizeObserver/i,
  /sourcemap/i,
  /Failed to load resource.*404/i,
  /web-vitals/i,
  /\[vite\]/i,
  /chrome-extension/i,
];

const ROUTES = ['/', '/etablissements', '/emails', '/people', '/parametres'];

test.describe('Console errors silence', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} sans erreur console critique`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (IGNORE.some(rx => rx.test(text))) return;
        errors.push(text);
      });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1500);
      expect(errors, `Erreurs console sur ${path} :\n${errors.join('\n')}`).toHaveLength(0);
    });
  }
});
