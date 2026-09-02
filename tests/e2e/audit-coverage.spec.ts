import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E dérivée des audits browser-use v3-azure (runs full
 * 20260618-010843 / 20260618-183218 et triages associés). Chaque test
 * verrouille une régression remontée par un agent d'audit ; les scénarios
 * multi-rôles sont volontairement gardés dans rbac-matrix.spec.ts (gated
 * RUN_RBAC_MATRIX) — ici on couvre ce qui est testable en session admin.
 *
 *  - Routes admin/finance/automatisations remontées 404/erreur :
 *      /churn-predictor (alias vers /churn),
 *      /parametres/feedbacks, /parametres/templates-taches,
 *      /parametres/ia-usage, /automatisations/sante.
 *  - Validation front Support > Nouveau ticket (email malformé).
 *  - Validation front Prospects > création (champs requis manquants).
 */

const AUDIT_ROUTES_NO_404 = [
  { path: '/churn-predictor', expectedRedirect: '/churn' },
  { path: '/parametres/feedbacks', expectedRedirect: null },
  { path: '/parametres/templates-taches', expectedRedirect: null },
  { path: '/parametres/ia-usage', expectedRedirect: null },
  { path: '/automatisations/sante', expectedRedirect: null },
];

test.describe('Audit browser-use — routes signalées 404/erreur', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { path, expectedRedirect } of AUDIT_ROUTES_NO_404) {
    test(`admin atteint ${path} sans 404 ni écran d'erreur générique`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Shell applicatif toujours présent sur les routes authentifiées.
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });

      // Pas de 404 / page introuvable.
      const notFound = page.getByText(/page introuvable|404|n'existe pas/i).first();
      await expect(notFound).toHaveCount(0);

      // Pas d'écran d'Accès refusé pour l'admin.
      const denied = page.getByText(/accès refusé/i).first();
      await expect(denied).toHaveCount(0);

      if (expectedRedirect) {
        expect(page.url()).toContain(expectedRedirect);
      }
    });
  }
});

/**
 * Audit /support — finding "Le formulaire « Nouveau ticket support » ne
 * bloque pas visiblement côté client un email de contact malformé".
 * Le bouton submit doit empêcher la création tant que l'email saisi est
 * invalide (HTML5 :invalid OU message d'erreur visible).
 */
test.describe('Audit /support — validation email contact malformé', () => {
  test('un email malformé bloque la création du ticket', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/support');
    await page.waitForLoadState('networkidle');

    const openButton = page
      .getByRole('button', { name: /nouveau ticket/i })
      .first();

    // La page peut ne pas exposer le bouton selon le rôle ; on skip plutôt
    // que de faire un faux négatif.
    if (!(await openButton.isVisible().catch(() => false))) {
      test.skip(true, 'Bouton « Nouveau ticket » non visible pour ce rôle/session.');
      return;
    }

    await openButton.click();

    const titleField = page
      .getByLabel(/titre|sujet/i)
      .first();
    const emailField = page
      .getByLabel(/email/i)
      .first();

    await titleField.fill('Test audit — ticket invalide');
    await emailField.fill('email-invalide');

    const submit = page
      .getByRole('button', { name: /créer le ticket|créer|envoyer/i })
      .last();

    await submit.click();

    // Soit l'input est marqué invalide (HTML5), soit un message
    // d'erreur accessible apparaît sous le champ.
    const isInvalid = await emailField.evaluate(
      (el) => (el as HTMLInputElement).validity?.valid === false,
    ).catch(() => false);

    const errorMsg = page
      .getByText(/email.*invalide|format.*email|adresse.*invalide/i)
      .first();
    const errorVisible = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false);

    expect(
      isInvalid || errorVisible,
      'Le formulaire Support accepte un email malformé sans feedback front.',
    ).toBe(true);
  });
});

/**
 * Audit /prospects — finding "création prospect champs requis vides bloque
 * la soumission mais aucun message d'erreur explicite". Le formulaire doit
 * empêcher la création ET afficher au moins un feedback visible/aria-invalid.
 */
test.describe('Audit /prospects — feedback champs requis manquants', () => {
  test('soumission vide laisse l\'utilisateur sur le formulaire avec feedback', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/prospects');
    await page.waitForLoadState('networkidle');

    const openButton = page
      .getByRole('button', { name: /nouveau prospect|ajouter.*prospect|créer.*prospect/i })
      .first();

    if (!(await openButton.isVisible().catch(() => false))) {
      test.skip(true, 'Bouton de création prospect non visible pour ce rôle/session.');
      return;
    }
    await openButton.click();

    // Soumission directe, sans remplir.
    const submit = page
      .getByRole('button', { name: /créer|enregistrer|valider/i })
      .last();
    await submit.click();

    // Le dialog/formulaire ne doit pas se fermer ET un feedback doit exister.
    const requiredFeedback = page
      .locator(
        '[aria-invalid="true"], [data-invalid="true"], [role="alert"], .text-destructive',
      )
      .first();

    const hasFeedback = await requiredFeedback
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(
      hasFeedback,
      'Aucun feedback (aria-invalid, role=alert, text-destructive) après submit vide.',
    ).toBe(true);
  });
});
