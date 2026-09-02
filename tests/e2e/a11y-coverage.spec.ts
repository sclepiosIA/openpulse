import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E accessibilité — axe-core scanne les pages majeures et
 * échoue sur toute violation `serious` ou `critical` selon WCAG 2.1 AA.
 *
 * Complète `tests/a11y/*` (unitaires/composants) en validant le rendu
 * réel des pages authentifiées avec données + interactions.
 *
 * On exclut volontairement certaines règles ultra-strictes (color-contrast
 * sur charts/badges shadcn dérivés) qui demanderaient une revue design
 * dédiée — à activer au fil du ratchet.
 */

const ROUTES_A11Y = [
  { path: '/', label: 'Dashboard' },
  { path: '/etablissements', label: 'Établissements' },
  { path: '/prospects', label: 'Prospects' },
  { path: '/emails', label: 'Emails' },
  { path: '/calendrier', label: 'Calendrier' },
  { path: '/taches', label: 'Tâches' },
  { path: '/pulse', label: 'Pulse' },
  { path: '/people', label: 'People' },
  { path: '/tresorerie', label: 'Trésorerie' },
  { path: '/facturation', label: 'Facturation' },
  { path: '/contrats', label: 'Contrats' },
  { path: '/support', label: 'Support' },
  { path: '/documents', label: 'Documents' },
  { path: '/automatisations', label: 'Automatisations' },
  { path: '/rapports-custom', label: 'Rapports custom' },
  { path: '/parametres', label: 'Paramètres' },
  { path: '/profil', label: 'Profil' },
];

async function scan(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // Règles désactivées temporairement (à traiter par ratchet design).
    .disableRules(['color-contrast', 'region', 'landmark-one-main'])
    .analyze();
}

// Pages avec forte activité réseau (Supabase realtime + multiples queries) où
// `networkidle` ne se résout jamais dans un délai raisonnable. On leur donne
// un budget plus large et on s'appuie sur un marqueur `data-page-ready`.
const HEAVY_ROUTES = new Set(['/prospects', '/emails', '/pulse', '/people']);

test.describe('Accessibilité E2E — axe-core sur pages majeures', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { path, label } of ROUTES_A11Y) {
    test(`${label} (${path}) — pas de violation serious/critical`, async ({
      page,
    }, testInfo) => {
      // Budget augmenté pour routes lourdes (data + axe scan).
      if (HEAVY_ROUTES.has(path)) {
        testInfo.setTimeout(60_000);
      }

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      // Attendre un état déterministe: soit la page expose `data-page-ready`,
      // soit on retombe sur un délai court si le marker n'existe pas encore
      // sur cette route (compatibilité progressive).
      await page
        .locator('[data-page-ready="true"]')
        .first()
        .waitFor({ state: 'attached', timeout: 20_000 })
        .catch(() => {});

      const results = await scan(page);

      const blockers = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );

      if (blockers.length > 0) {
        const summary = blockers
          .map(
            (v) =>
              `[${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} occ.)\n  → ${v.helpUrl}`,
          )
          .join('\n');
        throw new Error(
          `${blockers.length} violation(s) a11y sur ${path} :\n${summary}`,
        );
      }
    });
  }
});
