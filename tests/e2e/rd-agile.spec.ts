import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'

/**
 * Tests E2E pour le module R&D Agile
 * Couvre: navigation, onglets backlog/board/analytics/gantt
 */

test.describe('R&D Agile', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to R&D page', async ({ page }) => {
    await page.click('text=R&D')
    await expect(page).toHaveURL(/\/rd/)
  })

  test('should display R&D dashboard content', async ({ page }) => {
    await navigateAuthenticated(page, '/rd')
    
    // Le seul h1 de la page est un `sr-only` (lecteurs d'écran), invisible par
    // construction : `.first()` le sélectionnait et le test échouait sur
    // « hidden » alors que la page était bien rendue. Les titres réellement
    // affichés sont des h3, on accepte donc tout niveau de titre visible.
    await expect(
      page.locator('h1:visible, h2:visible, h3:visible').first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('should switch to backlog tab', async ({ page }) => {
    await navigateAuthenticated(page, '/rd')
    
    const backlogTab = page.locator('button:has-text("Backlog")').first()
    await expect(backlogTab).toBeVisible({ timeout: 5000 })
    await backlogTab.click()
    await page.waitForLoadState('networkidle')
  })

  test('should switch to board tab', async ({ page }) => {
    await navigateAuthenticated(page, '/rd')
    
    const boardTab = page.locator('button:has-text("Board"), button:has-text("Sprint")').first()
    await expect(boardTab).toBeVisible({ timeout: 5000 })
    await boardTab.click()
    await page.waitForLoadState('networkidle')
  })

  test('should switch to analytics tab', async ({ page }) => {
    await navigateAuthenticated(page, '/rd')
    
    const analyticsTab = page.locator('button:has-text("Analytics"), button:has-text("Statistiques")').first()
    await expect(analyticsTab).toBeVisible({ timeout: 5000 })
    await analyticsTab.click()
    await page.waitForLoadState('networkidle')
  })

  test('should switch to gantt tab', async ({ page }) => {
    await navigateAuthenticated(page, '/rd')
    
    const ganttTab = page.locator('button:has-text("Gantt"), button:has-text("Timeline")').first()
    await expect(ganttTab).toBeVisible({ timeout: 5000 })
    await ganttTab.click()
    await page.waitForLoadState('networkidle')
  })
})
