/* @vitest-environment jsdom */

import { tutorielModules, getModuleById } from '@/lib/tutoriel-content'
import { TUTORIEL_CATEGORIES } from '@/types/tutoriel'

/**
 * Ce fichier remplace vingt-six instantanés littéraux, un par module, qui
 * réaffirmaient chaîne par chaîne ce que le module contenait déjà. Un tel test
 * ne peut rien détecter : il n'échoue que si on change le texte, jamais si le
 * texte est faux. Il coûtait pourtant sa relecture à chaque retouche.
 *
 * Les contrôles ci-dessous portent sur des propriétés qui, elles, peuvent être
 * violées par une modification de bonne foi : un identifiant en double casse
 * la navigation, une catégorie qui cite un module absent laisse une entrée
 * morte dans le sommaire, et le vocabulaire du secteur d'origine peut revenir
 * par un simple copier-coller.
 */

/**
 * Les APERÇUS sont des composants : leur texte n'est pas dans les données du
 * module, il est écrit dans le JSX. La première version de cette garde ne
 * regardait que les données, et laissait donc passer soixante-sept occurrences
 * du vocabulaire d'origine — affichées à l'écran, dans les aperçus vivants.
 *
 * `import.meta.glob` lit les sources à la construction : le contrôle porte sur
 * le texte du fichier, seul moyen d'atteindre du JSX depuis une épreuve.
 */
const SOURCES_APERCUS = import.meta.glob('/src/components/tutoriel/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('contenu du tutoriel', () => {
  it("n'expose aucun identifiant de module en double", () => {
    const ids = tutorielModules.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('rend chaque module par son identifiant', () => {
    for (const module of tutorielModules) {
      expect(getModuleById(module.id)).toBe(module)
    }
    expect(getModuleById('module-inexistant')).toBeUndefined()
  })

  it("n'a pas de section ni d'étape sans identifiant unique", () => {
    for (const module of tutorielModules) {
      const sections = module.sections.map((s) => s.id)
      expect(new Set(sections).size, `sections de ${module.id}`).toBe(sections.length)
      for (const section of module.sections) {
        const etapes = section.steps.map((s) => s.id)
        expect(new Set(etapes).size, `étapes de ${module.id}/${section.id}`).toBe(etapes.length)
      }
    }
  })

  it('remplit les champs que la page affiche réellement', () => {
    for (const module of tutorielModules) {
      expect(module.title.trim(), module.id).not.toBe('')
      expect(module.description.trim(), module.id).not.toBe('')
      // Le sommaire additionne `parseInt(estimatedTime)` : une valeur qui ne
      // commence pas par un nombre y compte pour NaN et efface le total.
      expect(Number.isFinite(parseInt(module.estimatedTime, 10)), module.id).toBe(true)
      expect(module.sections.length, module.id).toBeGreaterThan(0)
      for (const section of module.sections) {
        expect(section.steps.length, `${module.id}/${section.id}`).toBeGreaterThan(0)
        for (const etape of section.steps) {
          expect(etape.title.trim(), `${module.id}/${section.id}/${etape.id}`).not.toBe('')
          expect(etape.content.trim(), `${module.id}/${section.id}/${etape.id}`).not.toBe('')
        }
      }
    }
  })

  it('ne cite dans les catégories que des modules qui existent', () => {
    const connus = new Set(tutorielModules.map((m) => m.id))
    for (const categorie of TUTORIEL_CATEGORIES) {
      for (const id of categorie.modules) {
        expect(connus.has(id), `catégorie ${categorie.id} cite ${id}`).toBe(true)
      }
    }
  })

  it('range chaque module dans au moins une catégorie', () => {
    const rangés = new Set(TUTORIEL_CATEGORIES.flatMap((c) => c.modules))
    for (const module of tutorielModules) {
      expect(rangés.has(module.id), `${module.id} n'apparaît dans aucune catégorie`).toBe(true)
    }
  })

  /**
   * Le tutoriel a été écrit pour un éditeur du secteur hospitalier. Les
   * exemples qui en venaient — un CHU, un EHPAD, un dossier patient — n'ont
   * aucun sens pour une organisation qui adopte la distribution. Ils ont été
   * remplacés ; ce contrôle empêche qu'ils reviennent.
   *
   * « établissement » n'y figure pas : c'est l'entité du produit, présente
   * dans le menu et dans la base. « score de santé » non plus : c'est un
   * indicateur de relation client, sans rapport avec le soin.
   */
  it("ne réintroduit pas le vocabulaire du secteur d'origine", () => {
    const proscrits = /\bCHU\b|\bCHRU\b|\bGHT\b|\bDPI\b|EHPAD|hôpital|hospitali|soignant|patient|polyclinique/i
    const fautes: string[] = []
    for (const module of tutorielModules) {
      const textes = [module.title, module.description]
      for (const section of module.sections) {
        textes.push(section.title, section.description)
        for (const etape of section.steps) {
          textes.push(etape.title, etape.content, etape.detailedContent ?? '', etape.example ?? '', etape.tip ?? '', etape.warning ?? '')
        }
      }
      for (const texte of textes) {
        const trouve = texte.match(proscrits)
        if (trouve) fautes.push(`${module.id} : « ${trouve[0]} » dans « ${texte.slice(0, 70)}… »`)
      }
    }
    expect(fautes).toEqual([])
  })

  /**
   * Même garde, sur les aperçus. Le motif exclut « patientez » — un mot
   * français ordinaire que « patient » captait, et un contrôle qui crie à tort
   * finit par être désarmé.
   */
  it("ne réintroduit pas le vocabulaire d'origine dans les aperçus", () => {
    const proscrits = /\bCHU\b|\bCHR\b|CHRU|\bGHT\b|\bDPI\b|EHPAD|hôpit|hospitali|soignan|\bpatients?\b|polyclinique/i
    const fautes: string[] = []
    for (const [chemin, source] of Object.entries(SOURCES_APERCUS)) {
      for (const ligne of source.split('\n')) {
        const trouve = ligne.match(proscrits)
        if (trouve) {
          fautes.push(`${chemin.split('/').pop()} : « ${trouve[0]} » dans « ${ligne.trim().slice(0, 60)}… »`)
        }
      }
    }
    expect(fautes).toEqual([])
  })

  it('lit réellement des sources — sinon la garde précédente ne prouve rien', () => {
    // Un glob qui ne rend rien rendrait le contrôle ci-dessus toujours vert.
    expect(Object.keys(SOURCES_APERCUS).length).toBeGreaterThan(20)
  })
})
