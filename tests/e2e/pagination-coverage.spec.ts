import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture pagination & infinite scroll : on visite les listes
 * volumineuses et on déclenche le scroll bas-de-page pour vérifier
 * qu'aucune boucle infinie ni crash ne survient.
 */

const ROUTES = ['/etablissements', '/prospects', '/emails', '/taches', '/people'];

test.describe('Pagination & infinite scroll', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const path of ROUTES) {
    test(`${path} — scroll vers le bas sans crash ni boucle`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

      // Attendre que le chargement initial soit RETOMBÉ avant de compter.
      // `#main-content` n'est que le shell : les listes continuent de charger
      // pendant une dizaine de secondes. Compter dès ce moment attribuait au
      // scroll les requêtes d'hydratation — /prospects en émet plus de 200 —
      // et le test dénonçait une « boucle » qui n'existait pas.
      let pending = 0;
      const settle = (req: { url: () => string }) => {
        if (req.url().includes('/rest/v1/') || req.url().includes('/rpc/')) pending += 1;
      };
      page.on('request', settle);
      for (let quiet = 0; quiet < 3 && pending >= 0; ) {
        const before = pending;
        await page.waitForTimeout(1000);
        quiet = pending === before ? quiet + 1 : 0;
      }
      page.off('request', settle);

      // À partir d'ici, seules les requêtes déclenchées par le scroll comptent.
      let restCalls = 0;
      page.on('request', (req) => {
        if (req.url().includes('/rest/v1/') || req.url().includes('/rpc/')) restCalls++;
      });

      // 3 scrolls successifs, espacés.
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(900);
      }

      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
      // Garde-fou anti-boucle infinie : on accepte large mais on coupe au-delà.
      expect(restCalls, `Rafale anormale de requêtes (${restCalls}) sur ${path}`).toBeLessThan(150);
    });
  }
});
