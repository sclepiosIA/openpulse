import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

/**
 * Tests E2E pour le centrage des icônes en sidebar réduite
 */

test.describe('Sidebar - Collapsed State Centering', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    // Le cookie doit viser l'origine réellement testée : `domain: 'localhost'`
    // en dur n'était jamais appliqué contre le live Azure, la sidebar restait
    // donc dépliée et les assertions de centrage échouaient hors local.
    // `url` laisse Playwright déduire domain + path de la baseURL courante.
    await context.addCookies([
      {
        name: 'sidebar:state',
        value: 'false',
        url: baseURL ?? 'http://localhost:8080',
      },
    ])
    
    await loginAsAdmin(page)
    await page.waitForSelector('[data-sidebar="sidebar"]', { timeout: 5000 })
  })

  test('should have properly centered icons in collapsed state', async ({ page }) => {
    const firstButton = page.locator('[data-sidebar="menu-button"]').first()
    await expect(firstButton).toBeVisible()

    const buttonBox = await firstButton.boundingBox()
    const sidebarContainer = page.locator('[data-sidebar="sidebar"]')
    const containerBox = await sidebarContainer.boundingBox()

    expect(buttonBox).toBeTruthy()
    expect(containerBox).toBeTruthy()

    if (buttonBox && containerBox) {
      // Pas d'assertion sur une largeur absolue : 32 px était la taille d'une
      // version antérieure du bouton (elle vaut 40 aujourd'hui). Ce test porte
      // sur le CENTRAGE — figer une dimension le faisait échouer à chaque
      // ajustement de design, sans rien dire de l'alignement.
      expect(buttonBox.width).toBeGreaterThan(0)

      const buttonCenterX = buttonBox.x + buttonBox.width / 2
      const containerCenterX = containerBox.x + containerBox.width / 2
      const horizontalOffset = Math.abs(buttonCenterX - containerCenterX)
      expect(horizontalOffset).toBeLessThanOrEqual(1)
    }
  })

  test('should have no visual overflow', async ({ page }) => {
    const buttons = page.locator('[data-sidebar="menu-button"]')
    // Compter sans attendre renvoyait 0 : les entrées de la barre latérale ne
    // sont rendues qu'après le chargement des permissions.
    await expect(buttons.first()).toBeVisible({ timeout: 30000 })
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i)
      const buttonBox = await button.boundingBox()
      const sidebar = page.locator('[data-sidebar="sidebar"]')
      const sidebarBox = await sidebar.boundingBox()

      if (buttonBox && sidebarBox) {
        expect(buttonBox.x).toBeGreaterThanOrEqual(sidebarBox.x)
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(sidebarBox.x + sidebarBox.width)
      }
    }
  })

  test('should maintain centering on hover', async ({ page }) => {
    const firstButton = page.locator('[data-sidebar="menu-button"]').first()
    const initialBox = await firstButton.boundingBox()
    expect(initialBox).toBeTruthy()

    await firstButton.hover()
    await page.waitForTimeout(200)

    const hoverBox = await firstButton.boundingBox()
    expect(hoverBox).toBeTruthy()

    if (initialBox && hoverBox) {
      expect(Math.abs(hoverBox.x - initialBox.x)).toBeLessThanOrEqual(1)
    }
  })

  test('should show tooltips on icon hover', async ({ page }) => {
    const firstButton = page.locator('[data-sidebar="menu-button"]').first()
    await firstButton.hover()
    await page.waitForTimeout(400)

    const tooltip = page.locator('[role="tooltip"]')
    await expect(tooltip).toBeVisible()
    const tooltipText = await tooltip.textContent()
    expect(tooltipText).toBeTruthy()
  })
})
