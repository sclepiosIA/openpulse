import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.50.3'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

interface SyncResult {
  salairesProcessed: number
  depensesCreated: number
  depensesUpdated: number
  cotisationsCreated: number
  nomsCorrigesCount: number
  errors: string[]
}

type EmployeeProfile = {
  prenom?: string | null
  nom?: string | null
  email?: string | null
}

type SalaryForTreasurySync = {
  id: string
  mois: string
  salaire_net?: number | null
  net_paye?: number | null
  cotisations_patronales?: number | null
  statut?: string | null
  profile_id?: string | null
  profiles?: EmployeeProfile | null
}

async function syncRHToTresorerie(supabase: SupabaseClient, mois?: string): Promise<SyncResult> {
  const result: SyncResult = {
    salairesProcessed: 0,
    depensesCreated: 0,
    depensesUpdated: 0,
    cotisationsCreated: 0,
    nomsCorrigesCount: 0,
    errors: [],
  }

  try {
    // Récupérer tous les salaires RH avec les profils
    let query = supabase.from('rh_salaires_mensuels').select(`
        id,
        mois,
        salaire_brut,
        salaire_net,
        cotisations_patronales,
        net_paye,
        statut,
        profile_id,
        profiles:profile_id (
          id,
          prenom,
          nom,
          email
        )
      `)

    if (mois) {
      query = query.eq('mois', mois)
    }

    const { data: salaires, error: salairesError } = await query

    if (salairesError) {
      result.errors.push(`Erreur récupération salaires: ${salairesError.message}`)
      return result
    }

    if (!salaires || salaires.length === 0) {
      console.log('Aucun salaire à synchroniser')
      return result
    }

    const salaryRows = salaires as unknown as SalaryForTreasurySync[]

    console.log(`Synchronisation de ${salaryRows.length} salaires...`)

    // ÉTAPE 1: Corriger les noms manquants dans les dépenses existantes
    const { data: depensesACorreger } = await supabase
      .from('tresorerie_depenses')
      .select('id, nom, source_id')
      .or('source.eq.rh_salaires_net,source.eq.rh_cotisations')
      .like('nom', '%Employé ID%')

    if (depensesACorreger && depensesACorreger.length > 0) {
      console.log(`🔧 ${depensesACorreger.length} dépenses à corriger (noms manquants)`)

      for (const depense of depensesACorreger) {
        // Trouver le salaire correspondant
        const salaireMatch = salaryRows.find((s) => s.id === depense.source_id)
        if (salaireMatch && salaireMatch.profiles) {
          const nomComplet =
            `${salaireMatch.profiles.prenom || ''} ${salaireMatch.profiles.nom || ''}`.trim()
          if (nomComplet) {
            const isNet = depense.nom.includes('Salaire')
            const nouveauNom = isNet
              ? `Salaire - ${nomComplet}`
              : `Cotisations patronales - ${nomComplet}`

            await supabase
              .from('tresorerie_depenses')
              .update({ nom: nouveauNom })
              .eq('id', depense.id)

            result.nomsCorrigesCount++
            console.log(`  ✅ Corrigé: "${depense.nom}" → "${nouveauNom}"`)
          }
        }
      }
    }

    // ÉTAPE 2: Traiter chaque salaire
    for (const salaire of salaryRows) {
      result.salairesProcessed++

      // Construire le nom de l'employé avec fallbacks robustes
      let employeNom = 'Employé'
      if (salaire.profiles) {
        const prenom = salaire.profiles.prenom || ''
        const nom = salaire.profiles.nom || ''
        const email = salaire.profiles.email || ''

        if (prenom || nom) {
          employeNom = `${prenom} ${nom}`.trim()
        } else if (email) {
          employeNom = email.split('@')[0]
        }
      }

      // Si toujours générique, utiliser le profile_id
      if (employeNom === 'Employé' || !employeNom) {
        console.warn(
          `⚠️ Profile incomplet pour salaire ID ${salaire.id}, profile_id: ${salaire.profile_id}`
        )
        employeNom = `Employé (${salaire.profile_id?.substring(0, 8) || 'inconnu'})`
      }

      // Calculer la date de paiement (5 du mois suivant généralement)
      const moisDate = new Date(salaire.mois)
      const datePaiement = new Date(moisDate.getFullYear(), moisDate.getMonth() + 1, 5)
      const datePaiementStr = datePaiement.toISOString().split('T')[0]

      // 1. Créer/mettre à jour la dépense pour le salaire net
      const { data: existingSalaire, error: checkSalaireError } = await supabase
        .from('tresorerie_depenses')
        .select('id')
        .eq('source', 'rh_salaires_net')
        .eq('source_id', salaire.id)
        .maybeSingle()

      if (checkSalaireError) {
        result.errors.push(`Erreur vérification dépense salaire: ${checkSalaireError.message}`)
        continue
      }

      const montantNet = salaire.net_paye || salaire.salaire_net || 0

      if (existingSalaire) {
        // Mettre à jour
        const { error: updateError } = await supabase
          .from('tresorerie_depenses')
          .update({
            nom: `Salaire - ${employeNom}`,
            montant: montantNet,
            statut: salaire.statut === 'paye' ? 'paye' : 'en_attente',
            date_paiement_reel: salaire.statut === 'paye' ? datePaiementStr : null,
          })
          .eq('id', existingSalaire.id)

        if (updateError) {
          result.errors.push(`Erreur mise à jour salaire ${employeNom}: ${updateError.message}`)
        } else {
          result.depensesUpdated++
        }
      } else {
        // Créer
        const { error: insertError } = await supabase.from('tresorerie_depenses').insert({
          nom: `Salaire - ${employeNom}`,
          montant: montantNet,
          date_prevue: datePaiementStr,
          statut: salaire.statut === 'paye' ? 'paye' : 'en_attente',
          date_paiement_reel: salaire.statut === 'paye' ? datePaiementStr : null,
          categorie_code: 'DEP_SALAIRES_NETS',
          source: 'rh_salaires_net',
          source_id: salaire.id,
          est_recurrent: false,
          notes: `Synchronisé depuis RH - Mois: ${salaire.mois} - ${employeNom}`,
        })

        if (insertError) {
          result.errors.push(`Erreur création salaire ${employeNom}: ${insertError.message}`)
        } else {
          result.depensesCreated++
          console.log(`  ✅ Créé: Salaire - ${employeNom} (${montantNet}€)`)
        }
      }

      // 2. Créer/mettre à jour les cotisations patronales
      if (salaire.cotisations_patronales && salaire.cotisations_patronales > 0) {
        const { data: existingCotis, error: checkCotisError } = await supabase
          .from('tresorerie_depenses')
          .select('id')
          .eq('source', 'rh_cotisations')
          .eq('source_id', salaire.id)
          .maybeSingle()

        if (!checkCotisError) {
          if (existingCotis) {
            await supabase
              .from('tresorerie_depenses')
              .update({
                nom: `Cotisations patronales - ${employeNom}`,
                montant: salaire.cotisations_patronales,
                statut: salaire.statut === 'paye' ? 'paye' : 'en_attente',
              })
              .eq('id', existingCotis.id)
          } else {
            const { error: insertCotisError } = await supabase.from('tresorerie_depenses').insert({
              nom: `Cotisations patronales - ${employeNom}`,
              montant: salaire.cotisations_patronales,
              date_prevue: datePaiementStr,
              statut: salaire.statut === 'paye' ? 'paye' : 'en_attente',
              categorie_code: 'DEP_URSSAF',
              source: 'rh_cotisations',
              source_id: salaire.id,
              est_recurrent: false,
              notes: `Cotisations patronales - Mois: ${salaire.mois} - ${employeNom}`,
            })

            if (!insertCotisError) {
              result.cotisationsCreated++
              console.log(
                `  ✅ Créé: Cotisations - ${employeNom} (${salaire.cotisations_patronales}€)`
              )
            }
          }
        }
      }
    }

    console.log(`✅ Synchronisation terminée:`, result)
    return result
  } catch (error: unknown) {
    result.errors.push(`Erreur générale: ${error instanceof Error ? error.message : String(error)}`)
    return result
  }
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Récupérer le mois optionnel depuis le body
    let mois: string | undefined
    try {
      const body = await req.json()
      mois = body?.mois
    } catch {
      // Pas de body, synchroniser tout
    }

    console.log(
      `🔄 Démarrage synchronisation RH → Trésorerie${mois ? ` pour ${mois}` : ' (tous les mois)'}...`
    )

    const result = await syncRHToTresorerie(supabase, mois)

    return new Response(
      JSON.stringify({
        success: result.errors.length === 0,
        ...result,
        message: `Synchronisation terminée: ${result.depensesCreated} créées, ${result.depensesUpdated} mises à jour, ${result.nomsCorrigesCount} noms corrigés`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: unknown) {
    return buildErrorResponse('sync-rh-tresorerie', error, corsHeaders, 500)
  }
}

if (import.meta.main) Deno.serve(handler)
