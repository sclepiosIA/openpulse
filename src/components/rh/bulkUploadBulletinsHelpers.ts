import { supabase } from '@/integrations/supabase/client'
import { debug } from '@/lib/debug'

export interface ParsedBulletinData {
  mois: string | null
  salaire_brut: number | null
  salaire_net: number | null
  salaire_net_a_payer?: number | null
  cotisations_salariales: number | null
  cotisations_patronales: number | null
  primes?: number | null
  heures_supplementaires?: number | null
  confidence: number
  employe?: {
    nom: string | null
    prenom: string | null
    numero_securite_sociale?: string | null
  }
}

export interface BulletinUploadResult {
  fileName: string
  status: 'pending' | 'analyzing' | 'uploading' | 'success' | 'error'
  error?: string
  employeeName?: string
  profileId?: string
  matchType?: 'exact' | 'partial' | 'none' | 'manual'
  mois?: string
  salaireBrut?: number
  salaireNet?: number
  parsedData?: ParsedBulletinData
  canAssociateManually?: boolean
  manualProfileId?: string
}

/**
 * Sanitise un nom de fichier pour le stockage Supabase
 */
export const sanitizeFileName = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.')
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName
  const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ''

  const sanitizedName = name
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase()

  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()
  return sanitizedName + sanitizedExtension
}

export const normalizeString = (str: string) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const normalizeMonthToDate = (monthString: string): string => {
  if (/^\d{4}-\d{2}$/.test(monthString)) return `${monthString}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(monthString)) return monthString.substring(0, 8) + '01'
  return monthString
}

export const findProfileByName = async (
  nom: string | null | undefined,
  prenom: string | null | undefined,
  _numSecu?: string | null
): Promise<{ profileId: string | null; matchType: 'exact' | 'partial' | 'none' }> => {
  const { data: profilesData, error } = await supabase.rpc('get_profiles_public')
  if (error) {
    debug.error('get_profiles_public error:', error)
    return { profileId: null, matchType: 'none' }
  }

  const profiles = profilesData || []
  if (profiles.length === 0 || !nom || !prenom) {
    return { profileId: null, matchType: 'none' }
  }

  const nomNormalized = normalizeString(nom)
  const prenomNormalized = normalizeString(prenom)

  const exactMatch = profiles.find((p: any) => {
    const pNom = normalizeString(p.nom || '')
    const pPrenom = normalizeString(p.prenom || '')
    return pNom === nomNormalized && pPrenom === prenomNormalized
  })
  if (exactMatch) return { profileId: exactMatch.id, matchType: 'exact' }

  const reversedMatch = profiles.find((p: any) => {
    const pNom = normalizeString(p.nom || '')
    const pPrenom = normalizeString(p.prenom || '')
    return pNom === prenomNormalized && pPrenom === nomNormalized
  })
  if (reversedMatch) return { profileId: reversedMatch.id, matchType: 'exact' }

  const partialMatch = profiles.find((p: any) => {
    const pNom = normalizeString(p.nom || '')
    const pPrenom = normalizeString(p.prenom || '')
    return (
      pPrenom === prenomNormalized &&
      (pNom.startsWith(nomNormalized) || nomNormalized.startsWith(pNom))
    )
  })
  if (partialMatch) return { profileId: partialMatch.id, matchType: 'partial' }

  const fuzzyMatch = profiles.find((p: any) => {
    const pNom = normalizeString(p.nom || '')
    const pPrenom = normalizeString(p.prenom || '')
    const fullName = `${pPrenom} ${pNom}`
    return fullName.includes(prenomNormalized) && fullName.includes(nomNormalized)
  })
  if (fuzzyMatch) return { profileId: fuzzyMatch.id, matchType: 'partial' }

  return { profileId: null, matchType: 'none' }
}
