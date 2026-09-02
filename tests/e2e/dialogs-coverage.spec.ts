import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Ouvre/ferme les principaux dialogs de création des modules CRM/RH.
 * Objectif : valider que les Dialog/Sheet shadcn montent sans crash et
 * que la touche Escape les ferme proprement (focus trap, accessibilité).
 *
 * Aucune soumission n'est effectuée — pas d'écriture en base.
 */

type DialogCase = {
  path: string;
  label: string;
  /** Regex pour matcher un bouton d'ouverture (FAB ou header). */
  trigger: RegExp;
};

const CASES: DialogCase[] = [
  { path: '/etablissements', label: 'Nouvel établissement', trigger: /nouvel? établissement|ajouter un établissement|créer/i },
  { path: '/prospects', label: 'Nouveau prospect', trigger: /nouveau prospect|ajouter|créer/i },
  { path: '/taches', label: 'Nouvelle tâche', trigger: /nouvelle tâche|ajouter|créer/i },
  { path: '/calendrier', label: 'Nouvel événement', trigger: /nouvel? événement|ajouter|créer/i },
  { path: '/contrats', label: 'Nouveau contrat', trigger: /nouveau contrat|ajouter|créer/i },
  { path: '/documents', label: 'Importer document', trigger: /importer|upload|ajouter/i },
];

test.describe('Dialogs de création', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const c of CASES) {
    test(`${c.path} → ouvre/ferme « ${c.label} » sans crash`, async ({ page }) => {
      await page.goto(c.path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      const trigger = page.getByRole('button', { name: c.trigger }).first();
      if (!(await trigger.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip(true, `Aucun trigger visible pour ${c.label}`);
      }

      await trigger.click();

      // Un dialog/sheet doit apparaître.
      const dialog = page.getByRole('dialog').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Pas d'ErrorBoundary à l'ouverture.
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);

      // Échap pour fermer.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5000 });
      await expect(page.locator('#main-content')).toBeVisible();
    });
  }
});
