import { test, expect } from '@playwright/test'
import { navigateAuthenticated } from './helpers/auth'

test.describe('Module Profil', () => {
  test('should display the profile page', async ({ page }) => {
    await navigateAuthenticated(page, '/profil')

    // Verify profile content loads
    await expect(page.locator('h1, h2').filter({ hasText: /profil|mon compte/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('should show user information fields', async ({ page }) => {
    await navigateAuthenticated(page, '/profil')

    // Should have form fields for user info.
    // `:visible` est nécessaire : la page rend d'abord un squelette dont les
    // premiers champs sont masqués, et `.first()` tombait dessus — le test
    // échouait sur « hidden » alors que le formulaire était bien affiché.
    const inputs = page.locator('input[type="text"]:visible, input[type="email"]:visible')
    await expect(inputs.first()).toBeVisible({ timeout: 15000 })
  })
})
