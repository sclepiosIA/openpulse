/**
 * doc-ai-transform
 * Copilot IA éditeur: applique une action de transformation sur du texte/HTML sélectionné.
 * Retourne le résultat + une explication + les tokens pour audit.
 *
 * Actions supportées (voir front src/components/documents/ai/copilot/actions.ts):
 *  rewrite, tone_formal, tone_direct, tone_empathic, tone_legal, tone_marketing,
 *  translate, shorten, expand, summarize_exec, summarize_bullets, summarize_tldr,
 *  proofread, simplify, continue_writing, draft_from_prompt, to_table, to_bullets,
 *  to_outline, explain, headline_suggest, extract_actions, extract_events, extract_contacts,
 *  formula_from_nl, explain_formula, fix_formula, insights, chart_suggest
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_shared/cors.ts'
import { sanitizeErrorForClient } from '../_shared/error-sanitizer.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { callGpt5Mini } from '../_shared/azure-gpt5-mini.ts'

interface Body {
  action: string
  surface?: 'document' | 'presentation' | 'spreadsheet'
  selection?: string // texte sélectionné (peut être HTML)
  fullText?: string // contexte plus large
  language?: string // ex: "fr", "en", "es", "de", "it", "ar"
  tone?: string
  documentId?: string | null
  extraContext?: string // contexte projet fourni par le front (résumé)
  format?: 'html' | 'text' | 'json'
}

const ACTION_CONFIG: Record<
  string,
  {
    system: string
    build: (b: Body) => string
    reasoning: 'minimal' | 'low' | 'medium' | 'high'
    verbosity: 'low' | 'medium' | 'high'
    tokens: number
    json?: boolean
  }
> = {
  rewrite: {
    system:
      'Tu réécris du contenu en conservant le sens exact, en français impeccable, style clair et professionnel. Renvoie uniquement le texte réécrit, sans commentaire.',
    build: (b) => `Réécris ce passage :\n\n${b.selection ?? ''}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 2000,
  },
  tone_formal: {
    system:
      'Tu ajustes le ton à formel/institutionnel, sans altérer le sens. Renvoie uniquement le texte.',
    build: (b) => `Réécris en ton formel :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 2000,
  },
  tone_direct: {
    system: 'Tu ajustes le ton à direct/concis, sans altérer le sens. Renvoie uniquement le texte.',
    build: (b) => `Réécris en ton direct et concis :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'low',
    tokens: 1500,
  },
  tone_empathic: {
    system: 'Tu ajustes le ton à empathique/humain. Renvoie uniquement le texte.',
    build: (b) => `Réécris en ton empathique :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 2000,
  },
  tone_legal: {
    system:
      'Tu ajustes le ton à juridique/contractuel français, précis, sans clauses inventées. Renvoie uniquement le texte.',
    build: (b) => `Réécris en ton juridique :\n\n${b.selection}`,
    reasoning: 'medium',
    verbosity: 'medium',
    tokens: 2500,
  },
  tone_marketing: {
    system:
      'Tu ajustes le ton à marketing santé, sobre, sans promesses non vérifiées. Renvoie uniquement le texte.',
    build: (b) => `Réécris en ton marketing sobre :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 2000,
  },
  translate: {
    system:
      'Tu traduis fidèlement en préservant terminologie médicale et sigles français quand pertinents. Renvoie uniquement la traduction.',
    build: (b) => `Traduis en ${b.language ?? 'en'} :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 3000,
  },
  shorten: {
    system: "Tu raccourcis en conservant l'essentiel. Renvoie uniquement le texte raccourci.",
    build: (b) => `Raccourcis (moitié environ) :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'low',
    tokens: 1500,
  },
  expand: {
    system:
      'Tu développes en ajoutant précisions utiles, sans inventer de données. Renvoie uniquement le texte.',
    build: (b) => `Développe ce passage :\n\n${b.selection}`,
    reasoning: 'medium',
    verbosity: 'medium',
    tokens: 2500,
  },
  summarize_exec: {
    system:
      'Tu produis un résumé exécutif de 3-5 phrases, orienté décision. Renvoie uniquement le résumé.',
    build: (b) => `Résume en exécutif :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'medium',
    verbosity: 'low',
    tokens: 1000,
  },
  summarize_bullets: {
    system: 'Tu produis un résumé sous forme de 5-8 puces claires (HTML <ul><li>).',
    build: (b) => `Résume en puces HTML :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 1500,
  },
  summarize_tldr: {
    system: "Tu produis un TL;DR d'une seule phrase.",
    build: (b) => `TL;DR :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'minimal',
    verbosity: 'low',
    tokens: 400,
  },
  proofread: {
    system:
      'Tu corriges orthographe, grammaire, typographie françaises. Conserve le sens exact et le HTML de mise en forme. Renvoie uniquement le texte corrigé.',
    build: (b) => `Corrige :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'low',
    tokens: 3000,
  },
  simplify: {
    system: 'Tu simplifies pour être compris par un public non-expert, sans dénaturer.',
    build: (b) => `Simplifie :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 2000,
  },
  continue_writing: {
    system:
      'Tu continues la rédaction dans le même style et registre. Renvoie uniquement la suite (1 à 3 paragraphes).',
    build: (b) => `Continue la rédaction. Voici ce qui précède :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 1500,
  },
  draft_from_prompt: {
    system:
      'Tu rédiges un document professionnel en HTML sémantique (h1/h2/p/ul/ol/li/strong/em). Structure claire, français impeccable. Aucun script.',
    build: (b) =>
      `Rédige un document HTML complet basé sur cette demande :\n\n${b.selection ?? ''}\n\nContexte projet:\n${b.extraContext ?? 'aucun'}`,
    reasoning: 'medium',
    verbosity: 'high',
    tokens: 3500,
  },
  to_table: {
    system:
      'Tu convertis un texte en tableau HTML propre (<table><thead>...<tbody>...</tbody></table>). Renvoie uniquement le HTML.',
    build: (b) => `Convertis en tableau HTML :\n\n${b.selection}`,
    reasoning: 'low',
    verbosity: 'low',
    tokens: 2000,
  },
  to_bullets: {
    system: 'Tu convertis en liste HTML <ul><li>. Renvoie uniquement le HTML.',
    build: (b) => `Convertis en puces :\n\n${b.selection}`,
    reasoning: 'minimal',
    verbosity: 'low',
    tokens: 1500,
  },
  to_outline: {
    system:
      'Tu produis un plan HTML hiérarchisé (h2 pour sections, ul>li pour points). Renvoie uniquement le HTML.',
    build: (b) => `Fais un plan HTML sur :\n\n${b.selection}`,
    reasoning: 'medium',
    verbosity: 'medium',
    tokens: 2000,
  },
  explain: {
    system: 'Tu expliques un passage de manière pédagogique.',
    build: (b) => `Explique :\n\n${b.selection}`,
    reasoning: 'medium',
    verbosity: 'medium',
    tokens: 1500,
  },
  headline_suggest: {
    system:
      'Tu proposes 5 titres possibles pour un document. Renvoie du JSON strict: {"titles":["...",...]}',
    build: (b) => `Propose 5 titres pour :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'low',
    verbosity: 'low',
    tokens: 600,
    json: true,
  },
  extract_actions: {
    system:
      'Tu identifies les actions/tâches concrètes dans un document. JSON strict: {"tasks":[{"title":"...","assignee":null,"due":null,"priority":"normal"}]}',
    build: (b) => `Extrais actions :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'medium',
    verbosity: 'low',
    tokens: 1500,
    json: true,
  },
  extract_events: {
    system:
      'Tu identifies les événements planifiés. JSON strict: {"events":[{"title":"...","start":"YYYY-MM-DDTHH:mm","end":null,"location":null}]}',
    build: (b) => `Extrais événements :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'medium',
    verbosity: 'low',
    tokens: 1500,
    json: true,
  },
  extract_contacts: {
    system:
      'Tu identifies les contacts nommés (personnes, email, téléphone). JSON strict: {"contacts":[{"name":"...","email":null,"phone":null,"role":null}]}',
    build: (b) => `Extrais contacts :\n\n${b.fullText ?? b.selection}`,
    reasoning: 'low',
    verbosity: 'low',
    tokens: 1500,
    json: true,
  },
  // Spreadsheet
  formula_from_nl: {
    system:
      'Tu es expert formules type Excel/Google Sheets. Renvoie JSON strict: {"formula":"=...","explanation":"..."}. Pas de commentaire hors JSON.',
    build: (b) =>
      `Demande : ${b.selection}\nContexte plage :\n${b.fullText ?? ''}\nRenvoie une formule valide (français ou anglais selon usage).`,
    reasoning: 'medium',
    verbosity: 'low',
    tokens: 1000,
    json: true,
  },
  explain_formula: {
    system: 'Tu expliques une formule en 3-5 phrases claires. JSON strict: {"explanation":"..."}.',
    build: (b) => `Explique cette formule : ${b.selection}`,
    reasoning: 'low',
    verbosity: 'medium',
    tokens: 800,
    json: true,
  },
  fix_formula: {
    system:
      'Tu corriges une formule qui ne fonctionne pas. JSON strict: {"formula":"=...","explanation":"..."}.',
    build: (b) => `Formule à corriger : ${b.selection}\nContexte : ${b.fullText ?? ''}`,
    reasoning: 'medium',
    verbosity: 'low',
    tokens: 1000,
    json: true,
  },
  insights: {
    system:
      'Tu analyses une plage de données et donnes 3 à 5 insights actionnables. JSON strict: {"insights":[{"title":"...","detail":"...","severity":"info|warn|critical"}]}',
    build: (b) => `Données :\n${b.selection ?? b.fullText}`,
    reasoning: 'medium',
    verbosity: 'medium',
    tokens: 2000,
    json: true,
  },
  chart_suggest: {
    system:
      'Tu proposes le meilleur graphique. JSON strict: {"chart":"bar|line|pie|scatter|area","x":"colonne","y":["..."],"reason":"..."}',
    build: (b) => `Données :\n${b.selection ?? b.fullText}`,
    reasoning: 'medium',
    verbosity: 'low',
    tokens: 800,
    json: true,
  },
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('Origin'))
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const t0 = Date.now()
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: userData, error: authError } = await supabase.auth.getUser()
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userId = userData.user.id

    // Rate limit: 60/min par utilisateur
    const rl = checkRateLimit(`doc-ai-transform:${userId}`, { max: 60, windowSec: 60 })
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfter: rl.retryAfterSec }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(rl.retryAfterSec ?? 30),
          },
        }
      )
    }

    const body = (await req.json()) as Body
    const cfg = ACTION_CONFIG[body.action]
    if (!cfg) {
      return new Response(JSON.stringify({ error: `Unknown action: ${body.action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (!body.selection && !body.fullText) {
      return new Response(JSON.stringify({ error: 'No content provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const inputChars = (body.selection?.length ?? 0) + (body.fullText?.length ?? 0)
    if (inputChars > 60000) {
      return new Response(JSON.stringify({ error: 'Content too large (max 60k chars)' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = cfg.build(body)
    const aiResult = await callGpt5Mini(cfg.system, prompt, {
      maxTokens: cfg.tokens,
      timeout: 90000,
      jsonOutput: cfg.json,
    })
    const content = aiResult.content

    let parsed: unknown = null
    if (cfg.json) {
      try {
        parsed = JSON.parse(content)
      } catch {
        parsed = { raw: content }
      }
    }

    // Audit log (best-effort)
    try {
      await supabase.from('ai_editor_actions_log').insert({
        user_id: userId,
        document_id: body.documentId ?? null,
        surface: body.surface ?? 'document',
        action: body.action,
        input_chars: inputChars,
        output_chars: content.length,
        latency_ms: Date.now() - t0,
        reasoning_effort: cfg.reasoning,
      })
    } catch (_e) {
      // ignore audit failure
    }

    return new Response(
      JSON.stringify({
        action: body.action,
        result: content,
        parsed,
        latency_ms: Date.now() - t0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('doc-ai-transform error:', error)
    return new Response(JSON.stringify({ error: sanitizeErrorForClient(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
