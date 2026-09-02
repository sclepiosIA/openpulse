import { test, expect, devices } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { keepRealRuntimeErrors } from './helpers/runtime-errors';

/**
 * Couverture E2E — applications mobiles dédiées `/m/*`.
 *
 * Complète `mobile-coverage.spec.ts` : celui-ci vérifie les pages desktop en
 * viewport mobile, tandis que cette spec visite les vraies routes PWA/mobile
 * (mail, todos, Pulse, calendrier, documents, prise de RDV, Jarvis, install).
 */

test.use({ ...devices['iPhone 12'] });

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;
const NOT_FOUND_RE = /page introuvable|404|n'existe pas/i;

const MOBILE_APP_ROUTES = [
  '/m/mail',
  '/m/todos',
  '/m/pulse',
  '/m/calendrier',
  '/m/documents',
  '/m/prise-rdv',
  '/m/jarvis',
  '/m/install',
];

test.describe('PWA mobile `/m/*` — routes dédiées sans crash ni débordement', () => {
  for (const path of MOBILE_APP_ROUTES) {
    test(`${path} rend une expérience mobile valide`, async ({ page }) => {
      const runtimeErrors: string[] = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));

      await loginAsAdmin(page);
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (response && response.status() >= 500) {
        throw new Error(`HTTP ${response.status()} sur ${path}`);
      }
      await page.waitForLoadState('networkidle').catch(() => {});

      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
      await expect(page.getByText(NOT_FOUND_RE).first()).toHaveCount(0);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `Overflow horizontal de ${overflow}px sur ${path}`).toBeLessThanOrEqual(2);

      const visibleContent = await page.locator('body').innerText();
      expect(visibleContent.trim().length, `${path} semble vide`).toBeGreaterThan(5);

      const realErrors = keepRealRuntimeErrors(runtimeErrors);
      expect(realErrors, `Erreurs runtime sur ${path}:\n${realErrors.join('\n')}`).toHaveLength(0);
    });
  }
});