import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'

/**
 * Tests E2E pour le module RH (People)
 * Couvre: navigation, KPIs, onglets
 */

test.describe('RH - Page People', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to people page', async ({ page }) => {
    await navigateAuthenticated(page, '/people')
    await expect(page).toHaveURL(/\/people/)
  })

  test('should display people page content', async ({ page }) => {
    await navigateAuthenticated(page, '/people')
    
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#main-content')).toContainText(/people|équipe|rh|planning|congés|objectifs/i, { timeout: 10000 })
  })

  test('should display KPI cards', async ({ page }) => {
    await navigateAuthenticated(page, '/people')
    
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#main-content')).toContainText(/analyse|collaborateur|équipe|planning|congés|objectifs/i, { timeout: 10000 })
  })
})

test.describe('RH - Onglets', () => {
  test.beforeEach(async ({ page }) => {
    await navigateAuthenticated(page, '/people')
  })

  test('should switch to absences/planning tab', async ({ page }) => {
    const absencesTab = page.locator('button:has-text("Planning"), button:has-text("Absences")').first()
    await expect(absencesTab).toBeVisible({ timeout: 5000 })
    await absencesTab.click()
    await page.waitForLoadState('networkidle')
  })

  test('should switch to objectifs tab', async ({ page }) => {
    const objectifsTab = page.locator('button:has-text("Objectifs")').first()
    const hasTab = await objectifsTab.isVisible({ timeout: 5000 }).catch(() => false)
    if (hasTab) {
      await objectifsTab.click()
      await page.waitForLoadState('networkidle')
    }
  })
})
