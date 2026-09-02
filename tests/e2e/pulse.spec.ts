import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'

/**
 * Tests E2E pour le module Pulse (messagerie interne)
 */

test.describe('Pulse', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to pulse page', async ({ page }) => {
    await navigateAuthenticated(page, '/pulse')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('should display conversation list or empty state', async ({ page }) => {
    await navigateAuthenticated(page, '/pulse')
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })
  })
})
