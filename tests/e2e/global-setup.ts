import { chromium, FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Global setup E2E — log in once, save Supabase session to disk.
 *
 * Tests subsequents réutilisent `storageState: 'tests/e2e/.auth/admin.json'`
 * → plus de timeout login répété, suite e2e exploitable en local.
 *
 * Variables d'env :
 *   E2E_BASE_URL   (default http://localhost:8080)
 *   E2E_ADMIN_EMAIL / E2E_EMAIL      (default test-admin@exploitant.example.org)
 *   E2E_ADMIN_PASSWORD / E2E_PASSWORD / TEST_ACCOUNTS_PASSWORD
 *   E2E_SKIP_SETUP=1 pour bypasser (ex: tests publics only)
 *
 * Sélecteurs alignés sur le markup réel de `src/pages/Auth.tsx` (2026-06) :
 *   email = <Input id="signin-email" type="email"> + Label « Email »
 *   password = <Input id="signin-password" type="password"> + Label « Mot de passe »
 *   submit = <Button type="submit">Se connecter</Button>
 */
export default async function globalSetup(config: FullConfig) {
  if (process.env.E2E_SKIP_SETUP === '1') {
    console.log('[e2e:setup] E2E_SKIP_SETUP=1 → skip auth setup');
    return;
  }

  const baseURL = process.env.E2E_BASE_URL
    || config.projects[0]?.use?.baseURL
    || 'http://localhost:8080';
  const email = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || 'test-admin@exploitant.example.org';
  const password =
    process.env.E2E_ADMIN_PASSWORD ||
    process.env.E2E_PASSWORD ||
    process.env.TEST_ACCOUNTS_PASSWORD;

  const authDir = path.resolve('tests/e2e/.auth');
  fs.mkdirSync(authDir, { recursive: true });
  const storagePath = path.join(authDir, 'admin.json');

  console.log(`[e2e:setup] login ${email} on ${baseURL} ...`);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    if (!password) {
      console.warn('[e2e:setup] ⚠ TEST_ACCOUNTS_PASSWORD/E2E_*_PASSWORD absent : storageState vide, tests authentifiés feront un échec explicite.');
      await context.storageState({ path: storagePath });
      return;
    }

    await page.goto(`${baseURL}/auth`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Sélecteurs robustes : label « Email » / « Mot de passe », sinon fallback type.
    await page.getByLabel('Email', { exact: true }).or(page.locator('input[type="email"]')).first().fill(email);
    await page.getByLabel('Mot de passe', { exact: true }).or(page.locator('input[type="password"]')).first().fill(password);
    await page.getByRole('button', { name: /se connecter|connexion/i }).or(page.locator('button[type="submit"]')).first().click();
    // Attendre soit une redirection hors /auth, soit le montage direct du shell.
    await Promise.race([
      page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 }),
      page.locator('#main-content').waitFor({ state: 'visible', timeout: 30_000 }),
    ]);
    // S'assurer que le shell authentifié est monté avant de capturer la session.
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15_000 });
    await context.storageState({ path: storagePath });
    console.log(`[e2e:setup] ✅ storageState saved → ${storagePath}`);
  } catch (err) {
    console.warn(`[e2e:setup] ⚠ login failed (${(err as Error).message}). Tests authentifiés vont retomber sur loginAsAdmin() à l'ancienne.`);
    // Écrire un storageState vide pour ne pas casser les tests purement publics
    await context.storageState({ path: storagePath });
  } finally {
    await browser.close();
  }
}
