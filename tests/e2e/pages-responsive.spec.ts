import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * E2E responsivité multi-pages (mobile + tablet).
 * Étend dashboard-responsive.spec.ts aux pages les plus utilisées.
 */

const VIEWPORTS = [
  { name: 'iPhone SE',  width: 375, height: 667 },
  { name: 'iPhone 14',  width: 390, height: 844 },
  { name: 'iPad',       width: 768, height: 1024 },
] as const;

const ROUTES = [
  { name: 'Etablissements', path: '/etablissements' },
  { name: 'Emails',         path: '/emails' },
  { name: 'Pulse',          path: '/pulse' },
  { name: 'Calendrier',     path: '/calendrier' },
  { name: 'People',         path: '/people' },
  { name: 'Tresorerie',     path: '/tresorerie' },
  { name: 'Contrats',       path: '/contrats' },
  { name: 'Projets',        path: '/projets' },
];

test.describe('Pages responsiveness (no horizontal scroll, no overflow)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route.name} @ ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path);
        await page.waitForLoadState('networkidle');

        // 1. Pas de scroll horizontal sur le viewport
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth, `${route.name} a un scroll horizontal à ${vp.name}`).toBeLessThanOrEqual(clientWidth + 1);

        // 2. Le body ne déborde pas
        const bodyOverflow = await page.evaluate(() => {
          const b = document.body;
          return b.scrollWidth - b.clientWidth;
        });
        expect(bodyOverflow, `${route.name} body overflow à ${vp.name}`).toBeLessThanOrEqual(1);
      });
    }
  }
});
