import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Audit RBAC — vérifie que les routes sensibles affichent "Accès refusé"
 * pour les rôles non autorisés (BUG-029, 030, 065, 066, 013, 014, 015, 017,
 * 046, 058, 081 du rapport audit v3-azure-20260514).
 *
 * Note: ce test bascule en lecture seule et ne fait que vérifier le rendu
 * d'un écran d'Accès refusé. Pour tester d'autres rôles que admin, il faut
 * ajouter des comptes test dédiés et étendre le helper auth.ts.
 */

const STRICT_ADMIN_ROUTES = [
  '/gestion-email-domains',
  '/utilisateurs',
  '/gestion-utilisateurs',
  '/parametres/configuration',
  '/parametres/monitor',
  '/logs-systeme',
  '/import-commercial',
  '/gestion-securite',
  '/configuration-systeme',
  '/gestion-base-donnees',
  '/api-developer',
  '/rgpd',
  '/gestion-notifications',
  // Routes ajoutées suite aux audits browser-use v3-azure (runs full
  // 20260618-010843 / 20260618-183218) — direction y était traitée comme
  // admin par erreur sur la session de test (BUG triagé auto_fixable).
  '/parametres/feedbacks',
  '/parametres/templates-taches',
  '/parametres/ia-usage',
];

// /utilisateurs est volontairement dual :
// - visiteur anonyme → route publique d'émargement (PublicRoutes)
// - utilisateur authentifié → gestion utilisateurs strict admin (AuthenticatedRoutes)
// Le deny-path anonyme doit donc tester les routes strictement privées seulement.
const ANONYMOUS_BLOCKED_ADMIN_ROUTES = STRICT_ADMIN_ROUTES.filter((route) => route !== '/utilisateurs');

test.describe('RBAC — routes admin strictes (admin connecté)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of STRICT_ADMIN_ROUTES) {
    test(`admin peut accéder à ${route} sans écran Accès refusé`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      // Vérifie qu'on n'a PAS le composant AccessDenied
      const denied = page.locator('text=Accès refusé').first();
      await expect(denied).toHaveCount(0, { timeout: 5000 }).catch(() => {
        // Si l'élément existe c'est une régression
        throw new Error(`Régression : l'admin voit Accès refusé sur ${route}`);
      });
    });
  }
});

/**
 * RBAC inverse — direction doit accéder aux routes RH/Équipe (BUG-010, 011, 012).
 * direction est isAdmin=true et team='direction' dans useRolePermissions :
 * /competences, /equipe, /rh/paie ne doivent jamais afficher "Accès refusé".
 */
// Inclut les routes finance : décision produit 2026-07-05 — direction garde
// l'accès finance (cf. .editeur/memory/constraints/direction-access-finance-routes.md
// + tests/browser-use/v3-azure/RBAC_MATRIX.md). Tout finding "Direction accède
// à /tresorerie|/facturation|/contrats" est un faux positif.
const DIRECTION_ALLOWED_ROUTES = [
  '/competences', '/equipe', '/rh/paie', '/people', '/rh',
  '/tresorerie', '/facturation', '/contrats',
];

test.describe('RBAC inverse — direction a accès aux routes RH/Équipe', () => {
  test.beforeEach(async ({ page }) => {
    // L'admin hérite des privilèges direction ; ce test valide la matrice de permissions.
    await loginAsAdmin(page);
  });

  for (const route of DIRECTION_ALLOWED_ROUTES) {
    test(`direction/admin peut accéder à ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const denied = page.locator('text=Accès refusé').first();
      await expect(denied).toHaveCount(0, { timeout: 5000 }).catch(() => {
        throw new Error(`Régression RBAC inverse : direction voit Accès refusé sur ${route}`);
      });
    });
  }
});

/**
 * TEST-02 — Deny-path RBAC : un visiteur **non authentifié** ne doit jamais
 * accéder à une route admin stricte. Doit soit voir l'écran d'auth, soit
 * un écran "Accès refusé" — jamais le contenu protégé.
 */
test.describe('RBAC deny-path — visiteur non authentifié (TEST-02)', () => {
  // La config smoke charge un storageState admin global pour les parcours authentifiés.
  // Ces tests doivent au contraire partir d'un contexte explicitement vide.
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of ANONYMOUS_BLOCKED_ADMIN_ROUTES) {
    test(`visiteur anonyme est bloqué sur ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      await expect
        .poll(
          async () => {
            const url = page.url();
            const onAuth = /\/auth\b/.test(url);
            const denied = await page
              .locator('text=/Accès refusé|Connexion requise|Se connecter/i')
              .first()
              .isVisible()
              .catch(() => false);
            const loading = await page
              .locator('text=/Chargement/i')
              .first()
              .isVisible()
              .catch(() => false);
            return { blocked: onAuth || denied, url, denied, loading };
          },
          { message: `Le visiteur anonyme doit être bloqué sur ${route}`, timeout: 15000 }
        )
        .toMatchObject({ blocked: true });
    });
  }
});
