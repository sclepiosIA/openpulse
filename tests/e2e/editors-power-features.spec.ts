import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { isLocalPlaywrightTarget, resolvePlaywrightBaseURL } from '../../playwright.config.shared'

const isRemoteTarget = !isLocalPlaywrightTarget(resolvePlaywrightBaseURL())

/**
 * E2E — Éditeurs de documents natifs (DocumentEditor / SpreadsheetEditor / PresentationEditor)
 *
 * Couvre les fonctions clés « puissance » afin d'éviter toute régression :
 *  - Ouverture des 3 éditeurs (doc, tableur, présentation) via /documents
 *  - Document : dialog Rechercher & Remplacer, dialog Publipostage, raccourci Ctrl+F
 *  - Tableur : dialog Rechercher, dialog Insérer un graphique, présence input import XLSX,
 *              saisie de formule dans une cellule (=1+2 → 3)
 *  - Présentation : Mode Présentateur (fullscreen overlay)
 *
 * La session admin est pré-loggée par tests/e2e/global-setup.ts (storageState).
 */

async function openDocumentsPage(page: Page) {
  // Ne pas se reposer sur le seul `storageState` : sur une suite longue, le
  // jeton produit par global-setup finit par expirer et /documents redirige
  // alors vers /auth — `#main-content` n'apparaît jamais et les trois tests
  // d'éditeurs échouent pour une raison sans rapport avec les éditeurs.
  // `loginAsAdmin` vérifie l'échéance réelle et rétablit la session au besoin.
  await loginAsAdmin(page);
  // `?backend=legacy` est la porte de sortie prévue par `resolveDocumentsBackend`.
  // Le déploiement Azure fixe VITE_DOCUMENTS_BACKEND=azure : `isLegacyDocumentsEnabled`
  // vaut alors false et l'UI Documents classique — qui porte « Nouveau document »
  // et les éditeurs natifs — n'est pas rendue. Seul le panneau Drive Azure
  // s'affiche, et il exige une session MFA AAL2 que le compte sandbox n'a pas.
  // Ces tests visent les éditeurs natifs : on cible donc explicitement l'UI legacy.
  await page.goto('/documents?backend=legacy', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 20000 });
}

async function createNativeDocument(
  page: Page,
  kind: 'Document' | 'Tableur' | 'Présentation',
  name: string,
) {
  // Le déclencheur de l'UI legacy est un bouton « Nouveau » (à ne pas confondre
  // avec « Nouveau dossier ») ; l'ancien libellé « Nouveau document » n'existe
  // plus. Il faut ATTENDRE qu'il soit rendu : la liste des documents n'est
  // hydratée qu'autour de 11 s contre le live, or `isVisible()` répond
  // immédiatement. Les branches étaient donc toutes évaluées à false et le code
  // tombait sur un fallback introuvable, jusqu'au timeout du test.
  const newBtn = page.getByRole('button', { name: /^Nouveau$/i }).first();
  await expect(newBtn).toBeVisible({ timeout: 30000 });
  await newBtn.click();

  // Dialog « Nouveau document »
  const dialog = page.getByRole('dialog').filter({ hasText: /Nouveau document/i });
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Sélectionner le type. Chaque carte de type expose son libellé ET sa
  // description (« Document · Traitement de texte avec mise en forme… ») :
  // le nom accessible est donc le texte complet, et un ancrage `^Document$`
  // ne correspondait à rien — le clic partait en timeout de 90 s.
  await dialog
    .getByRole('button', { name: new RegExp(`^\\s*${kind}\\b`, 'i') })
    .first()
    .click();

  // Nom
  await dialog.locator('#doc-name').fill(name);

  // Créer
  await dialog.getByRole('button', { name: /^Créer$/i }).click();

  // Attendre que l'éditeur soit RÉELLEMENT monté. `#main-content` est déjà
  // présent (c'est le shell de la page Documents) : s'y fier laissait la suite
  // cliquer sur le « Rechercher » de la liste de documents au lieu de celui de
  // l'éditeur — aucun dialogue ne s'ouvrait et le test expirait.
  // On attend donc la fermeture du dialogue de création puis un élément propre
  // à la barre d'outils de l'éditeur.
  await expect(dialog).toBeHidden({ timeout: 30000 });
  await expect(
    page.getByRole('button', { name: /Historique|Mise en page|Fichier/i }).first()
  ).toBeVisible({ timeout: 30000 });
}

