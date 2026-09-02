import { test, expect } from '@playwright/test'
import { navigateAuthenticated } from './helpers/auth'

test.describe('Module Calendrier', () => {
  test('should display the calendar page', async ({ page }) => {
    await navigateAuthenticated(page, '/calendrier')

    // Verify calendar heading or view
    await expect(page.locator('h1, h2, [class*="calendar"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('should display calendar navigation controls', async ({ page }) => {
    await navigateAuthenticated(page, '/calendrier')

    // Should show day/week/month navigation or today button
    const controls = page.locator('button').filter({ hasText: /aujourd|today|mois|semaine|jour/i })
    await expect(controls.first()).toBeVisible({ timeout: 10000 })
  })
})
