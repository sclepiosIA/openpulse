import { test, expect } from '@playwright/test'
import { navigateAuthenticated } from './helpers/auth'

test.describe('Module Support', () => {
  test('should display the support page with tickets', async ({ page }) => {
    await navigateAuthenticated(page, '/support')

    // Verify page heading
    await expect(page.locator('h1, h2').filter({ hasText: /support|tickets/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('should display support KPIs or empty state', async ({ page }) => {
    await navigateAuthenticated(page, '/support')

    // Should have some card-based layout (KPIs or ticket list)
    const cards = page.locator('[class*="card"], [data-testid*="support"]')
    await expect(cards.first()).toBeVisible({ timeout: 10000 })
  })
})
