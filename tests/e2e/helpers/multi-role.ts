import { Page, BrowserContext, expect } from '@playwright/test';
import { authLocators } from './auth';

/**
 * Helper multi-rôles E2E. Permet d'ouvrir un context dédié pour un rôle
 * autre qu'admin (csm, commercial, rh, manager, user).
 *
 * Activation : définir `RUN_RBAC_MATRIX=true` ET les comptes correspondants :
 *   E2E_CSM_EMAIL / E2E_CSM_PASSWORD
 *   E2E_COMMERCIAL_EMAIL / E2E_COMMERCIAL_PASSWORD
 *   E2E_RH_EMAIL / E2E_RH_PASSWORD
 *   E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD
 *   E2E_USER_EMAIL / E2E_USER_PASSWORD
 *
 * Si la variable est absente, le test appelant doit `test.skip()`.
 */

export type Role = 'admin' | 'csm' | 'commercial' | 'rh' | 'manager' | 'user';

export function roleCreds(role: Role): { email: string; password: string } | null {
  if (role === 'admin') {
    const password =
      process.env.E2E_ADMIN_PASSWORD ||
      process.env.E2E_PASSWORD ||
      process.env.TEST_ACCOUNTS_PASSWORD;
    if (!password) return null;

    return {
      email: process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'test-admin@exploitant.example.org',
      password,
    };
  }
  const KEY = role.toUpperCase();
  const email = process.env[`E2E_${KEY}_EMAIL`];
  const password = process.env[`E2E_${KEY}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

export function isRbacMatrixEnabled(): boolean {
  return process.env.RUN_RBAC_MATRIX === 'true' || process.env.RUN_RBAC_MATRIX === '1';
}

/**
 * Connecte un context anonyme avec les identifiants du rôle demandé.
 * Renvoie `null` si les creds sont absents (le test appelant doit skip).
 */
export async function loginAsRole(context: BrowserContext, role: Role): Promise<Page | null> {
  const creds = roleCreds(role);
  if (!creds) return null;
  const page = await context.newPage();
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await authLocators.emailField(page).fill(creds.email);
  await authLocators.passwordField(page).fill(creds.password);
  await authLocators.submitButton(page).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 });
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  return page;
}
