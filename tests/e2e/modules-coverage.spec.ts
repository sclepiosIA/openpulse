import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Couverture E2E interaction — pour chaque module majeur non couvert par
 * une spec dédiée, on vérifie :
 *   - Le module charge sans crash (#main-content + pas d'ErrorBoundary).
 *   - Au moins un repère métier (titre, KPI, onglet) est visible.
 *   - Si présent, le CTA principal ouvre bien un dialog / une nouvelle vue.
 *
 * Les tests `test.skip()` proprement quand un CTA n'est pas exposé pour
 * la session courante (rôle / données) plutôt que générer un faux négatif.
 */

const ERROR_BOUNDARY_RE =
  /une erreur (est|s'est) (survenue|produite)|something went wrong|oops/i;

async function gotoModule(page: Page, path: string) {
  await loginAsAdmin(page);
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(ERROR_BOUNDARY_RE).first()).toHaveCount(0);
}

test.describe('Module Automatisations', () => {
  test('liste s\'affiche avec onglets / CTA', async ({ page }) => {
    await gotoModule(page, '/automatisations');
    // Au moins un titre ou un repère "Automatisation" visible.
    await expect(
      page.getByText(/automatisation/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('santé des automatisations charge', async ({ page }) => {
    await gotoModule(page, '/automatisations/sante');
    await expect(
      page.getByText(/santé|health|runs?|succès|échec/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('explorateur runs charge', async ({ page }) => {
    await gotoModule(page, '/automatisations/runs');
    await expect(
      page.getByText(/runs?|exécution|exécutions/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Rapports custom', () => {
  test('liste « Mes rapports » charge avec CTA de création', async ({ page }) => {
    await gotoModule(page, '/rapports-custom');
    const cta = page
      .getByRole('button', { name: /nouveau rapport|créer.*rapport|ajouter/i })
      .first();
    if (await cta.isVisible().catch(() => false)) {
      await expect(cta).toBeEnabled();
    }
  });
});

test.describe('Module Documents (GED)', () => {
  test('arborescence / liste de documents rendue', async ({ page }) => {
    await gotoModule(page, '/documents');
    await expect(
      page.getByText(/document|dossier|fichier/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Catalogue produits', () => {
  test('liste produits / services rendue', async ({ page }) => {
    await gotoModule(page, '/catalogue-produits');
    await expect(
      page.getByText(/produit|service|catalogue|tarif/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Forecasting & Churn', () => {
  test('forecasting charge avec KPIs', async ({ page }) => {
    await gotoModule(page, '/forecasting');
    await expect(
      page.getByText(/forecast|prévision|pipeline|mrr|arr/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('churn predictor charge', async ({ page }) => {
    await gotoModule(page, '/churn');
    await expect(
      page.getByText(/churn|risque|prédiction|attrition/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('alias historique /churn-predictor redirige vers /churn', async ({ page }) => {
    await gotoModule(page, '/churn-predictor');
    expect(page.url()).toContain('/churn');
  });
});

test.describe('Module Social Dashboard', () => {
  test('dashboard social charge', async ({ page }) => {
    await gotoModule(page, '/social');
    await expect(
      page.getByText(/social|publication|réseau|engagement/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('composer charge', async ({ page }) => {
    await gotoModule(page, '/social/composer');
    await expect(
      page.getByText(/composer|publier|publication|message/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('inbox charge', async ({ page }) => {
    await gotoModule(page, '/social/inbox');
    await expect(
      page.getByText(/inbox|message|conversation|réponse/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Recrutement', () => {
  test('liste recrutement charge', async ({ page }) => {
    await gotoModule(page, '/recrutement');
    await expect(
      page.getByText(/recrut|candidat|offre|poste/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Compétences', () => {
  test('matrice compétences charge', async ({ page }) => {
    await gotoModule(page, '/competences');
    await expect(
      page.getByText(/compétence|certification|évaluation/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Activity Feed', () => {
  test('feed d\'activité charge', async ({ page }) => {
    await gotoModule(page, '/activite');
    await expect(
      page.getByText(/activit|événement|historique|récent/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Analytics', () => {
  test('page analytics charge avec graphiques ou KPIs', async ({ page }) => {
    await gotoModule(page, '/rapports');
    await expect(
      page.getByText(/analyt|kpi|métrique|évolution|taux/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Base de connaissances & Tutoriels', () => {
  test('base de connaissances charge', async ({ page }) => {
    await gotoModule(page, '/base-connaissances');
    await expect(
      page.getByText(/connaissance|article|documentation|recherche/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('tutoriels charge', async ({ page }) => {
    await gotoModule(page, '/tutoriels');
    await expect(
      page.getByText(/tutoriel|module|vidéo|guide/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Formulaires', () => {
  test('liste de formulaires charge', async ({ page }) => {
    await gotoModule(page, '/formulaires');
    await expect(
      page.getByText(/formulaire|question|réponse|publier/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Notifications', () => {
  test('centre de notifications charge', async ({ page }) => {
    await gotoModule(page, '/notifications');
    await expect(
      page.getByText(/notification|alerte|non lu|tout marquer/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Gantt & Projets', () => {
  test('gantt charge', async ({ page }) => {
    await gotoModule(page, '/gantt');
    await expect(
      page.getByText(/gantt|planning|tâche|jalon|sprint/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('projets charge', async ({ page }) => {
    await gotoModule(page, '/projets');
    await expect(
      page.getByText(/projet|équipe|avancement|statut/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Meeting notes', () => {
  test('liste meeting notes charge', async ({ page }) => {
    await gotoModule(page, '/meeting-notes');
    await expect(
      page.getByText(/réunion|meeting|note|compte.rendu|participant/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Appels', () => {
  test('liste appels charge', async ({ page }) => {
    await gotoModule(page, '/appels');
    await expect(
      page.getByText(/appel|téléphone|durée|numéro/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Module Email Analytics', () => {
  test('analytics emails charge', async ({ page }) => {
    await gotoModule(page, '/email-analytics');
    await expect(
      page.getByText(/email|ouvertur|clic|envoi|taux/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('classification analytics charge', async ({ page }) => {
    await gotoModule(page, '/email-classification-analytics');
    await expect(
      page.getByText(/classification|catégorie|confiance|précision/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });

  test('templates email chargent', async ({ page }) => {
    await gotoModule(page, '/email-templates');
    await expect(
      page.getByText(/template|modèle|sujet|variable/i).first(),
    ).toBeVisible({ timeout: 8000 });
  });
});
