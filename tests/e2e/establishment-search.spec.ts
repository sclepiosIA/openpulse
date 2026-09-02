import { test, expect } from '@playwright/test'
import { navigateAuthenticated } from './helpers/auth'
import { firstEtablissementItem } from './helpers/etablissements'

/**
 * Tests E2E pour la recherche d'établissements
 */

test.describe('Establishment Search', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAuthenticated(page, '/etablissements')
  })

  test('should have a search input', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
  })

  test('should search by name', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    
    await searchInput.fill('CHU')
    await page.waitForTimeout(500) // Debounce
    await page.waitForLoadState('networkidle')
  })

  test('should handle empty search results', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    
    await searchInput.fill('XYZ_NONEXISTENT_999')
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')
    
    // Should show the explicit empty state for the submitted query.
    await expect(page.getByText(/Aucun établissement trouvé/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/XYZ_NONEXISTENT_999/)).toBeVisible({ timeout: 10000 })
  })

  test('should clear search', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    
    await searchInput.fill('test')
    await page.waitForTimeout(500)
    
    await searchInput.clear()
    await page.waitForTimeout(500)
    await page.waitForLoadState('networkidle')
  })

  test('should open detail on click', async ({ page }) => {
    const firstItem = firstEtablissementItem(page)
    await expect(firstItem).toBeVisible({ timeout: 15000 })

    await firstItem.click()
    await expect(page).toHaveURL(/\/etablissements\//)
  })
})
