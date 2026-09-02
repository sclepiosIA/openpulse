import 'https://deno.land/x/xhr@0.1.0/mod.ts'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import {
  sanitizeForAI,
  detectPromptInjection,
  logSecurityEvent,
  stripBoundaryTags,
} from '../_shared/security-utils.ts'
import { logAICall } from '../_shared/ai-logging.ts'
import { callGpt5Mini } from '../_shared/azure-gpt5-mini.ts'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const t0 = Date.now()
  try {
    const {
      draft_body,
      subject,
      action,
      thread_messages,
      thread_subject,
      etablissement_id,
      recipient_emails,
      custom_instruction,
      sender_name,
      sender_fonction,
      reply_direction,
    } = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({
          error:
            'action is required (professionalize, enrich, generate_reply, generate_new, shorten, elaborate)',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Security: Sanitize inputs
    const sanitizedDraft = draft_body
      ? sanitizeForAI(draft_body, {
          maxLength: 10000,
          strictMode: false,
          functionName: 'help-me-write-email',
        })
      : ''

    const sanitizedInstruction = custom_instruction
      ? sanitizeForAI(custom_instruction, {
          maxLength: 2000,
          strictMode: false,
          functionName: 'help-me-write-email',
        })
      : ''

    const sanitizedDirection = reply_direction
      ? sanitizeForAI(reply_direction, {
          maxLength: 500,
          strictMode: false,
          functionName: 'help-me-write-email',
        })
      : ''

    const detection = detectPromptInjection(
      (draft_body || '') + ' ' + (custom_instruction || '') + ' ' + (reply_direction || '')
    )
    if (detection.isDetected) {
      logSecurityEvent({
        type: 'injection_attempt',
        functionName: 'help-me-write-email',
        details: { patterns: detection.patterns },
        riskLevel: detection.riskLevel as 'low' | 'medium' | 'high',
      })
    }

    // Build thread context
    let threadContext = ''
    if (thread_messages && thread_messages.length > 0) {
      const recentMessages = thread_messages.slice(0, 5)
      threadContext = recentMessages
        .map(
          (m: {
            from_name?: string
            from_address?: string
            sent_date?: string
            body_text?: string
          }) =>
            `De: ${m.from_name || m.from_address}\nDate: ${m.sent_date}\n${(m.body_text || '').slice(0, 1000)}`
        )
        .join('\n---\n')
    }

    // Build establishment context
    let etablissementContext = ''
    if (etablissement_id) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        const { data: etab } = await supabase
          .from('etablissements')
          .select(
            'nom, statut, ville, type_etablissement, telephone, email_principal, dpi, nombre_passages_urgences_annuel'
          )
          .eq('id', etablissement_id)
          .single()

        if (etab) {
          etablissementContext = `\nÉtablissement concerné: ${etab.nom} (${etab.type_etablissement || 'N/A'}) — ${etab.ville || ''} — Statut: ${etab.statut}`
          if (etab.dpi) etablissementContext += ` — DPI: ${etab.dpi}`
          if (etab.nombre_passages_urgences_annuel)
            etablissementContext += ` — Passages urgences/an: ${etab.nombre_passages_urgences_annuel}`
          if (etab.telephone) etablissementContext += ` — Tél: ${etab.telephone}`
        }
      } catch (e: unknown) {
        console.warn('Could not fetch etablissement:', e)
      }
    }

    const actionPrompts: Record<string, { instruction: string; needsDraft: boolean }> = {
      professionalize: {
        instruction: `Réécris ce brouillon d'email de manière très professionnelle et formelle. Améliore la structure, le vocabulaire et le ton. Garde le même sens et les mêmes informations.`,
        needsDraft: true,
      },
      enrich: {
        instruction: `Enrichis ce brouillon d'email : ajoute des formules de politesse appropriées, structure mieux les paragraphes, ajoute des transitions et rends le message plus complet et engageant. Utilise le contexte du fil de conversation et de l'établissement si disponible.`,
        needsDraft: true,
      },
      generate_reply: {
        instruction: `Génère une réponse professionnelle et pertinente à ce fil de conversation.${sanitizedDirection ? ` L'utilisateur souhaite orienter la réponse dans ce sens : "${sanitizedDirection}". Adapte le contenu en conséquence.` : ''} La réponse doit être appropriée au contexte, courtoise et aller droit au but. Si un brouillon est fourni, utilise-le comme base et améliore-le.`,
        needsDraft: false,
      },
      generate_new: {
        instruction: `Rédige un email initial professionnel et engageant, prêt à être envoyé (pas une réponse à un fil existant).${sanitizedDirection ? ` Objectif de l'email : "${sanitizedDirection}".` : ''}${sanitizedInstruction ? ` Instructions supplémentaires : "${sanitizedInstruction}".` : ''} L'email doit avoir une introduction courtoise, un corps clair et structuré, un appel à l'action explicite si pertinent, et une formule de politesse. Utilise le contexte de l'établissement destinataire si disponible pour personnaliser le message.`,
        needsDraft: false,
      },
      shorten: {
        instruction: `Raccourcis ce brouillon d'email en gardant uniquement les informations essentielles. Sois direct et concis, sans formules inutiles.`,
        needsDraft: true,
      },
      elaborate: {
        instruction: `Développe ce brouillon d'email : ajoute plus de détails, d'explications et de contexte pour rendre le message plus complet et informatif. Utilise le contexte disponible.`,
        needsDraft: true,
      },
    }

    const actionConfig = actionPrompts[action]
    if (!actionConfig) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (actionConfig.needsDraft && !sanitizedDraft) {
      return new Response(JSON.stringify({ error: 'draft_body is required for this action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const senderBlock = [
      sender_name ? `Signataire: ${sender_name}` : null,
      sender_fonction ? `Fonction: ${sender_fonction}` : null,
      recipient_emails && recipient_emails.length
        ? `Destinataire(s): ${recipient_emails.join(', ')}`
        : null,
      thread_subject ? `Sujet du fil: ${thread_subject}` : null,
      subject ? `Sujet actuel: ${subject}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const systemPrompt = `Tu es un assistant expert en rédaction d'emails professionnels en français, pour l'entreprise OpenPulse (solution IA pour établissements de santé).
Règles strictes :
- Rédige uniquement en français, ton professionnel, chaleureux mais sobre.
- N'ajoute JAMAIS de commentaires, de balises Markdown, ni de préambule.
- Retourne uniquement un objet JSON strict avec les clés "subject" (string, court, sans "RE:" sauf si réponse) et "body" (string, texte simple avec sauts de ligne \\n, sans HTML).
- Le body doit inclure une salutation, un corps structuré et une formule de politesse signée par le signataire fourni si disponible.
- Ne pas inventer d'informations personnelles ou chiffrées non fournies.`

    const userPrompt = `Action demandée : ${action}
${actionConfig.instruction}

${senderBlock ? `--- Contexte expéditeur/destinataire ---\n${senderBlock}` : ''}
${etablissementContext ? `--- Contexte établissement ---${etablissementContext}` : ''}
${threadContext ? `--- Fil de conversation (du plus récent au plus ancien) ---\n${threadContext}` : ''}
${sanitizedDraft ? `--- Brouillon actuel ---\n${sanitizedDraft}` : ''}
${sanitizedInstruction && action !== 'generate_new' ? `--- Instruction utilisateur ---\n${sanitizedInstruction}` : ''}

Réponds UNIQUEMENT avec un JSON du type: {"subject":"...","body":"..."}`

    const { content, usage, model } = await callGpt5Mini(systemPrompt, userPrompt, {
      maxTokens: 3000,
      jsonOutput: true,
    })

    let parsed: { subject?: string; body?: string } = {}
    try {
      const cleaned = stripBoundaryTags(content || '')
        .trim()
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = { body: content || '' }
    }

    const finalSubject = (parsed.subject || subject || thread_subject || '').toString()
    const finalBody = (parsed.body || '').toString()

    await logAICall({
      processing_type: `help-me-write-email:${action}`,
      model_used: model,
      prompt_tokens: usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
      total_tokens: usage?.total_tokens,
      processing_duration_ms: Date.now() - t0,
      success: true,
    }).catch(() => {})

    return new Response(
      JSON.stringify({
        result: finalBody,
        body: finalBody,
        content: finalBody,
        subject: finalSubject,
        usage,
        model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('help-me-write-email error:', e)
    return buildErrorResponse('help-me-write-email', e, corsHeaders, 500)
  }
})
