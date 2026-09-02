import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Vérifie que la connexion Supabase Realtime s'établit sans erreur fatale
 * sur les pages utilisant la subscription (Pulse, Notifications).
 */

const ROUTES = ['/notifications'];

test.describe('Supabase Realtime', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const path of ROUTES) {
    test(`${path} : pas d'erreur WS Supabase`, async ({ page }) => {
      const wsErrors: string[] = [];
      page.on('websocket', ws => {
        ws.on('socketerror', err => wsErrors.push(String(err)));
      });
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(3000);
      expect(wsErrors, `WS errors sur ${path}: ${wsErrors.join(', ')}`).toHaveLength(0);
    });
  }
});
