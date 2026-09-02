import Papa from 'papaparse'
import { exportEtablissementsCsv } from './exportEtablissementsCsv'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

// Hoisted stable data for mocks
const { MOCK_PAPA_UNPARSE_RETURN } = vi.hoisted(() => ({
  MOCK_PAPA_UNPARSE_RETURN: 'Nom;Type;Ville;Région;Statut;Progression (%);Date signature;Type offre;Adresse;Code postal;Téléphone;Email;Notes;Créé le;Modifié le'
}))

// Stable mock for debug module (no network or side effects)
vi.mock('@/lib/debug', () => ({
  debug: { warn: vi.fn() }
}))

// Spy on Papa.unparse to return a stable string
vi.spyOn(Papa, 'unparse').mockReturnValue(MOCK_PAPA_UNPARSE_RETURN)

describe('exportEtablissementsCsv', () => {
  let createdAnchor: any = null
  let appendedToBody: any = null

  // Mock DOM interactions to simulate download without real IO
  beforeAll(() => {
    // Time control for filename
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    createdAnchor = null
    appendedToBody = null

    // Mock URL creation
    ;(window as any).URL = {
      createObjectURL: vi.fn(() => 'blobUrl'),
      revokeObjectURL: vi.fn()
    }

    // Mock document.createElement to capture anchor
    ;(document.createElement as any) = vi.fn((tag: string) => {
      createdAnchor = {
        tagName: tag.toUpperCase(),
        href: '',
        download: '',
        style: { display: 'none' },
        parentNode: null,
        click: vi.fn()
      }
      return createdAnchor
    })

    // Mock DOM insertion/removal
    ;(document.body.appendChild as any) = vi.fn((el: any) => {
      appendedToBody = el
      el.parentNode = document.body
    })

    ;(document.body.removeChild as any) = vi.fn((el: any) => {
      if (el === appendedToBody) {
        appendedToBody = null
        el.parentNode = null
      }
    })
  })

  it('retourne null lorsque la liste est vide (undefined, null ou [])', () => {
    const resUndefined = exportEtablissementsCsv(undefined)
    const resNull = exportEtablissementsCsv(null as any)
    const resEmpty = exportEtablissementsCsv([])

    expect(resUndefined).toBeNull()
    expect(resNull).toBeNull()
    expect(resEmpty).toBeNull()

    // Aucune creation d'élément DOM lors d'un appel vide
    expect((document.createElement as any)).not.toHaveBeenCalled()
  })

  it(' génère le CSV et déclenche le téléchargement avec un nom de fichier stable', () => {
    // Fix system time to guarantee filename, e.g. 2023-07-08 -> 20230708
    const fixedDate = new Date('2023-07-08T00:00:00Z')
    vi.setSystemTime(fixedDate)

    // Exemple d'établissement
    const etablissements = [
      {
        id: 'e1',
        nom: 'Etablissement A',
        type: 'TypeA',
        ville: 'VilleA',
        region: 'R1',
        statut: 'Actif',
        progression: 50,
        date_signature: '2020-01-02T00:00:00Z',
        type_offre: 'Offre1',
        adresse: 'Adresse 1',
        code_postal: '75001',
        telephone: '0102030405',
        email: 'a@example.com',
        notes: 'Note',
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2020-01-02T00:00:00Z'
      }
    ]

    const result = exportEtablissementsCsv(etablissements as any)

    expect(result).toBe('etablissements-20230708.csv')

    // Vérification du téléchargement déclenché
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(createdAnchor).toBeTruthy()
    expect(createdAnchor.download).toBe('etablissements-20230708.csv')
    expect(createdAnchor.href).toBe('blobUrl')
    expect(createdAnchor.click).toHaveBeenCalled()
    expect(window.URL.createObjectURL).toHaveBeenCalled()
    expect(document.body.appendChild).toHaveBeenCalledWith(createdAnchor)
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blobUrl')
    expect(document.body.removeChild).toHaveBeenCalledWith(createdAnchor)

    // Vérification que Papa.unparse a été appelée avec les données attendues
    // Le premier arg est une liste d'objets avec des clés 'Nom','Type', etc.
    const unparseArg = (Papa.unparse as any).mock.calls[0][0]
    expect(Array.isArray(unparseArg)).toBe(true)
    expect(unparseArg[0]).toHaveProperty('Nom', etablissements[0].nom)
  })
})