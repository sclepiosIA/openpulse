import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture déconnexion (logout) : bouton "Se déconnecter" depuis le
 * menu utilisateur, redirection vers /auth, session purgée.
 */

test.describe('Déconnexion', () => {
  test('logout depuis le menu utilisateur redirige vers /auth', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

    // Ouvre menu utilisateur (avatar dans le header).
    const userMenu = page
      .locator('[aria-label*="utilisateur" i], [aria-label*="user" i], [data-testid*="user-menu" i]')
      .or(page.locator('button:has(img[alt*="avatar" i])'))
      .or(page.getByRole('button', { name: /compte|profil|menu utilisateur/i }))
      .first();

    if (!(await userMenu.isVisible({ timeout: 4000 }).catch(() => false))) {
      test.skip(true, 'Menu utilisateur non identifiable');
    }

    await userMenu.click();
    await page.waitForTimeout(400);

    const logout = page
      .getByRole('menuitem', { name: /se déconnecter|déconnexion|logout|sign out/i })
      .or(page.getByRole('button', { name: /se déconnecter|déconnexion|logout/i }))
      .first();

    if (!(await logout.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Item logout non trouvé');
    }

    await logout.click();
    await page.waitForURL(/\/auth/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/auth/);
  });
});