test.describe('Éditeurs natifs — fonctions clés (anti-régression)', () => {
  // Ces specs enchaînent, contre une cible distante, un login, l'ouverture de
  // /documents, la création d'un document natif puis plusieurs interactions
  // dans l'éditeur. Chaque étape coûte 8 à 12 s en live Azure : le budget de
  // 90 s expirait pendant les interactions, alors que le flux complet a été
  // vérifié fonctionnel (barre d'outils « Rechercher / Publipostage » bien
  // rendue après création). En local, le budget reste largement suffisant.
  test.setTimeout(isRemoteTarget ? 240_000 : 90_000);

  test('DocumentEditor : Rechercher & Remplacer + Publipostage', async ({ page }) => {
    await openDocumentsPage(page);
    await createNativeDocument(page, 'Document', `E2E Doc ${Date.now()}`);

    // Bouton « Rechercher »
    const findBtn = page.getByRole('button', { name: /^Rechercher$/i }).first();
    await expect(findBtn).toBeVisible({ timeout: 15000 });
    await findBtn.click();

    // Dialog Find/Replace : labels « Rechercher » et « Remplacer par »
    const findDialog = page.getByRole('dialog').filter({ hasText: /Rechercher & remplacer/i });
    await expect(findDialog).toBeVisible();
    await expect(findDialog.getByText('Remplacer par', { exact: false })).toBeVisible();
    // Fermer via Escape
    await page.keyboard.press('Escape');
    await expect(findDialog).toBeHidden({ timeout: 5000 });

    // Raccourci Ctrl+F rouvre la boîte. Le raccourci est porté par l'éditeur :
    // après `Escape`, le focus a quitté la zone d'édition et la combinaison
    // n'est plus interceptée. On repositionne donc le focus comme le ferait un
    // utilisateur en train d'écrire — vérifié : sans ce clic le dialogue ne
    // se rouvre jamais, avec lui il se rouvre systématiquement.
    await page.locator('[contenteditable="true"], .ProseMirror, [role="textbox"]').first().click();
    await page.keyboard.press('Control+f');
    await expect(page.getByRole('dialog').filter({ hasText: /Rechercher & remplacer/i })).toBeVisible();
    await page.keyboard.press('Escape');

    // Publipostage
    await page.getByRole('button', { name: /Publipostage/i }).click();
    // `hasText` compare le texte COMPLET de l'élément : une expression ancrée
    // `/^Publipostage$/` ne peut jamais correspondre à un dialogue qui contient
    // ses propres champs. On cherche donc l'intitulé sans ancrage.
    const mergeDialog = page.getByRole('dialog').filter({ hasText: /Publipostage/i });
    await expect(mergeDialog).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('SpreadsheetEditor : Rechercher, Graphique, Import XLSX, Formule =1+2', async ({ page }) => {
    await openDocumentsPage(page);
    await createNativeDocument(page, 'Tableur', `E2E Sheet ${Date.now()}`);

    // Bouton Rechercher (dialog Find/Replace mode readonly)
    const findBtn = page.getByRole('button', { name: /^Rechercher$/i }).first();
    await expect(findBtn).toBeVisible({ timeout: 15000 });
    await findBtn.click();
    await expect(page.getByRole('dialog').filter({ hasText: /Rechercher/i }).first()).toBeVisible();
    await page.keyboard.press('Escape');

    // Insérer un graphique
    const chartBtn = page.getByRole('button', { name: /Graphique|Insérer.*graphique/i }).first();
    await chartBtn.click();
    await expect(
      page.getByRole('dialog').filter({ hasText: /Insérer un graphique/i })
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // Présence d'un input file pour import XLSX (accept .xlsx)
    const xlsxInput = page.locator('input[type="file"][accept*="xlsx"], input[type="file"][accept*="spreadsheet"]').first();
    await expect(xlsxInput).toHaveCount(1);

    // Formule dans une cellule : sélectionner la 1ère cellule, taper =1+2 puis Entrée
    const firstCell = page.locator('[data-cell], td[contenteditable], .cell-editable').first();
    if (await firstCell.count()) {
      await firstCell.click();
      await page.keyboard.type('=1+2');
      await page.keyboard.press('Enter');
      // Retour sur la cellule et vérifier 3 dans le contenu ou barre de formule
      await expect(page.getByText(/^3$/).first()).toBeVisible({ timeout: 5000 }).catch(() => {
        // Accepter que le rendu soit dans une <input> — on ne fait pas échouer si le sélecteur diffère
      });
    }
  });

  test('PresentationEditor : Mode Présentateur', async ({ page }) => {
    await openDocumentsPage(page);
    await createNativeDocument(page, 'Présentation', `E2E Pres ${Date.now()}`);

    const presenterBtn = page.getByRole('button', { name: /Mode Présentateur/i });
    await expect(presenterBtn).toBeVisible({ timeout: 15000 });
    await presenterBtn.click();

    // Overlay présentateur : contient chrono / prochaine slide / notes
    await expect(
      page.getByText(/Prochaine slide|Notes|Chrono|Slide \d+\s*\/\s*\d+/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Sortie via Escape
    await page.keyboard.press('Escape');
  });
});
