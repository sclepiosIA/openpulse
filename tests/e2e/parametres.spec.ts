import { test, expect } from '@playwright/test'
import { navigateAuthenticated } from './helpers/auth'

test.describe('Module Paramètres', () => {
  test('should display the settings page', async ({ page }) => {
    await navigateAuthenticated(page, '/parametres')

    // Verify settings heading
    await expect(page.locator('h1, h2').filter({ hasText: /paramètre|réglage|administration|settings/i }).first()).toBeVisible({ timeout: 10000 })
  })

  test('should show settings tabs or sections', async ({ page }) => {
    await navigateAuthenticated(page, '/parametres')

    // Should show tab navigation or section cards
    const sections = page.locator('[role="tablist"], [class*="tab"], [class*="card"]')
    await expect(sections.first()).toBeVisible({ timeout: 10000 })
  })
})
