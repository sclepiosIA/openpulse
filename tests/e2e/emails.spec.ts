import { test, expect } from '@playwright/test'
import { loginAsAdmin, navigateAuthenticated } from './helpers/auth'

/**
 * Tests E2E pour le module Emails
 */

test.describe('Emails', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should navigate to emails page', async ({ page }) => {
    await navigateAuthenticated(page, '/emails')
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 })
  })

  test('should display email interface elements', async ({ page }) => {
    await navigateAuthenticated(page, '/emails')
    // Should show email list or empty state
    await expect(page.locator('main').first()).toBeVisible({ timeout: 10000 })
  })
})
