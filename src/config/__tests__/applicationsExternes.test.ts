/* @vitest-environment jsdom */

import { getExternalLinksWithConfig } from '@/config/navigationConfig'
import { estApplicationAffichable, type ApplicationExterne } from '@/hooks/shared/useApplicationsExternes'
import { iconeApplication } from '@/config/iconesApplications'

/**
 * Ce que ces contrôles protègent : une application déclarée par l'exploitant
 * doit atteindre le menu, et une application saisie à moitié ne doit PAS
 * l'atteindre. C'est le second point qui compte — le menu portait jusqu'ici un
 * lien codé en dur vers un domaine d'exemple, affiché partout et cliquable
 * dans le vide.
 */

const app = (p: Partial<ApplicationExterne> = {}): ApplicationExterne => ({
  id: 'app-1',
  libelle: 'Ma forge',
  url: 'https://forge.mon-domaine.fr',
  icone: 'code',
  section: 'Technique',
  equipes: [],
  ...p,
})

describe('applications externes déclarées', () => {
  describe('estApplicationAffichable', () => {
    it('accepte une entrée complète en https', () => {
      expect(estApplicationAffichable(app())).toBe(true)
    })

    it('accepte http, que rien ne justifie de refuser sur un réseau interne', () => {
      expect(estApplicationAffichable(app({ url: 'http://intranet.local' }))).toBe(true)
    })

    it('refuse une adresse vide', () => {
      expect(estApplicationAffichable(app({ url: '' }))).toBe(false)
    })

    it('refuse une adresse non analysable', () => {
      expect(estApplicationAffichable(app({ url: 'forge.mon-domaine.fr' }))).toBe(false)
    })

    it("refuse un schéma qui n'est pas du web", () => {
      // `javascript:` dans un href est un vecteur d'exécution ; le refus tient
      // à l'entrée, pas à l'affichage.
      expect(estApplicationAffichable(app({ url: 'javascript:alert(1)' }))).toBe(false)
      expect(estApplicationAffichable(app({ url: 'file:///etc/passwd' }))).toBe(false)
    })

    it('refuse un libellé vide, qui donnerait une entrée de menu sans nom', () => {
      expect(estApplicationAffichable(app({ libelle: '   ' }))).toBe(false)
    })
  })

  describe('remontée dans le menu', () => {
    it("ajoute l'application déclarée aux liens du menu", () => {
      const liens = getExternalLinksWithConfig(undefined, null, undefined, [app()])
      const ajoute = liens.find((l) => l.label === 'Ma forge')
      expect(ajoute).toBeDefined()
      expect(ajoute?.url).toBe('https://forge.mon-domaine.fr')
      expect(ajoute?.section).toBe('Technique')
    })

    it("n'ajoute pas une entrée incomplète", () => {
      const liens = getExternalLinksWithConfig(undefined, null, undefined, [
        app({ id: 'app-2', libelle: 'Sans adresse', url: '' }),
      ])
      expect(liens.some((l) => l.label === 'Sans adresse')).toBe(false)
    })

    it('laisse les équipes indéfinies quand aucune restriction n’est posée', () => {
      const liens = getExternalLinksWithConfig(undefined, null, undefined, [app()])
      expect(liens.find((l) => l.label === 'Ma forge')?.allowedTeams).toBeUndefined()
    })

    it('porte les équipes déclarées', () => {
      const liens = getExternalLinksWithConfig(undefined, null, undefined, [
        app({ equipes: ['direction'] }),
      ])
      expect(liens.find((l) => l.label === 'Ma forge')?.allowedTeams).toEqual(['direction'])
    })

    it('supporte une liste absente sans casser les liens prédéfinis', () => {
      expect(() => getExternalLinksWithConfig(undefined, null, undefined, null)).not.toThrow()
      expect(() => getExternalLinksWithConfig()).not.toThrow()
    })
  })

  describe('résolution des icônes', () => {
    it('rend un composant pour chaque nom connu', () => {
      expect(iconeApplication('code')).toBeTruthy()
      expect(iconeApplication('coffre')).toBeTruthy()
    })

    it("retombe sur une icône générique plutôt que de faire disparaître l'entrée", () => {
      expect(iconeApplication('nom-inconnu')).toBe(iconeApplication('lien'))
    })
  })
})
