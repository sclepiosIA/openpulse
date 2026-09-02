import Papa from "papaparse"
import { debug } from "@/lib/debug"
import type { Etablissement } from "@/hooks/crm/useEtablissements"

/**
 * Génère et déclenche le téléchargement d'un CSV des établissements
 * (séparateur `;` + BOM UTF-8 pour Excel français).
 * Extrait depuis `src/pages/Etablissements.tsx` (S88).
 *
 * @returns le nom de fichier généré, ou `null` si la liste est vide.
 */
export function exportEtablissementsCsv(etablissements: Etablissement[] | undefined | null): string | null {
  if (!etablissements || etablissements.length === 0) return null

  const csvData = etablissements.map((e) => ({
    Nom: e.nom,
    Type: e.type,
    Ville: e.ville,
    Région: e.region,
    Statut: e.statut,
    'Progression (%)': e.progression || 0,
    'Date signature': e.date_signature ? new Date(e.date_signature).toLocaleDateString('fr-FR') : '',
    'Type offre': e.type_offre || '',
    Adresse: e.adresse || '',
    'Code postal': e.code_postal || '',
    Téléphone: e.telephone || '',
    Email: e.email || '',
    Notes: e.notes || '',
    'Créé le': new Date(e.created_at).toLocaleDateString('fr-FR'),
    'Modifié le': new Date(e.updated_at).toLocaleDateString('fr-FR'),
  }))

  const csv = Papa.unparse(csvData, { delimiter: ';', header: true })
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateString = new Date().toISOString().split('T')[0].replace(/-/g, '')
  const filename = `etablissements-${dateString}.csv`

  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  try {
    if (link.parentNode === document.body) document.body.removeChild(link)
  } catch (cleanupError) {
    debug.warn('Warning: DOM element cleanup failed:', cleanupError)
  } finally {
    window.URL.revokeObjectURL(url)
  }

  return filename
}
