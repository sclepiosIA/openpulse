import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'
import { firstEtablissementItem } from './helpers/etablissements'

/**
 * Tests E2E pour le module CRM
 * Couvre: établissements, pipeline, contacts, tâches
 */

test.describe('CRM - Établissements', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to etablissements page', async ({ page }) => {
    await navigateAuthenticated(page, '/etablissements')
    await expect(page).toHaveURL(/\/etablissements/)
  })

  test('should display etablissements list', async ({ page }) => {
    await navigateAuthenticated(page, '/etablissements')
    
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })

    // Le shell applicatif est monté vers 3 s, mais la liste n'est hydratée
    // qu'après le chargement des données (~11 s mesurées sur le live Azure).
    // L'ancienne assertion acceptait n'importe quel `li` — y compris ceux de la
    // navigation — et restait donc verte sur une liste vide : faux positif.
    // On exige désormais une vraie carte (ou ligne) d'établissement.
    await expect(firstEtablissementItem(page)).toBeVisible({ timeout: 20000 })
  })

  test('should search etablissements', async ({ page }) => {
    await navigateAuthenticated(page, '/etablissements')

    const searchInput = page.locator('input[placeholder*="Rechercher"], input[type="search"]').first()
    await expect(searchInput).toBeVisible({ timeout: 15000 })

    await searchInput.fill('CHU')
    await page.waitForTimeout(400) // Debounce
    await expect(page.locator('#main-content')).toContainText(/CHU|Aucun établissement trouvé|aucun résultat/i, { timeout: 10000 })
  })

  test('should open etablissement detail', async ({ page }) => {
    await navigateAuthenticated(page, '/etablissements')
    
    // Click on first establishment row/card
    const firstItem = firstEtablissementItem(page)
    await expect(firstItem).toBeVisible({ timeout: 15000 })
    await firstItem.click()
    
    // Should navigate to detail page
    await expect(page).toHaveURL(/\/etablissements\//)
  })
})

test.describe('CRM - Pipeline de Vente', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to prospects page', async ({ page }) => {
    await navigateAuthenticated(page, '/prospects')
    await expect(page).toHaveURL(/\/prospects/)
  })

  test('should display pipeline page content', async ({ page }) => {
    await navigateAuthenticated(page, '/prospects')
    
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('#main-content')).toContainText(/pipeline|prospect|commercial/i, { timeout: 10000 })
  })
})

test.describe('CRM - Déploiement', () => {
  test('should navigate to deploiement page', async ({ page }) => {
    await loginAsAdmin(page)
    await navigateAuthenticated(page, '/deploiement')
    await expect(page).toHaveURL(/\/deploiement/)
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('CRM - Production', () => {
  test('should navigate to production page', async ({ page }) => {
    await loginAsAdmin(page)
    await navigateAuthenticated(page, '/production')
    await expect(page).toHaveURL(/\/production/)
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
  })
})
