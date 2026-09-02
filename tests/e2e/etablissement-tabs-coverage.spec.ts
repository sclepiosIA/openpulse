import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des sous-onglets profondes des fiches établissement.
 * On ouvre la 1ʳᵉ fiche /etablissements/:id et on cycle sur chacun
 * des onglets fonctionnels typiques (informations, contacts, tâches,
 * emails, documents, contrats, formations, facturation, historique).
 */

const TAB_PATTERNS = [
  /informations|général|détails/i,
  /contacts/i,
  /tâches|todo/i,
  /emails|messages/i,
  /documents|fichiers/i,
  /contrats/i,
  /formations/i,
  /facturation|factures/i,
  /historique|activité/i,
  /notes/i,
];

test.describe('Onglets fiche établissement', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('cycle complet des onglets de la 1ʳᵉ fiche', async ({ page }) => {
    await page.goto('/etablissements');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);

    // La liste n'est hydratée qu'après une dizaine de secondes en live : sans
    // attente, aucun lien de fiche n'existe encore et le test « saute ».
    const first = page.locator('a[href^="/etablissements/"]').first();
    await expect(first).toBeVisible({ timeout: 30000 });

    await first.click();
    await page.waitForURL(/\/etablissements\/[^/]+/, { timeout: 20000 }).catch(() => {});
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    // La fiche charge ses données avant de rendre sa navigation.
    await page.waitForTimeout(6000);

    let clicked = 0;
    for (const rx of TAB_PATTERNS) {
      // La navigation de la fiche est à deux niveaux : des CATÉGORIES rendues
      // comme boutons, et des sous-onglets Radix (`role="tab"`) affichés
      // uniquement quand la catégorie active en compte plusieurs. Ne chercher
      // que `role="tab"` ne trouvait donc rien sur une fiche dont la catégorie
      // courante n'a qu'un seul onglet.
      const tab = page
        .getByRole('tab', { name: rx })
        .or(page.getByRole('button', { name: rx }))
        .first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(400);
        await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
        clicked++;
      }
    }

    expect(clicked, 'Aucun onglet trouvé sur la fiche établissement').toBeGreaterThan(0);
  });
});
