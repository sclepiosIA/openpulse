import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie qu'aucun appel Supabase ne retourne 401/403 pour l'admin
 * (signal d'une RLS mal écrite ou d'un token expiré).
 */

const ROUTES = ['/etablissements', '/prospects', '/emails', '/people', '/parametres'];

test.describe('Pas de 401/403 Supabase pour admin', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : aucun 401/403 Supabase`, async ({ page }) => {
      const failures: string[] = [];
      page.on('response', resp => {
        const url = resp.url();
        if (!/supabase\.co\/(rest|functions)\/v1/.test(url)) return;
        if (resp.status() === 401 || resp.status() === 403) {
          failures.push(`${resp.status()} ${url}`);
        }
      });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);
      expect(failures, `401/403 sur ${path} :\n${failures.join('\n')}`).toHaveLength(0);
    });
  }
});
