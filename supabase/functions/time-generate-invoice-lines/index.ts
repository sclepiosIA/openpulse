import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { origineAutorisee } from '../_shared/cors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Génère des lignes de facturation prêtes à insérer dans un devis/facture,
 * à partir des imputations approuvées facturables sur une période et un établissement.
 * Retourne un draft (l'insert dans devis_lignes/factures_lignes est fait par le front après confirmation).
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return j({ error: 'Unauthorized' }, 401)

    const { etablissement_id, date_from, date_to, group_by = 'user' } = await req.json()
    if (!etablissement_id || !date_from || !date_to) {
      return j({ error: 'etablissement_id, date_from, date_to requis' }, 400)
    }

    const { data: imps, error } = await supabase
      .from('time_imputations')
      .select(
        'id, user_id, duration_minutes, tjm_snapshot, hourly_rate_snapshot, date_imputation, note'
      )
      .eq('etablissement_id', etablissement_id)
      .eq('is_billable', true)
      .eq('status', 'approved')
      .gte('date_imputation', date_from)
      .lte('date_imputation', date_to)
    if (error) throw error

    const groups = new Map<
      string,
      {
        key: string
        user_id: string
        total_minutes: number
        total_ht: number
        imputation_ids: string[]
      }
    >()

    for (const i of imps ?? []) {
      const key = group_by === 'user' ? i.user_id : 'global'
      const hourly = Number(i.hourly_rate_snapshot ?? 0)
      const tjm = Number(i.tjm_snapshot ?? 0)
      // Priorité au taux horaire ; fallback TJM (÷7)
      const rate = hourly > 0 ? hourly : tjm > 0 ? tjm / 7 : 0
      const ht = (Number(i.duration_minutes) / 60) * rate
      const g = groups.get(key) ?? {
        key,
        user_id: i.user_id,
        total_minutes: 0,
        total_ht: 0,
        imputation_ids: [],
      }
      g.total_minutes += Number(i.duration_minutes)
      g.total_ht += ht
      g.imputation_ids.push(i.id)
      groups.set(key, g)
    }

    const lignes = Array.from(groups.values()).map((g) => ({
      description: `Prestations ${date_from} → ${date_to} (${(g.total_minutes / 60).toFixed(2)} h)`,
      quantite: Number((g.total_minutes / 60).toFixed(2)),
      unite: 'h',
      prix_unitaire_ht:
        g.total_minutes > 0 ? Number((g.total_ht / (g.total_minutes / 60)).toFixed(2)) : 0,
      montant_ht: Number(g.total_ht.toFixed(2)),
      metadata: { imputation_ids: g.imputation_ids, user_id: g.user_id },
    }))

    return j({ success: true, lignes, total_ht: lignes.reduce((s, l) => s + l.montant_ht, 0) })
  } catch (e) {
    console.error('time-generate-invoice-lines error:', e)
    return j({ error: (e as Error).message }, 500)
  }
})
function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
