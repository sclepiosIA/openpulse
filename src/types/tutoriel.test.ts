import { TUTORIEL_CATEGORIES } from './tutoriel'

describe('tutoriel module', () => {
  it('décrit des catégories utilisables : identifiants uniques, libellés remplis', () => {
    expect(Array.isArray(TUTORIEL_CATEGORIES)).toBe(true)
    expect(TUTORIEL_CATEGORIES.length).toBeGreaterThan(0)

    const ids = TUTORIEL_CATEGORIES.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const categorie of TUTORIEL_CATEGORIES) {
      expect(categorie.label.trim(), categorie.id).not.toBe('')
      expect(categorie.description.trim(), categorie.id).not.toBe('')
    }
  })

  it('doit garantir que chaque catégorie a au moins un module', () => {
    for (const category of TUTORIEL_CATEGORIES) {
      expect(Array.isArray(category.modules)).toBe(true)
      expect(category.modules.length).toBeGreaterThan(0)
    }
  })

  it('doit garantir que tous les modules référencés sont des chaînes non vides', () => {
    const allModules: string[] = []
    for (const category of TUTORIEL_CATEGORIES) {
      for (const moduleId of category.modules) {
        expect(typeof moduleId).toBe('string')
        expect(moduleId.trim().length).toBeGreaterThan(0)
        allModules.push(moduleId)
      }
    }
    // Vérifie qu'il n'y a pas de doublons évidents dans les modules critiques
    const uniqueModules = new Set(allModules)
    expect(uniqueModules.size).toBe(allModules.length)
  })
})