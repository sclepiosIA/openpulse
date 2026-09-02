import { LEGAL_LAST_UPDATED, MENTIONS_LEGALES_MD, POLITIQUE_CONFIDENTIALITE_MD } from './legal'

/**
 * Ce test vérifie la FORME des documents légaux, jamais l'identité de
 * l'organisation qui exploite l'instance : OpenPulse est auto-hébergé, chaque
 * exploitant remplit les blocs de src/content/legal.ts sans avoir à toucher
 * aux tests. Une assertion sur une dénomination, une adresse ou un domaine
 * précis reviendrait à figer l'exploitant d'origine.
 */
describe('legal.ts exports', () => {
  it('expose les trois documents attendus, tous en chaîne non vide', () => {
    expect(typeof LEGAL_LAST_UPDATED).toBe('string')
    expect(typeof MENTIONS_LEGALES_MD).toBe('string')
    expect(typeof POLITIQUE_CONFIDENTIALITE_MD).toBe('string')
    expect(LEGAL_LAST_UPDATED.trim().length).toBeGreaterThan(0)
    expect(MENTIONS_LEGALES_MD.trim().length).toBeGreaterThan(0)
    expect(POLITIQUE_CONFIDENTIALITE_MD.trim().length).toBeGreaterThan(0)
  })

  it('propage la date de dernière mise à jour dans les deux documents', () => {
    const marqueur = `Dernière mise à jour : ${LEGAL_LAST_UPDATED}`
    expect(MENTIONS_LEGALES_MD).toContain(marqueur)
    expect(POLITIQUE_CONFIDENTIALITE_MD).toContain(marqueur)
  })

  it('les mentions légales portent les rubriques imposées par la LCEN', () => {
    expect(MENTIONS_LEGALES_MD).toContain('# Mentions légales')
    expect(MENTIONS_LEGALES_MD).toContain('Éditeur')
    expect(MENTIONS_LEGALES_MD).toContain('Directeur de la publication')
    expect(MENTIONS_LEGALES_MD).toContain('Hébergeur')
    expect(MENTIONS_LEGALES_MD).toContain('/politique-confidentialite')
    expect(MENTIONS_LEGALES_MD).toMatch(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)
  })

  it('la politique de confidentialité porte le responsable, les droits et le recours', () => {
    expect(POLITIQUE_CONFIDENTIALITE_MD).toContain('# Politique de confidentialité')
    expect(POLITIQUE_CONFIDENTIALITE_MD).toContain('Responsable du traitement')
    expect(POLITIQUE_CONFIDENTIALITE_MD).toContain('RGPD')
    expect(POLITIQUE_CONFIDENTIALITE_MD).toContain('Vos droits')
    expect(POLITIQUE_CONFIDENTIALITE_MD).toContain('Réclamation')
    expect(POLITIQUE_CONFIDENTIALITE_MD).toMatch(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)
  })

  it('ne livre aucune adresse de messagerie grand public en dur', () => {
    const documents = `${MENTIONS_LEGALES_MD}\n${POLITIQUE_CONFIDENTIALITE_MD}`
    expect(documents).not.toMatch(/@(?:gmail|hotmail|outlook|yahoo|orange|wanadoo|free)\./i)
  })
})
