import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture des vues du calendrier : jour / semaine / mois / agenda,
 * navigation précédent/suivant/aujourd'hui, sans crash.
 */

const VIEWS = [/jour|day/i, /semaine|week/i, /mois|month/i, /agenda|liste/i];

test.describe('Calendrier — couverture vues & navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/calendrier');
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1200);
  });

  test('cycle entre les vues jour/semaine/mois/agenda', async ({ page }) => {
    let toggled = 0;
    for (const rx of VIEWS) {
      const btn = page.getByRole('button', { name: rx })
        .or(page.getByRole('tab', { name: rx }))
        .first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(400);
        await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
        toggled++;
      }
    }
    expect(toggled, 'Aucune vue calendrier trouvée').toBeGreaterThan(0);
  });

  test('navigation précédent/aujourd\'hui/suivant ne crashe pas', async ({ page }) => {
    for (const rx of [/précédent|previous/i, /aujourd'hui|today/i, /suivant|next/i]) {
      const btn = page.getByRole('button', { name: rx }).first();
      if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    }
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.getByText(/une erreur est survenue|oops/i)).toHaveCount(0);
  });
});
