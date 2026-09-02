import { test, expect } from '@playwright/test';
import { isRbacMatrixEnabled, loginAsRole, Role } from './helpers/multi-role';

/**
 * Matrice RBAC positive — chaque rôle DOIT pouvoir accéder à ses pages
 * légitimes. Activée uniquement avec RUN_RBAC_MATRIX=true et creds par rôle.
 */

const ALLOWED: Record<Role, string[]> = {
  admin: ['/gestion-utilisateurs', '/parametres', '/'],
  csm: ['/', '/etablissements', '/emails', '/taches', '/notifications'],
  commercial: ['/', '/prospects', '/etablissements', '/emails', '/forecasting'],
  rh: ['/', '/people', '/rh/paie', '/rh/absences', '/competences'],
  manager: ['/', '/etablissements', '/people', '/tresorerie', '/rapports-custom'],
  user: ['/', '/profil', '/notifications', '/emails'],
};

const NON_ADMIN: Role[] = ['csm', 'commercial', 'rh', 'manager', 'user'];

test.describe('RBAC matrix — accès autorisés par rôle', () => {
  test.skip(!isRbacMatrixEnabled(), 'RUN_RBAC_MATRIX != true');

  for (const role of NON_ADMIN) {
    for (const route of ALLOWED[role]) {
      test(`${role} accède à ${route}`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: undefined });
        const page = await loginAsRole(ctx, role);
        if (!page) {
          test.skip(true, `Credentials manquants pour le rôle ${role}`);
          await ctx.close();
          return;
        }
        const resp = await page.goto(route, { waitUntil: 'domcontentloaded' }).catch(() => null);
        if (resp && resp.status() >= 500) throw new Error(`HTTP ${resp.status()} sur ${route}`);
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
        const denied = await page.locator('text=/Accès refusé/i').first().isVisible({ timeout: 2000 }).catch(() => false);
        expect(denied, `${role} voit "Accès refusé" sur ${route}`).toBe(false);
        await ctx.close();
      });
    }
  }
});
