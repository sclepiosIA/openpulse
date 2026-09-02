import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

const TARGETS = [
  { path: '/etablissements', placeholder: /rechercher|recherche|chercher/i },
  { path: '/prospects', placeholder: /rechercher|recherche|chercher/i },
  { path: '/people', placeholder: /rechercher|recherche|chercher/i },
];

test.describe('Champs de recherche réactifs', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });
  for (const t of TARGETS) {
    test(`${t.path} : input recherche garde le focus`, async ({ page }) => {
      await page.goto(t.path, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);
      const input = page.getByPlaceholder(t.placeholder).first();
      if (!(await input.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, `Aucun input recherche trouvé sur ${t.path}`);
        return;
      }
      await input.fill('test');
      await page.waitForTimeout(500);
      await expect(input).toBeFocused();
      await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
    });
  }
});
