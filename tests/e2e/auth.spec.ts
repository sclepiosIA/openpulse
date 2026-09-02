import { test, expect } from '@playwright/test'
import { loginAsAdmin, authLocators } from './helpers/auth'

/**
 * Tests E2E pour l'authentification.
 *
 * Sélecteurs alignés sur le markup réel de `src/pages/Auth.tsx` (2026-06) :
 *   email = id="signin-email" type="email" (Label « Email »)
 *   password = id="signin-password" type="password" (Label « Mot de passe »)
 *   submit = <Button type="submit">Se connecter</Button>
 *   erreur identifiants = <Alert variant="destructive"> → role="alert"
 *
 * Marqueur post-login (indépendant du rôle) = shell `#main-content`.
 */

test.describe('Authentication', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await loginAsAdmin(page)

    // Le shell applicatif est monté → session authentifiée (tout rôle confondu).
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page).not.toHaveURL(/\/auth(\b|\/|$)/)
  })

  // Ces deux tests doivent voir la page de login : on neutralise le storageState
  // pré-authentifié posé par global-setup (sinon /auth redirige vers le dashboard).
  test.describe('page publique (déconnecté)', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/auth')
      await page.waitForLoadState('networkidle')

      const emailInput = authLocators.emailField(page)
      await expect(emailInput).toBeVisible({ timeout: 10000 })

      await emailInput.fill('invalid@example.com')
      await authLocators.passwordField(page).fill('wrongpassword')
      await authLocators.submitButton(page).click()

      // L'erreur s'affiche via <Alert variant="destructive"> (role="alert") et/ou un toast.
      await expect(
        page.locator('[role="alert"]')
          .or(page.getByText(/erreur|invalide|invalid|incorrect/i))
          .first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should display auth page correctly', async ({ page }) => {
      await page.goto('/auth')
      await page.waitForLoadState('networkidle')

      // Champs email + mot de passe présents.
      await expect(authLocators.emailField(page)).toBeVisible({ timeout: 10000 })
      await expect(authLocators.passwordField(page)).toBeVisible()

      // Bouton de soumission présent.
      await expect(authLocators.submitButton(page)).toBeVisible()
    })
  })
})
