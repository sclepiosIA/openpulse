// Export FEC (Fichier des Écritures Comptables) — DGFiP article A47 A-1 LPF
import 'https://deno.land/x/xhr@0.1.0/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

// 18 colonnes obligatoires FEC séparées par tabulations
const FEC_HEADERS = [
  'JournalCode',
  'JournalLib',
  'EcritureNum',
  'EcritureDate',
  'CompteNum',
  'CompteLib',
  'CompAuxNum',
  'CompAuxLib',
  'PieceRef',
  'PieceDate',
  'EcritureLib',
  'Debit',
  'Credit',
  'EcritureLet',
  'DateLet',
  'ValidDate',
  'Montantdevise',
  'Idevise',
]

const fmt = (n: number) => (n || 0).toFixed(2).replace('.', ',')
const fmtDate = (d: string | null) => (d ? d.replace(/-/g, '') : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { exercice_id } = await req.json()
    if (!exercice_id) throw new Error('exercice_id requis')

    const { data: exercice } = await supabase
      .from('compta_exercices')
      .select('*')
      .eq('id', exercice_id)
      .single()
    if (!exercice) throw new Error('Exercice introuvable')

    const { data: rows, error } = await supabase.from('v_compta_journal_detail').select('*')
    if (error) throw error

    const { data: ecritures } = await supabase
      .from('compta_ecritures')
      .select('id, validated_at, exercice_id, date_ecriture, statut')
      .eq('exercice_id', exercice_id)
      .in('statut', ['validee', 'cloturee'])

    const ecrMap = new Map((ecritures || []).map((e: any) => [e.id, e]))
    const filteredRows = (rows || []).filter((r: any) => ecrMap.has(r.ecriture_id))

    const lines = [FEC_HEADERS.join('\t')]
    let numecr = 0
    let lastEcrId: string | null = null
    for (const r of filteredRows) {
      if (r.ecriture_id !== lastEcrId) {
        numecr++
        lastEcrId = r.ecriture_id
      }
      const ecr = ecrMap.get(r.ecriture_id)
      lines.push(
        [
          r.journal_code || '',
          r.journal_libelle || '',
          `ECR${String(numecr).padStart(6, '0')}`,
          fmtDate(r.date_ecriture),
          r.compte_numero || '',
          r.compte_libelle || '',
          '',
          '',
          r.numero_piece || `P${numecr}`,
          fmtDate(r.date_ecriture),
          (r.ligne_libelle || r.ecriture_libelle || '').replace(/[\t\n\r]/g, ' '),
          fmt(Number(r.debit)),
          fmt(Number(r.credit)),
          r.lettrage || '',
          '',
          fmtDate(ecr?.validated_at?.slice(0, 10) || r.date_ecriture),
          '',
          '',
        ].join('\t')
      )
    }

    const siren = '000000000' // TODO: configurable via app_config
    const dateClot = exercice.date_fin.replace(/-/g, '')
    const filename = `${siren}FEC${dateClot}.txt`

    return new Response(
      JSON.stringify({
        fec_content: lines.join('\n'),
        filename,
        line_count: lines.length - 1,
        exercice: exercice.libelle,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('[compta-export-fec]', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
