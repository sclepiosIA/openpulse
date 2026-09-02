import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Smoke E2E — couverture large : on visite l'ensemble des routes
 * applicatives majeures (≈50 pages) et on vérifie pour chacune :
 *   1. Le shell `#main-content` est rendu (pas de crash écran blanc).
 *   2. Aucun ErrorBoundary visible (« Une erreur est survenue », « Oops »).
 *   3. Aucune 404 (« Page introuvable », « 404 »).
 *   4. Aucun « Accès refusé » pour l'admin connecté.
 *
 * Ces tests ne valident pas le contenu métier — c'est le rôle des specs
 * dédiées (calendrier, emails, tresorerie, …). L'objectif ici est
 * d'attraper les régressions de route / lazy-loading / boot des pages.
 *
 * Routes dérivées de `src/routes/groups/*` (Finance, Admin, Sales, RH,
 * Productivity, Recruitment, Social, Reporting, Email, Forms) — couvre
 * la majorité de l'app que les audits browser-use v3-azure visitent.
 */

type Route = { path: string; label: string };

const SMOKE_ROUTES: Route[] = [
  // Dashboard & cockpit
  { path: '/', label: 'Dashboard' },
  { path: '/activite', label: 'Activity Feed' },
  { path: '/parametres/monitor', label: 'Marque Monitor' },
  { path: '/parametres/ia-usage', label: 'AI Usage Dashboard' },

  // CRM & ventes
  { path: '/etablissements', label: 'Établissements' },
  { path: '/groupes', label: 'Groupes' },
  { path: '/partenaires', label: 'Partenaires' },
  { path: '/prospects', label: 'Prospects' },
  { path: '/prospects/scoring', label: 'Scoring prospects' },
  { path: '/deploiement', label: 'Déploiement' },
  { path: '/production', label: 'Production' },
  { path: '/analyse-geographique', label: 'Analyse géographique' },
  { path: '/attribution', label: 'Attribution V2' },
  { path: '/catalogue-produits', label: 'Catalogue produits' },
  { path: '/simulateur-roi', label: 'Simulateur ROI' },

  // Finance
  { path: '/tresorerie', label: 'Trésorerie' },
  { path: '/facturation', label: 'Facturation' },
  { path: '/contrats', label: 'Contrats' },
  { path: '/forecasting', label: 'Forecasting' },
  { path: '/churn', label: 'Churn Predictor' },

  // Automatisations
  { path: '/automatisations', label: 'Automatisations' },
  { path: '/automatisations/sante', label: 'Santé automatisations' },
  { path: '/automatisations/runs', label: 'Runs automatisations' },
  { path: '/automatisations/webhooks-alertes', label: 'Webhooks automatisations' },

  // Reporting
  { path: '/rapports', label: 'Rapports' },
  { path: '/rapports-custom', label: 'Rapports custom' },

  // Productivité
  { path: '/calendrier', label: 'Calendrier' },
  { path: '/taches', label: 'Tâches' },
  { path: '/pulse', label: 'Pulse' },
  { path: '/documents', label: 'Documents' },
  { path: '/appels', label: 'Appels' },
  { path: '/meeting-notes', label: 'Meeting notes' },

  // Email
  { path: '/emails', label: 'Emails' },
  { path: '/email-analytics', label: 'Email Analytics' },
  { path: '/email-classification-analytics', label: 'Email Classification' },
  { path: '/email-templates', label: 'Email Templates' },

  // RH & équipe
  { path: '/people', label: 'People' },
  { path: '/equipe', label: 'Équipe' },
  { path: '/competences', label: 'Compétences' },
  { path: '/recrutement', label: 'Recrutement' },

  // R&D / produit
  { path: '/rd', label: 'R&D' },
  { path: '/gantt', label: 'Gantt' },
  { path: '/projets', label: 'Projets' },

  // Social
  { path: '/social', label: 'Social Dashboard' },
  { path: '/social/composer', label: 'Social Composer' },
  { path: '/social/calendrier', label: 'Social Calendar' },
  { path: '/social/inbox', label: 'Social Inbox' },

  // Support & ressources
  { path: '/support', label: 'Support' },
  { path: '/base-connaissances', label: 'Base de connaissances' },
  { path: '/tutoriels', label: 'Tutoriels' },
  { path: '/formulaires', label: 'Formulaires' },

  // Paramètres
  { path: '/parametres', label: 'Paramètres' },
  { path: '/parametres/feedbacks', label: 'Feedbacks' },
  { path: '/parametres/templates-taches', label: 'Templates tâches' },
  { path: '/parametres/visioconference', label: 'Paramètres visio' },
  { path: '/parametres/webdav', label: 'Paramètres WebDAV' },
  { path: '/parametres/social', label: 'Paramètres social' },
  { path: '/parametres/configuration', label: 'Configuration' },

  // Admin
  { path: '/gestion-utilisateurs', label: 'Gestion utilisateurs' },
  { path: '/gestion-securite', label: 'Gestion sécurité' },
  { path: '/gestion-notifications', label: 'Gestion notifications' },
  { path: '/gestion-email-domains', label: 'Email domains' },
  { path: '/gestion-base-donnees', label: 'Base de données' },
  { path: '/configuration-systeme', label: 'Config système' },
  { path: '/logs-systeme', label: 'Logs système' },
  { path: '/rgpd', label: 'RGPD' },
  { path: '/api-developer', label: 'API Developer' },

  // Profil
  { path: '/profil', label: 'Profil' },
];

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;
const NOT_FOUND_RE = /page introuvable|404|n'existe pas/i;

test.describe('Smoke E2E — couverture large des routes admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { path, label } of SMOKE_ROUTES) {
    test(`${label} (${path}) se charge sans crash`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Le serveur statique sert l'index.html (SPA) → status 200 attendu.
      if (response && response.status() >= 500) {
        throw new Error(`HTTP ${response.status()} sur ${path}`);
      }

      await page.waitForLoadState('networkidle').catch(() => {
        /* tolère un timeout réseau : on vérifie ensuite le DOM. */
      });

      // 1) Shell applicatif rendu.
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      // 2) Pas d'ErrorBoundary.
      const boundary = page.getByText(ERROR_BOUNDARY_RE).first();
      await expect(boundary).toHaveCount(0);

      // 3) Pas de 404 / page introuvable.
      const notFound = page.getByText(NOT_FOUND_RE).first();
      await expect(notFound).toHaveCount(0);

      // 4) Pas d'écran d'Accès refusé pour l'admin.
      const denied = page.getByText(/accès refusé/i).first();
      await expect(denied).toHaveCount(0);

      // 5) Aucune erreur JS non capturée.
      expect(consoleErrors, `Erreurs runtime sur ${path}:\n${consoleErrors.join('\n')}`).toHaveLength(0);
    });
  }
});
