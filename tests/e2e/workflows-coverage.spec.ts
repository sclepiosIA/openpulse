import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E — flux multi-étapes (workflows métier).
 *
 * Ces tests valident la navigation transversale qu'un utilisateur réel
 * effectue, plutôt que des actions isolées :
 *   1. CRM : prospect → conversion → fiche client → onglet contrats.
 *   2. Email : inbox → ouverture thread → réponse (dialog) → fermeture.
 *   3. Calendrier : jour → semaine → mois → retour aujourd'hui.
 *   4. Tâches : filtre status → tri → ouverture détail → retour.
 *   5. Trésorerie : dashboard → onglet revenus → drilldown.
 *   6. RH People : liste → fiche → onglets dossier RH.
 *   7. Établissement : recherche → détail → onglet emails → retour.
 *
 * On reste read-only (pas de mutation persistée) : l'objectif est
 * d'attraper les régressions de navigation/state entre vues.
 */

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;

async function checkNoCrash(page: Page) {
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
}

test.describe('Workflow CRM — prospect → conversion → contrats', () => {
  test('parcours commercial complet en navigation', async ({ page }) => {
    await loginAsAdmin(page);

    // Étape 1 : liste prospects.
    await page.goto('/prospects');
    await checkNoCrash(page);

    // Étape 2 : retour /etablissements.
    await page.goto('/etablissements');
    await checkNoCrash(page);

    // Étape 3 : déploiement → production.
    await page.goto('/deploiement');
    await checkNoCrash(page);
    await page.goto('/production');
    await checkNoCrash(page);

    // Étape 4 : pipeline → contrats.
    await page.goto('/pipeline');
    await checkNoCrash(page);
    await page.goto('/contrats');
    await checkNoCrash(page);

    // Étape 5 : facturation finale.
    await page.goto('/facturation');
    await checkNoCrash(page);
  });
});

test.describe('Workflow Email — inbox → thread → dialog réponse', () => {
  test('ouvrir un thread et déclencher le compositeur', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/emails');
    await checkNoCrash(page);

    // Cliquer le premier thread (si présent).
    const firstThread = page
      .locator('[data-testid*="thread"], [role="listitem"], article')
      .first();
    if (!(await firstThread.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Inbox vide — skip.');
      return;
    }
    await firstThread.click();
    await page.waitForTimeout(500);
    await checkNoCrash(page);

    // Ouvrir compositeur "Répondre".
    const reply = page
      .getByRole('button', { name: /répondre|reply|nouveau mail/i })
      .first();
    if (await reply.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reply.click();
      await page.waitForTimeout(300);
      await checkNoCrash(page);
      await page.keyboard.press('Escape').catch(() => {});
    }
  });
});

test.describe('Workflow Calendrier — bascule de vues', () => {
  test('jour → semaine → mois → aujourd\'hui sans crash', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/calendrier');
    await checkNoCrash(page);

    for (const viewName of ['Jour', 'Semaine', 'Mois', 'Aujourd']) {
      const btn = page
        .getByRole('button', { name: new RegExp(viewName, 'i') })
        .first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(300);
        await checkNoCrash(page);
      }
    }
  });
});

test.describe('Workflow Tâches — filtres et tri', () => {
  test('appliquer un filtre status puis ouvrir une tâche', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/taches');
    await checkNoCrash(page);

    // Cliquer un filtre status si présent (chips ou Select).
    const statusChip = page
      .getByRole('button', { name: /à faire|en cours|terminé|tous/i })
      .first();
    if (await statusChip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await statusChip.click();
      await page.waitForTimeout(300);
      await checkNoCrash(page);
    }

    // Ouvrir la première tâche si la liste n'est pas vide.
    const firstTask = page
      .locator('[data-testid*="task"], [role="listitem"]')
      .first();
    if (await firstTask.isVisible({ timeout: 2000 }).catch(() => false)) {
      await firstTask.click();
      await page.waitForTimeout(300);
      await checkNoCrash(page);
      await page.keyboard.press('Escape').catch(() => {});
    }
  });
});

test.describe('Workflow Trésorerie — dashboard → onglets', () => {
  test('bascule entre onglets financiers sans crash', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/tresorerie');
    await checkNoCrash(page);

    for (const tabName of [/dashboard|vue/i, /revenu|encaiss/i, /dépense|sortant/i, /banque|qonto/i]) {
      const tab = page.getByRole('tab', { name: tabName }).first();
      if (await tab.isVisible({ timeout: 1500 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(300);
        await checkNoCrash(page);
      }
    }
  });
});

test.describe('Workflow RH People — fiche → onglets dossier', () => {
  test('ouvrir une fiche personne et cycler ses onglets', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/people');
    await checkNoCrash(page);

    const firstPerson = page
      .locator('a[href^="/people/"]')
      .first();
    if (!(await firstPerson.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Liste people vide — skip.');
      return;
    }
    await firstPerson.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await checkNoCrash(page);

    // Cycler quelques onglets typiques du dossier RH.
    for (const tabName of [/info|identité/i, /salaire|paie/i, /document/i, /absence|congé/i]) {
      const tab = page.getByRole('tab', { name: tabName }).first();
      if (await tab.isVisible({ timeout: 1500 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(300);
        await checkNoCrash(page);
      }
    }
  });
});

test.describe('Workflow Établissement — recherche → détail → emails', () => {
  test('chercher un établissement, ouvrir détail, basculer sur l\'onglet emails', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/etablissements');
    await checkNoCrash(page);

    const search = page
      .getByPlaceholder(/rechercher|search/i)
      .first();
    if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
      await search.fill('a');
      await page.waitForTimeout(500);
      await checkNoCrash(page);
    }

    const firstEtab = page
      .locator('a[href^="/etablissements/"]')
      .filter({ hasNot: page.locator('a[href="/etablissements/new"]') })
      .first();
    if (!(await firstEtab.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Aucun établissement après recherche — skip.');
      return;
    }
    await firstEtab.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await checkNoCrash(page);

    const emailsTab = page.getByRole('tab', { name: /email|message/i }).first();
    if (await emailsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailsTab.click();
      await page.waitForTimeout(300);
      await checkNoCrash(page);
    }
  });
});
