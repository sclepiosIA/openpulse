import { describe, it, expect, vi, afterEach } from 'vitest'

import { SECTEURS, resoudreSecteur, SECTEUR_PAR_DEFAUT } from '../secteurs'

/**
 * Le secteur est résolu au chargement du module, depuis `import.meta.env`.
 * Pour éprouver une autre configuration il faut donc rejouer l'import après
 * avoir posé les variables.
 */
async function chargerAvec(
  variables: Record<string, string>,
): Promise<typeof import('../secteurs')> {
  for (const [cle, valeur] of Object.entries(variables)) {
    vi.stubEnv(cle, valeur)
  }
  vi.resetModules()
  return import('../secteurs')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('secteurs', () => {
  it('choisit le secteur générique par défaut', async () => {
    const { SECTEUR } = await chargerAvec({})
    expect(SECTEUR.cle).toBe(SECTEUR_PAR_DEFAUT)
    expect(SECTEUR.cle).toBe('generique')
  })

  it("le défaut ne présuppose ni pays, ni secteur d'activité", async () => {
    const { SECTEUR } = await chargerAvec({})

    // C'est le cœur de la demande : quelqu'un qui installe sans rien régler ne
    // doit pas se voir proposer la typologie hospitalière française.
    for (const sectoriel of ['CH', 'CHU', 'GHT', 'ESPIC', 'HIA']) {
      expect(SECTEUR.typesEntite).not.toContain(sectoriel)
    }
    expect(SECTEUR.zones).not.toContain('Île-de-France')
    expect(SECTEUR.systemesEnPlace).not.toContain('Hopital Manager')
    expect(SECTEUR.statutsImport).not.toContain('Dans les RDV post EME')
    expect(SECTEUR.lexique.entite).toBe('Organisation')
  })

  it('restaure les listes historiques avec le préréglage santé', async () => {
    const { SECTEUR } = await chargerAvec({ VITE_SECTEUR_METIER: 'sante-fr' })

    // L'exploitant d'origine ne doit rien perdre : une seule variable lui rend
    // exactement ce qu'il avait.
    expect(SECTEUR.typesEntite).toEqual([
      'CH', 'CHU', 'GHT', 'ESPIC', 'Privé', 'Clinique', 'HIA',
    ])
    expect(SECTEUR.zones).toHaveLength(13)
    expect(SECTEUR.zones).toContain('Île-de-France')
    expect(SECTEUR.systemesEnPlace).toHaveLength(19)
    expect(SECTEUR.systemesEnPlace).toContain('Hopital Manager')
    expect(SECTEUR.lexique.entite).toBe('Établissement')
    expect(SECTEUR.lexique.systemeEnPlace).toBe('DPI')
  })

  it('accepte des listes propres, sans passer par un préréglage', async () => {
    const { SECTEUR } = await chargerAvec({
      VITE_REFERENTIEL_TYPES_ENTITE: 'Étude, Agence,  Franchise ',
      VITE_REFERENTIEL_ZONES: 'Nord,Sud',
      VITE_LEXIQUE_ENTITE: 'Client',
      VITE_LEXIQUE_ENTITES: 'Clients',
    })

    // Les espaces autour des entrées sont retirés : une liste écrite à la main
    // dans un fichier d'environnement en contient presque toujours.
    expect(SECTEUR.typesEntite).toEqual(['Étude', 'Agence', 'Franchise'])
    expect(SECTEUR.zones).toEqual(['Nord', 'Sud'])
    expect(SECTEUR.lexique.entite).toBe('Client')
    expect(SECTEUR.lexique.entites).toBe('Clients')
    // Ce qui n'a pas été surchargé reste celui du secteur de base.
    expect(SECTEUR.cle).toBe('generique')
  })

  it('une surcharge prime sur le préréglage choisi', async () => {
    const { SECTEUR } = await chargerAvec({
      VITE_SECTEUR_METIER: 'sante-fr',
      VITE_REFERENTIEL_TYPES_ENTITE: 'Cabinet,Groupe',
    })
    expect(SECTEUR.typesEntite).toEqual(['Cabinet', 'Groupe'])
    // Le reste du préréglage santé demeure.
    expect(SECTEUR.zones).toContain('Île-de-France')
  })

  it('retombe sur le générique si la clé de secteur est inconnue', async () => {
    // Une variable d'affichage mal orthographiée ne doit pas empêcher de
    // démarrer : elle doit donner des listes neutres.
    const { SECTEUR } = await chargerAvec({ VITE_SECTEUR_METIER: 'sante-francais' })
    expect(SECTEUR.cle).toBe('generique')
  })

  it('resoudreSecteur retombe sur le générique pour toute clé absente', () => {
    expect(resoudreSecteur(undefined).cle).toBe('generique')
    expect(resoudreSecteur('').cle).toBe('generique')
    expect(resoudreSecteur('inexistant').cle).toBe('generique')
    expect(resoudreSecteur('sante-fr').cle).toBe('sante-fr')
  })

  it('chaque secteur déclaré est complet', () => {
    // Un préréglage auquel il manque une liste laisserait un écran vide sans
    // que rien ne le signale.
    for (const [cle, secteur] of Object.entries(SECTEURS)) {
      expect(secteur.cle, `clé de ${cle}`).toBe(cle)
      expect(secteur.libelle.length, `libellé de ${cle}`).toBeGreaterThan(0)
      expect(secteur.typesEntite.length, `typesEntite de ${cle}`).toBeGreaterThan(0)
      expect(secteur.systemesEnPlace.length, `systemesEnPlace de ${cle}`).toBeGreaterThan(0)
      expect(secteur.zones.length, `zones de ${cle}`).toBeGreaterThan(0)
      expect(secteur.paliers.length, `paliers de ${cle}`).toBeGreaterThan(0)
      expect(secteur.statutsImport.length, `statutsImport de ${cle}`).toBeGreaterThan(0)
      for (const mot of Object.values(secteur.lexique)) {
        expect(mot.length, `lexique de ${cle}`).toBeGreaterThan(0)
      }
    }
  })
})
