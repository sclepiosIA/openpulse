import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'
import { firstEtablissementItem } from './helpers/etablissements'

/**
 * Tests E2E pour la gestion des tâches
 */

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to etablissements and see content', async ({ page }) => {
    await navigateAuthenticated(page, '/etablissements')
    await expect(page).toHaveURL(/\/etablissements/)
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
  })

  test('should open establishment detail', async ({ page }) => {
    await navigateAuthenticated(page, '/etablissements')
    
    // Wait for list to load
    const firstItem = firstEtablissementItem(page)
    await expect(firstItem).toBeVisible({ timeout: 15000 })
    await firstItem.click()
    
    // Verify detail page
    await expect(page).toHaveURL(/\/etablissements\//)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })
})
