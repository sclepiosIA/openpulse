import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des vues alternatives (kanban / liste / tableau / gantt)
 * sur les modules qui les exposent. On bascule entre les vues et on
 * vérifie l'absence de crash et la persistance du shell.
 */

const VIEWS = [
  { path: '/prospects', patterns: [/kanban|tableau|liste|carte/i] },
  { path: '/taches', patterns: [/kanban|liste|tableau|calendrier/i] },
  { path: '/rd', patterns: [/backlog|sprint|gantt|kanban|burndown/i] },
  { path: '/deploiement', patterns: [/kanban|liste|tableau/i] },
];

test.describe('Vues alternatives (Kanban/Liste/Gantt)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const v of VIEWS) {
    test(`${v.path} — bascule entre vues sans crash`, async ({ page }) => {
      await page.goto(v.path);
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(1000);

      let switched = 0;
      for (const rx of v.patterns) {
        const buttons = page.getByRole('button', { name: rx });
        const tabs = page.getByRole('tab', { name: rx });
        const count = (await buttons.count()) + (await tabs.count());
        if (count === 0) continue;

        const target = (await buttons.count() > 0 ? buttons : tabs).first();
        if (await target.isVisible({ timeout: 1000 }).catch(() => false)) {
          await target.click();
          await page.waitForTimeout(500);
          await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
          switched++;
        }
      }

      if (switched === 0) {
        test.skip(true, `Aucun toggle de vue trouvé sur ${v.path}`);
      }
      await expect(page.locator('#main-content')).toBeVisible();
    });
  }
});
