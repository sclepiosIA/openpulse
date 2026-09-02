// Lettrage IA — rapprochement automatique factures ↔ paiements par Azure GPT-5
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

const AZURE_OPENAI_ENDPOINT = Deno.env.get('AZURE_OPENAI_ENDPOINT')
const AZURE_OPENAI_API_KEY = Deno.env.get('AZURE_OPENAI_API_KEY')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { exercice_id } = await req.json()

    // Récupérer les lignes non lettrées sur comptes lettrables (411, 401, 512...)
    const { data: lignes, error } = await supabase
      .from('v_compta_grand_livre')
      .select('*')
      .is('lettrage', null)
      .limit(500)
    if (error) throw error

    if (!lignes || lignes.length < 2) {
      return new Response(
        JSON.stringify({
          applied_count: 0,
          matches_count: 0,
          avg_confidence: 0,
          details: { message: 'Aucune ligne à lettrer' },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Grouper par compte lettrable
    const byCompte = new Map<string, any[]>()
    for (const l of lignes) {
      if (!byCompte.has(l.compte_id)) byCompte.set(l.compte_id, [])
      byCompte.get(l.compte_id)!.push(l)
    }

    const matches: any[] = []
    let letterCode = 65 // A

    // Algorithme déterministe : match débit/crédit de même montant sur même compte, même tiers si possible
    for (const [compteId, ls] of byCompte) {
      const debits = ls
        .filter((l: any) => Number(l.debit) > 0)
        .sort((a: any, b: any) => a.date_ecriture.localeCompare(b.date_ecriture))
      const credits = ls
        .filter((l: any) => Number(l.credit) > 0)
        .sort((a: any, b: any) => a.date_ecriture.localeCompare(b.date_ecriture))
      const used = new Set<string>()

      for (const d of debits) {
        if (used.has(d.ligne_id)) continue
        const match = credits.find(
          (c: any) => !used.has(c.ligne_id) && Math.abs(Number(c.credit) - Number(d.debit)) < 0.01
        )
        if (match) {
          const letter = String.fromCharCode(letterCode++)
          matches.push({
            compte_id: compteId,
            lettrage: letter,
            debit_id: d.ligne_id,
            credit_id: match.ligne_id,
            montant: Number(d.debit),
            confidence: 1.0,
            method: 'exact_amount',
          })
          used.add(d.ligne_id)
          used.add(match.ligne_id)
        }
      }
    }

    // Si Azure dispo, tenter des rapprochements approximatifs (frais bancaires, arrondis)
    let aiSuggestions: any[] = []
    if (AZURE_OPENAI_ENDPOINT && AZURE_OPENAI_API_KEY && matches.length < lignes.length / 4) {
      const unmatched = lignes
        .filter(
          (l: any) =>
            !matches.some((m: any) => m.debit_id === l.ligne_id || m.credit_id === l.ligne_id)
        )
        .slice(0, 40)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      try {
        const resp = await fetch(AZURE_OPENAI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': AZURE_OPENAI_API_KEY },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content:
                  'Tu es un comptable expert. Propose des rapprochements factures/paiements (lettrage) même si les montants diffèrent légèrement (frais bancaires, arrondis, escomptes). Réponds en JSON strict.',
              },
              {
                role: 'user',
                content: `Voici des lignes comptables non lettrées:\n${JSON.stringify(unmatched.map((l: any) => ({ id: l.ligne_id, date: l.date_ecriture, libelle: l.ecriture_libelle, debit: l.debit, credit: l.credit, compte: l.numero })))}\n\nPropose des paires (débit_id, crédit_id) qui devraient être rapprochées. Format: {"matches":[{"debit_id":"...","credit_id":"...","confidence":0.85,"reason":"..."}]}`,
              },
            ],
            max_completion_tokens: 2000,
            reasoning_effort: 'medium',
            verbosity: 'low',
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (resp.ok) {
          const j = await resp.json()
          const content = j.choices?.[0]?.message?.content
          if (content) {
            const parsed = JSON.parse(content)
            aiSuggestions = parsed.matches || []
          }
        }
      } catch (e) {
        console.warn('Azure lettrage IA skipped:', e)
        clearTimeout(timeoutId)
      }
    }

    // Appliquer les matches déterministes
    let applied = 0
    for (const m of matches) {
      const { error: e1 } = await supabase
        .from('compta_lignes')
        .update({ lettrage: m.lettrage })
        .in('id', [m.debit_id, m.credit_id])
      if (!e1) applied++
    }

    const avgConf = matches.length
      ? matches.reduce((s, m) => s + m.confidence, 0) / matches.length
      : 0

    return new Response(
      JSON.stringify({
        success: true,
        applied_count: applied,
        matches_count: matches.length,
        ai_suggestions_count: aiSuggestions.length,
        avg_confidence: avgConf,
        details: {
          deterministic: matches.slice(0, 20),
          ai_suggested: aiSuggestions.slice(0, 20),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('[compta-lettrage-ia]', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
