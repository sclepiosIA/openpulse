import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3'
import { callGpt52 } from '../_shared/azure-gpt52.ts'
import {
  needsKnowledge,
  fetchKnowledgeContext,
  buildKnowledgeBlock,
} from '../_shared/ai-knowledge.ts'

const BodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  mode: z.enum(['freeform', 'postit', 'bullets', 'mindmap']).optional().default('freeform'),
  // 'auto' (défaut) : détection automatique, true : force, false : désactive
  useKnowledge: z
    .union([z.boolean(), z.literal('auto')])
    .optional()
    .default('auto'),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
      error: uerr,
    } = await supabase.auth.getUser()
    if (uerr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { prompt, mode, useKnowledge } = parsed.data

    const systemByMode: Record<string, string> = {
      freeform:
        'Tu es un assistant qui rédige des notes concises et claires en français pour un tableau blanc. Réponds directement, sans introduction, sans markdown, en 1 à 6 lignes maximum.',
      postit:
        'Tu es un assistant qui rédige un post-it court : une idée par ligne, 1 à 5 lignes très concises en français, sans markdown ni introduction. Maximum 200 caractères.',
      bullets:
        "Tu es un assistant qui rédige une liste à puces en français, 3 à 6 puces courtes. Chaque puce commence par '• '. Pas de titre, pas d'introduction.",
      mindmap: [
        'Tu es un expert en structuration de connaissances (méthode Tony Buzan) et tu construis une carte mentale riche en français.',
        'Réponds UNIQUEMENT en JSON valide (aucun markdown, aucun texte hors JSON) selon ce schéma :',
        '{"central":"Sujet (2-6 mots)","branches":[{"title":"Axe principal","note":"précision courte optionnelle","children":[{"title":"Sous-idée","children":[{"title":"Détail"}]}]}]}',
        'Règles de qualité :',
        '- 4 à 7 branches principales, MECE (sans recouvrement, couvrant le sujet), ordonnées de la plus structurante à la plus opérationnelle ;',
        '- 2 à 5 sous-idées par branche, et si utile 1 à 3 détails concrets par sous-idée (3 niveaux maximum) ;',
        '- libellés courts et informatifs (2 à 7 mots), sans phrase complète, sans ponctuation finale, sans numérotation ;',
        '- privilégie des contenus actionnables : acteurs, étapes, indicateurs chiffrés, risques, outils, échéances ;',
        "- utilise les données de contexte fournies (chiffres, noms d'établissements, KPI) quand elles existent, sans les inventer ;",
        "- 'note' est optionnel : 3 à 10 mots pour préciser un axe (métrique, responsable, deadline) ;",
        "- pas de branche générique du type 'Divers', 'Autres', 'Conclusion'.",
      ].join('\n'),
    }

    // Accès aux connaissances de la base (via les outils Jarvis, RLS utilisateur)
    const shouldUseKnowledge =
      useKnowledge === true || (useKnowledge === 'auto' && needsKnowledge(prompt))
    const knowledge = shouldUseKnowledge
      ? await fetchKnowledgeContext(authHeader, prompt, { maxChars: 3500 })
      : { context: '', used: false }

    if (shouldUseKnowledge && !knowledge.used) {
      console.warn('[notes-ai-assist] knowledge unavailable:', knowledge.error ?? 'unknown')
    }

    const res = await callGpt52(
      systemByMode[mode] + buildKnowledgeBlock(knowledge.context),
      prompt,
      {
        maxTokens: mode === 'mindmap' ? 3200 : knowledge.used ? 1200 : 700,
        reasoningEffort: mode === 'mindmap' ? 'medium' : 'low',
        verbosity: mode === 'mindmap' ? 'medium' : 'low',
        jsonOutput: mode === 'mindmap',
      }
    )

    return new Response(
      JSON.stringify({
        text: res.content?.trim() ?? '',
        model: res.model,
        knowledge_used: knowledge.used,
        knowledge_requested: shouldUseKnowledge,
        knowledge_error:
          shouldUseKnowledge && !knowledge.used ? (knowledge.error ?? 'unknown') : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('notes-ai-assist error', error)
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
