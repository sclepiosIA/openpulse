import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { useToast } from '@/hooks/shared/use-toast'
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer'

/**
 * Applications externes déclarées par l'exploitant.
 *
 * POURQUOI CE CROCHET N'UTILISE PAS `useUpdateAppConfig`
 * Ce dernier fait un `update ... where key = ?`. Sur une clé absente, PostgREST
 * ne touche aucune ligne et ne renvoie aucune erreur : l'écran affiche
 * « Configuration mise à jour » et rien n'est écrit. La clé est semée par
 * `supabase/schema-11-applications-externes.sql`, mais une instance mise à jour
 * depuis une version antérieure ne l'a pas. On écrit donc en `upsert`, et on
 * vérifie que la ligne rendue porte bien ce qu'on a envoyé.
 */

/** Icônes proposées. La valeur est un nom, résolu à l'affichage. */
export const ICONES_APPLICATION = [
  'lien', 'dossier', 'coffre', 'serveur', 'graphique',
  'message', 'agenda', 'carte', 'code', 'boutique',
] as const

export type IconeApplication = (typeof ICONES_APPLICATION)[number]

export interface ApplicationExterne {
  /** Stable, sert de clé de rendu et d'identité à l'édition. */
  id: string
  libelle: string
  url: string
  icone: IconeApplication
  /** Section du menu où l'entrée apparaît. */
  section: string
  /** Équipes autorisées. Vide = visible par tous. */
  equipes: string[]
}

const CLE = 'applications_externes'

/**
 * Référence STABLE pour l'absence de données.
 *
 * `requete.data ?? []` fabrique un tableau neuf à chaque rendu. Un composant
 * qui recopie cette valeur dans un état, avec un effet dépendant d'elle, boucle
 * alors sans fin — tant que la lecture n'a pas abouti, c'est-à-dire au
 * chargement et en cas d'erreur, exactement les moments où l'écran doit rester
 * utilisable.
 */
const AUCUNE: readonly ApplicationExterne[] = Object.freeze([])

/**
 * Une entrée saisie à moitié ne doit pas atteindre le menu : une adresse vide
 * ou non analysable y produirait un lien qui ne mène nulle part.
 */
export function estApplicationAffichable(app: ApplicationExterne): boolean {
  if (!app.libelle.trim() || !app.url.trim()) return false
  try {
    const u = new URL(app.url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function normaliser(brut: unknown): ApplicationExterne[] {
  if (!Array.isArray(brut)) return []
  return brut.flatMap((e) => {
    if (!e || typeof e !== 'object') return []
    const o = e as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.libelle !== 'string' || typeof o.url !== 'string') {
      return []
    }
    return [{
      id: o.id,
      libelle: o.libelle,
      url: o.url,
      icone: (ICONES_APPLICATION as readonly string[]).includes(String(o.icone))
        ? (o.icone as IconeApplication)
        : 'lien',
      section: typeof o.section === 'string' && o.section ? o.section : 'Général',
      equipes: Array.isArray(o.equipes) ? o.equipes.filter((x): x is string => typeof x === 'string') : [],
    }]
  })
}

export function useApplicationsExternes() {
  const requete = useQuery({
    queryKey: ['app-config', CLE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', CLE)
        .maybeSingle()
      if (error) throw error
      return normaliser(data?.value)
    },
    staleTime: 60_000,
  })
  return { ...requete, applications: requete.data ?? (AUCUNE as ApplicationExterne[]) }
}

export function useEnregistrerApplicationsExternes() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({ applications, base }: {
      applications: ApplicationExterne[]
      /** Ce que l'écran avait lu avant modification. */
      base: ApplicationExterne[]
    }) => {
      // Deux onglets ouverts écrivaient l'un sur l'autre sans un mot : le
      // dernier gagnait, et le premier ne l'apprenait jamais. On relit avant
      // d'écrire, et on refuse plutôt que d'effacer le travail d'un autre.
      const { data: actuel, error: erreurLecture } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', CLE)
        .maybeSingle()
      if (erreurLecture) throw erreurLecture
      if (actuel && JSON.stringify(normaliser(actuel.value)) !== JSON.stringify(base)) {
        throw new Error(
          'La liste a été modifiée ailleurs depuis son ouverture. ' +
          'Rechargez la page pour repartir de la version enregistrée.',
        )
      }

      const { data, error } = await supabase
        .from('app_config')
        .upsert(
          {
            key: CLE,
            // `Json` exige une signature d'index que l'interface n'a pas ;
            // c'est le TABLEAU qu'on convertit, pas le champ.
            value: applications as unknown as Json,
            category: 'infrastructure',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' },
        )
        .select('value')
        .maybeSingle()

      if (error) throw error
      // Sans cette vérification, une politique de sécurité qui refuse
      // l'écriture rendrait un succès sans rien avoir écrit.
      if (!data) {
        throw new Error("l'enregistrement n'a modifié aucune ligne")
      }
      return normaliser(data.value)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-config'] })
      toast({ title: 'Applications externes enregistrées' })
    },
    onError: (error: Error) => {
      toast({
        title: "L'enregistrement a échoué",
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      })
    },
  })
}
