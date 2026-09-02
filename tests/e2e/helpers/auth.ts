import { Page, expect } from '@playwright/test'

/**
 * Helper d'authentification pour les tests E2E.
 * Gère la connexion avant les tests nécessitant une session authentifiée.
 *
 * Sélecteurs alignés sur le markup réel de `src/pages/Auth.tsx` (2026-06) :
 *   - email    : <Input id="signin-email" type="email"> + <Label htmlFor="signin-email">Email</Label>
 *   - password : <Input id="signin-password" type="password"> + <Label htmlFor="signin-password">Mot de passe</Label>
 *   - submit   : <Button type="submit">Se connecter</Button>
 * On privilégie getByLabel/getByRole (robustes) plutôt que des sélecteurs CSS fragiles.
 *
 * Après login, l'app redirige vers `/dashboard` puis `/` (cf. AuthenticatedRoutes).
 * Le marqueur de session valide, indépendant du rôle (CSM/Direction/Commercial/…),
 * est le shell applicatif `#main-content` (présent sur toutes les pages authentifiées),
 * et NON le titre « Tableau de bord » qui varie selon le dashboard de rôle.
 */

// Admin E2E — utilise en priorité les env admin-scopés pour ne PAS hériter du
// compte CSM (E2E_EMAIL). Ordre : E2E_ADMIN_EMAIL > E2E_EMAIL > fallback
// sandbox `test-admin@exploitant.example.org` (provisionné par provision-test-accounts,
// cf. docs/SANDBOX_TEST_ACCOUNTS.md). Idem mot de passe : E2E_ADMIN_PASSWORD >
// E2E_PASSWORD > TEST_ACCOUNTS_PASSWORD. Aucun fallback dur de mot de passe :
// le secret live reste uniquement en env/Key Vault.
const TEST_EMAIL =
  process.env.E2E_ADMIN_EMAIL ||
  process.env.E2E_EMAIL ||
  'test-admin@exploitant.example.org'

function testPassword(): string {
  const password =
    process.env.E2E_ADMIN_PASSWORD ||
    process.env.E2E_PASSWORD ||
    process.env.TEST_ACCOUNTS_PASSWORD

  if (!password) {
    throw new Error('TEST_ACCOUNTS_PASSWORD ou E2E_ADMIN_PASSWORD requis pour les tests authentifiés sandbox')
  }

  return password
}

/** Locator du champ email, tolérant (label « Email » sinon fallback type). */
function emailField(page: Page) {
  return page.getByLabel('Email', { exact: true }).or(page.locator('input[type="email"]')).first()
}

/** Locator du champ mot de passe (label « Mot de passe » sinon fallback type). */
function passwordField(page: Page) {
  return page.getByLabel('Mot de passe', { exact: true }).or(page.locator('input[type="password"]')).first()
}

/** Bouton de soumission du formulaire de connexion. */
function submitButton(page: Page) {
  return page
    .getByRole('button', { name: /se connecter|connexion/i })
    .or(page.locator('button[type="submit"]'))
    .first()
}

/**
 * Se connecte en tant qu'admin et attend la redirection vers le dashboard.
 * Si l'utilisateur est déjà connecté (shell visible), ne fait rien.
 */
/**
 * Vrai si le navigateur porte une session Supabase encore valide.
 *
 * La présence du shell ne suffit pas : l'application monte son interface à
 * partir de l'état local, même quand le refresh token stocké est expiré. Sur
 * une suite longue (plus d'une heure), le `storageState` produit par
 * `global-setup` finit par périmer : les tests voyaient `#main-content`,
 * concluaient « déjà connecté », puis l'application se déconnectait en pleine
 * navigation — d'où des `/auth/v1/logout`, des `TypeError: Failed to fetch` et
 * des redirections vers /auth attribuées à tort à la page testée.
 *
 * On lit donc l'échéance réelle du jeton, avec une marge d'une minute.
 */
async function hasFreshSession(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (!key || !/^sb-.*-auth-token$/.test(key)) continue
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const expiresAt = JSON.parse(raw)?.expires_at
        if (typeof expiresAt === 'number') return expiresAt * 1000 - Date.now() > 60_000
      }
      return false
    } catch {
      return false
    }
  })
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/')

  // Déjà connecté ? Le shell `#main-content` est présent sur toute page authentifiée.
  // Sur Azure, le premier montage peut prendre quelques secondes (session Supabase + rôles).
  const alreadyAuthed = await page
    .locator('#main-content')
    .isVisible({ timeout: 10000 })
    .catch(() => false)

  if (alreadyAuthed) {
    if (await hasFreshSession(page)) return
    // Session périmée : purger avant de se reconnecter, sinon le SDK tente un
    // refresh voué à l'échec (400 `refresh_token_not_found`) dont l'erreur
    // console serait imputée à la page sous test.
    await page.evaluate(() => {
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch {
        /* storage inaccessible : le login ci-dessous reste possible */
      }
    })
  }

  // Sinon, aller sur la page de connexion. Si le storageState est déjà valide,
  // /auth peut rediriger vers le shell avant que le formulaire ne soit visible.
  await page.goto('/auth')
  // Plan tout-vert : ne plus utiliser networkidle (Supabase realtime + wss empêche stabilisation).
  await page.waitForLoadState('domcontentloaded')

  const authTarget = await Promise.race([
    page.locator('#main-content').waitFor({ state: 'visible', timeout: 20000 }).then(() => 'shell' as const),
    emailField(page).waitFor({ state: 'visible', timeout: 20000 }).then(() => 'form' as const),
  ]).catch(() => null)

  if (authTarget === 'shell') return
  if (authTarget !== 'form') {
    throw new Error('Écran d’authentification indisponible : ni shell authentifié ni formulaire de login visible')
  }


  // Remplir les identifiants.
  await emailField(page).fill(TEST_EMAIL)
  await passwordField(page).fill(testPassword())

  // Soumettre.
  await submitButton(page).click()

  // Attendre soit une redirection hors /auth, soit le montage direct du shell.
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 }),
    page.locator('#main-content').waitFor({ state: 'visible', timeout: 20000 }),
  ])
  // Marqueur d'app authentifiée, indépendant du rôle.
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 })
}

/**
 * Ensures the page has loaded after auth redirect and is on the expected route.
 */
export async function navigateAuthenticated(page: Page, path: string): Promise<void> {
  await loginAsAdmin(page)
  if (path !== '/') {
    await page.goto(path)
    // Plan tout-vert : networkidle ne se stabilise jamais (realtime/polling) → attendre le shell app.
    await page.waitForLoadState('domcontentloaded')
    await page.locator('#main-content').waitFor({ state: 'visible', timeout: 15000 })
  }
}


/**
 * Garantit l'absence de session (clear cookies + storage). Utilisé pour les
 * tests de deny-path RBAC : un visiteur non authentifié ne doit jamais
 * accéder à une route protégée.
 */
export async function logoutAndClear(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.goto('/')
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear() } catch { /* noop */ }
  })
}

// Exposés pour les specs qui veulent réutiliser les mêmes sélecteurs robustes.
export const authLocators = { emailField, passwordField, submitButton }
