import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des paramètres / administration : on visite chaque sous-route
 * `/parametres/*` et on vérifie qu'aucune n'écran-blanche ni ne renvoie
 * un faux « Accès refusé » pour un admin connecté.
 *
 * ⚠️ Historique : cette liste décrivait une arborescence `/parametres/*`
 * (utilisateurs, roles, securite, audit, branding, integrations, app-config,
 * reference-data, workflows…) dont 13 entrées sur 16 n'ont JAMAIS été
 * déclarées dans le routeur (`src/routes/groups/`). Le test visitait donc la
 * page 404 et échouait sur son propre garde-fou « page introuvable ».
 * Les fonctionnalités correspondantes existent, mais à la racine :
 * `/gestion-utilisateurs`, `/gestion-securite`, `/gestion-notifications`…
 *
 * La liste ci-dessous est alignée 1:1 sur les routes réellement déclarées
 * (vérifié le 2026-08-15). Toute nouvelle page d'administration doit y être
 * ajoutée en même temps que sa `<Route>`.
 */

const SETTINGS_ROUTES: { path: string; label: string }[] = [
  { path: '/parametres', label: 'Paramètres' },
  { path: '/parametres/configuration', label: 'Configuration' },
  { path: '/parametres/feedbacks', label: 'Feedbacks' },
  { path: '/parametres/ia-usage', label: 'IA Usage' },
  { path: '/parametres/monitor', label: 'Monitor' },
  { path: '/parametres/platform-api', label: 'Platform API' },
  { path: '/parametres/portail-client', label: 'Portail client' },
  { path: '/parametres/social', label: 'Social' },
  { path: '/parametres/templates-taches', label: 'Templates tâches' },
  { path: '/parametres/visioconference', label: 'Visioconférence' },
  { path: '/parametres/webdav', label: 'WebDAV' },
  // Administration hors arborescence /parametres.
  { path: '/gestion-utilisateurs', label: 'Utilisateurs' },
  { path: '/gestion-securite', label: 'Sécurité' },
  { path: '/gestion-notifications', label: 'Notifications' },
  { path: '/gestion-base-donnees', label: 'Base de données' },
  { path: '/gestion-email-domains', label: 'Domaines email' },
];

test.describe('Paramètres — couverture admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const r of SETTINGS_ROUTES) {
    test(`${r.path} — ${r.label} se charge`, async ({ page }) => {
      const resp = await page.goto(r.path, { waitUntil: 'domcontentloaded' });
      // Soit 200, soit pas de réponse explicite (SPA fallback) — on ne hard-fail pas.
      if (resp && resp.status() >= 500) {
        throw new Error(`HTTP ${resp.status()} sur ${r.path}`);
      }
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/une erreur est survenue|oops|something went wrong/i)).toHaveCount(0);
      await expect(page.getByText(/page introuvable|^404$/i)).toHaveCount(0);
    });
  }
});
