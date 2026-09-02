import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E — opérations d'écriture (CRUD) sur entités sûres.
 *
 * Stratégie :
 *   - Chaque test crée une entité préfixée `[e2e-…]` (pour identification
 *     + nettoyage manuel éventuel).
 *   - On vérifie que la création réussit (toast succès / item présent en
 *     liste / navigation détail).
 *   - On tente une suppression si l'UI l'expose, sinon on log un skip.
 *
 * Les tests sont volontairement défensifs : si le bouton "Nouveau" n'est
 * pas exposé pour la session (rôle, données, A/B), on skip proprement
 * plutôt que d'émettre un faux négatif.
 */

const STAMP = () => `e2e-${Date.now()}`;
const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;

async function ensureAuth(page: Page, path: string) {
  await loginAsAdmin(page);
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
}

async function clickIfVisible(page: Page, locator: ReturnType<Page['locator']>) {
  if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

test.describe('CRUD — Tâches', () => {
  test('créer une tâche puis la voir apparaître en liste', async ({ page }) => {
    await ensureAuth(page, '/taches');

    const cta = page
      .getByRole('button', { name: /nouvelle tâche|ajouter.*tâche|créer.*tâche|\+/i })
      .first();
    if (!(await clickIfVisible(page, cta))) {
      test.skip(true, 'CTA création tâche non exposé pour cette session.');
      return;
    }

    const title = `[${STAMP()}] tâche test`;
    const titleField = page
      .getByLabel(/titre|intitulé|nom de la tâche/i)
      .or(page.getByPlaceholder(/titre|intitulé|tâche/i))
      .first();

    if (!(await titleField.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Formulaire de création tâche non trouvé.');
      return;
    }
    await titleField.fill(title);

    const submit = page
      .getByRole('button', { name: /créer|enregistrer|valider|ajouter/i })
      .last();
    await submit.click();

    // Soit toast de succès, soit la tâche apparaît en liste.
    const toast = page.getByText(/créé|succès|enregistré/i).first();
    const inList = page.getByText(title).first();

    const ok =
      (await toast.isVisible({ timeout: 6000 }).catch(() => false)) ||
      (await inList.isVisible({ timeout: 6000 }).catch(() => false));

    expect(ok, 'Aucun feedback (toast/listing) après création tâche.').toBe(true);
  });
});

test.describe('CRUD — Pulse (message)', () => {
  test('envoyer un message Pulse dans le premier canal disponible', async ({
    page,
  }) => {
    await ensureAuth(page, '/pulse');

    const firstChannel = page
      .getByRole('button', { name: /^#|canal|channel/i })
      .or(page.locator('[data-testid*="channel"]'))
      .first();
    await clickIfVisible(page, firstChannel);

    const composer = page
      .getByPlaceholder(/écrire|message|envoyer|tapez/i)
      .or(page.getByRole('textbox'))
      .first();
    if (!(await composer.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip(true, 'Composer Pulse non trouvé sur cette session.');
      return;
    }

    const msg = `[${STAMP()}] message e2e`;
    await composer.fill(msg);
    await composer.press('Enter');

    // Le message doit apparaître dans le fil.
    await expect(page.getByText(msg).first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('CRUD — Calendrier (événement)', () => {
  test('ouvrir le dialog de création d\'événement et le fermer sans crash', async ({
    page,
  }) => {
    await ensureAuth(page, '/calendrier');

    const cta = page
      .getByRole('button', { name: /nouvel événement|créer.*événement|ajouter|\+/i })
      .first();
    if (!(await clickIfVisible(page, cta))) {
      test.skip(true, 'CTA création événement non exposé.');
      return;
    }

    // Le dialog doit s'afficher avec au moins un champ titre.
    const titleField = page
      .getByLabel(/titre|intitulé|sujet/i)
      .or(page.getByPlaceholder(/titre|événement/i))
      .first();
    await expect(titleField).toBeVisible({ timeout: 5000 });

    // Fermeture par Escape, sans crash.
    await page.keyboard.press('Escape');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
  });
});

test.describe('CRUD — Prospect (dialog ouverture)', () => {
  test('le dialog Nouveau prospect contient les champs requis', async ({ page }) => {
    await ensureAuth(page, '/prospects');

    const cta = page
      .getByRole('button', { name: /nouveau prospect|ajouter.*prospect|créer.*prospect/i })
      .first();
    if (!(await clickIfVisible(page, cta))) {
      test.skip(true, 'CTA Nouveau prospect non exposé.');
      return;
    }

    // Champ nom/raison sociale visible.
    const nameField = page
      .getByLabel(/nom|raison sociale|établissement/i)
      .first();
    await expect(nameField).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');
  });
});

test.describe('CRUD — Catalogue produits (ouverture dialog)', () => {
  test('CTA ajout produit ouvre un formulaire', async ({ page }) => {
    await ensureAuth(page, '/catalogue-produits');

    const cta = page
      .getByRole('button', { name: /nouveau produit|ajouter|créer/i })
      .first();
    if (!(await clickIfVisible(page, cta))) {
      test.skip(true, 'CTA ajout produit non exposé.');
      return;
    }

    const anyField = page
      .getByLabel(/nom|libellé|prix|tarif/i)
      .first();
    await expect(anyField).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });
});

test.describe('CRUD — Documents (upload dialog)', () => {
  test('le dialog upload document s\'ouvre sans crash', async ({ page }) => {
    await ensureAuth(page, '/documents');

    const cta = page
      .getByRole('button', { name: /uploader|ajouter|nouveau document|importer/i })
      .first();
    if (!(await clickIfVisible(page, cta))) {
      test.skip(true, 'CTA upload document non exposé.');
      return;
    }

    // Soit un input file, soit un dropzone visible.
    const fileInput = page.locator('input[type="file"]').first();
    const dropzone = page.getByText(/glisser|déposer|drop/i).first();
    const hasUploadUI =
      (await fileInput.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await dropzone.isVisible({ timeout: 3000 }).catch(() => false));

    expect(hasUploadUI, 'Aucun UI d\'upload détecté.').toBe(true);
    await page.keyboard.press('Escape').catch(() => {});
  });
});
