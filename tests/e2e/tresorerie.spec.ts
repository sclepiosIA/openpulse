import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'

/**
 * Tests E2E pour le module Trésorerie
 * Couvre: dashboard, onglets revenus/dépenses/Qonto
 */

test.describe('Trésorerie', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to tresorerie page', async ({ page }) => {
    await navigateAuthenticated(page, '/tresorerie')
    await expect(page).toHaveURL(/\/tresorerie/)
  })

  test('should display tresorerie dashboard content', async ({ page }) => {
    await navigateAuthenticated(page, '/tresorerie')
    
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#main-content')).toContainText(/trésorerie|revenus|dépenses|banque|solde/i, { timeout: 10000 })
  })

  test('should switch to revenus tab', async ({ page }) => {
    await navigateAuthenticated(page, '/tresorerie')
    
    const revenusTab = page.locator('button:has-text("Revenus")').first()
    await expect(revenusTab).toBeVisible({ timeout: 5000 })
    await revenusTab.click()
    await page.waitForLoadState('networkidle')
  })

  test('should switch to depenses tab', async ({ page }) => {
    await navigateAuthenticated(page, '/tresorerie')
    
    const depensesTab = page.locator('button:has-text("Dépenses")').first()
    await expect(depensesTab).toBeVisible({ timeout: 5000 })
    await depensesTab.click()
    await page.waitForLoadState('networkidle')
  })

  test('should switch to qonto tab', async ({ page }) => {
    await navigateAuthenticated(page, '/tresorerie')
    
    const qontoTab = page.locator('button:has-text("Qonto")').first()
    await expect(qontoTab).toBeVisible({ timeout: 5000 })
    await qontoTab.click()
    await page.waitForLoadState('networkidle')
  })
})
