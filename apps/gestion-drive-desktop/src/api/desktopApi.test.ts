import { afterEach, describe, expect, it, vi } from 'vitest'
import { gestionWebBaseUrl, gestionWebUrl } from './desktopApi'

/**
 * L'origine des WebViews est réglable à la construction, par
 * `VITE_OPENPULSE_WEB_URL`. Cette épreuve épinglait la valeur de repli en dur :
 * elle passait donc sur une construction générique, et rougissait sur toute
 * construction visant une instance réelle — c'est-à-dire exactement celles
 * qu'on livre. Ce qui est éprouvé ici, ce sont les DEUX chemins.
 */
describe('Gestion Desktop same-site origin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('retombe sur un gabarit neutre quand aucune instance n’est configurée', () => {
    vi.stubEnv('VITE_OPENPULSE_WEB_URL', '')

    const base = gestionWebBaseUrl()
    expect(base).toBe('https://espace.exploitant.example.org')
    expect(gestionWebUrl('/backend?tool=gitea')).toBe(`${base}/backend?tool=gitea`)
  })

  it('emploie l’instance configurée à la construction, sans barre oblique finale', () => {
    vi.stubEnv('VITE_OPENPULSE_WEB_URL', 'https://mon-instance.example/')

    expect(gestionWebBaseUrl()).toBe('https://mon-instance.example')
    expect(gestionWebUrl('backend')).toBe('https://mon-instance.example/backend')
  })

  it('construit la même URL que le chemin soit préfixé ou non', () => {
    vi.stubEnv('VITE_OPENPULSE_WEB_URL', 'https://mon-instance.example')

    expect(gestionWebUrl('/documents')).toBe(gestionWebUrl('documents'))
  })
})
