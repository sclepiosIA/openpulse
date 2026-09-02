import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'

/**
 * Tests E2E pour le module Contrats
 */

test.describe('Contrats', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to contrats page', async ({ page }) => {
    await navigateAuthenticated(page, '/contrats')
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
  })

  test('should display contrats interface', async ({ page }) => {
    await navigateAuthenticated(page, '/contrats')
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 10000 })
  })
})
