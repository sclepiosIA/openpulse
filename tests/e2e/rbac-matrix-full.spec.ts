import { test, expect } from '@playwright/test';
import { isRbacMatrixEnabled, loginAsRole, Role } from './helpers/multi-role';

/**
 * Matrice RBAC complète — activée uniquement avec RUN_RBAC_MATRIX=true
 * et les comptes E2E_<ROLE>_EMAIL / E2E_<ROLE>_PASSWORD configurés.
 *
 * Vérifie qu'un rôle non-admin se voit refuser l'accès aux routes admin
 * strictes (écran "Accès refusé" ou redirect /auth).
 */

const STRICT_ADMIN_ROUTES = [
  '/gestion-utilisateurs',
  '/configuration-systeme',
  '/gestion-base-donnees',
  '/gestion-securite',
  '/logs-systeme',
  '/parametres/configuration',
  '/parametres/monitor',
  '/api-developer',
  '/rgpd',
];

const NON_ADMIN_ROLES: Role[] = ['csm', 'commercial', 'rh', 'manager', 'user'];

test.describe('RBAC matrix — rôles non-admin bloqués sur routes admin strictes', () => {
  test.skip(!isRbacMatrixEnabled(), 'RUN_RBAC_MATRIX != true');

  for (const role of NON_ADMIN_ROLES) {
    for (const route of STRICT_ADMIN_ROUTES) {
      test(`${role} bloqué sur ${route}`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: undefined });
        const page = await loginAsRole(ctx, role);
        if (!page) {
          test.skip(true, `Credentials manquants pour le rôle ${role}`);
          await ctx.close();
          return;
        }
        await page.goto(route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        const onAuth = /\/auth\b/.test(page.url());
        const denied = await page
          .locator('text=/Accès refusé|Connexion requise/i')
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        expect(
          onAuth || denied,
          `${role} a atteint ${route} sans blocage (url=${page.url()})`
        ).toBe(true);
        await ctx.close();
      });
    }
  }
});
