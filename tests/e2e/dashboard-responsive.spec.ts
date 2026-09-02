import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

/**
 * Tests E2E de responsivité du dashboard
 */

test.describe('Dashboard Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('should not have horizontal scroll on iPhone SE', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForLoadState('networkidle')
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('should not have horizontal scroll on iPhone 12/14', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForLoadState('networkidle')
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('should not have horizontal scroll on iPad', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForLoadState('networkidle')
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('should render dashboard heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Tableau de bord")')).toBeVisible({ timeout: 10000 })
  })

  test('charts should fit within containers on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForLoadState('networkidle')
    
    const chartContainers = page.locator('[data-chart]')
    const count = await chartContainers.count()
    
    for (let i = 0; i < count; i++) {
      const chart = chartContainers.nth(i)
      const boundingBox = await chart.boundingBox()
      
      if (boundingBox) {
        expect(boundingBox.width).toBeLessThanOrEqual(375)
        expect(boundingBox.x).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
