import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

/**
 * Extrait les mots-clés significatifs d'un titre pour détection de doublons
 */
function extractKeywords(title: string): string[] {
  const stopWords = [
    'suivre',
    'confirmer',
    'relancer',
    'vérifier',
    'organiser',
    'planifier',
    'le',
    'la',
    'les',
    'de',
    'du',
    'des',
    'pour',
    'avec',
    'sur',
    'dans',
    'un',
    'une',
    'et',
    'ou',
    'mais',
    'donc',
    'car',
    'si',
    'que',
    'qui',
  ]

  return title
    .toLowerCase()
    .replace(/[^\w\sàéèêëïîôùûç]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.includes(w))
    .sort()
}

/**
 * Vérifie si deux suggestions sont sémantiquement similaires
 */
function areSuggestionsSimilar(s1: any, s2: any): boolean {
  if (s1.action_type !== s2.action_type) return false

  const kw1 = extractKeywords(s1.action_data?.title || '')
  const kw2 = extractKeywords(s2.action_data?.title || '')

  if (kw1.length === 0 || kw2.length === 0) return false

  const commonWords = kw1.filter((w) => kw2.includes(w))
  const similarityRatio = commonWords.length / Math.max(kw1.length, kw2.length)

  return similarityRatio >= 0.6
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const cronSecret = Deno.env.get('CRON_SECRET')

    // 🔒 Dual auth: CRON_SECRET header OR valid authenticated JWT
    const cronHeader = req.headers.get('X-CRON-Secret')
    const hasCronAuth = cronSecret && cronHeader === cronSecret

    if (!hasCronAuth) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const token = authHeader.replace('Bearer ', '').trim()
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token)

      if (claimsError || !claimsData?.claims?.sub || claimsData.claims.role !== 'authenticated') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    console.log('🧹 Starting comprehensive cleanup of all suggestions...')

    const results = {
      invalid: { deleted: 0, rejected: 0, processed: 0 },
      duplicates: { rejected: 0, scanned: 0 },
      stale: { archived: 0, deleted: 0 },
      batch: { deletedUnmapped: 0, rejectedLowConf: 0 },
    }

    // ==========================================
    // STEP 0: BATCH DELETE low-confidence unmapped_domain suggestions
    // ==========================================
    console.log('🗑️ Step 0: Batch deleting low-confidence unmapped_domain suggestions...')

    const { data: deletedUnmapped, error: deleteUnmappedError } = await supabaseAdmin
      .from('email_to_etablissement_suggestions')
      .delete()
      .eq('status', 'pending')
      .eq('suggestion_type', 'unmapped_domain')
      .lt('match_confidence', 0.6)
      .select('id')

    if (!deleteUnmappedError && deletedUnmapped) {
      results.batch.deletedUnmapped = deletedUnmapped.length
      console.log(
        `  🗑️ Deleted ${deletedUnmapped.length} low-confidence unmapped_domain suggestions`
      )
    } else if (deleteUnmappedError) {
      console.error('Error batch deleting unmapped_domain:', deleteUnmappedError)
    }

    // Batch reject all suggestions with very low confidence
    const { data: rejectedLowConf, error: rejectLowConfError } = await supabaseAdmin
      .from('email_to_etablissement_suggestions')
      .update({ status: 'rejected' })
      .eq('status', 'pending')
      .lt('match_confidence', 0.5)
      .select('id')

    if (!rejectLowConfError && rejectedLowConf) {
      results.batch.rejectedLowConf = rejectedLowConf.length
      console.log(`  ⚠️ Rejected ${rejectedLowConf.length} very low confidence suggestions`)
    } else if (rejectLowConfError) {
      console.error('Error batch rejecting low confidence:', rejectLowConfError)
    }

    // ==========================================
    // STEP 1: Cleanup remaining invalid email suggestions
    // ==========================================
    console.log('📧 Step 1: Cleaning remaining invalid email suggestions...')

    const { data: emailSuggestions, error: fetchEmailError } = await supabaseAdmin
      .from('email_to_etablissement_suggestions')
      .select(
        `
        id,
        email_thread_id,
        match_confidence,
        extracted_data,
        status,
        created_at,
        suggestion_type,
        email_thread:email_threads(
          id,
          subject,
          messages:email_messages(from_address)
        )
      `
      )
      .eq('status', 'pending')
      .limit(500)

    if (fetchEmailError) {
      console.error('Error fetching email suggestions:', fetchEmailError)
    } else if (emailSuggestions && emailSuggestions.length > 0) {
      console.log(`  Found ${emailSuggestions.length} pending email suggestions`)

      // Get domain mappings
      const { data: domainMappings } = await supabaseAdmin
        .from('email_domain_mappings')
        .select('domain, is_excluded, niveau_mapping, partenaire_id, groupe_id')

      const excludedDomains = new Set(
        domainMappings?.filter((m) => m.is_excluded).map((m) => m.domain) || []
      )
      const partnerDomains = new Set(
        domainMappings?.filter((m) => m.niveau_mapping === 'partenaire').map((m) => m.domain) || []
      )
      const groupDomains = new Set(
        domainMappings?.filter((m) => m.niveau_mapping === 'groupe').map((m) => m.domain) || []
      )

      const genericDomains = new Set([
        'gmail.com',
        'outlook.com',
        'yahoo.fr',
        'hotmail.com',
        'free.fr',
        'orange.fr',
        'wanadoo.fr',
        'laposte.net',
      ])

      for (const suggestion of emailSuggestions) {
        let shouldReject = false
        let shouldDelete = false
        let reason = ''

        // Check low confidence
        if (suggestion.match_confidence && suggestion.match_confidence < 0.6) {
          shouldReject = true
          reason = 'Low confidence (<0.6)'
        }

        // Extract thread domains
        const threadDomains = new Set<string>()
        if (suggestion.email_thread?.messages) {
          for (const msg of suggestion.email_thread.messages) {
            if (msg.from_address && typeof msg.from_address === 'string') {
              const domain = msg.from_address.split('@')[1]?.toLowerCase()
              if (domain) threadDomains.add(domain)
            }
          }
        }

        // Check problematic domains
        for (const domain of threadDomains) {
          if (domain.includes('exploitant.example.org') || domain.includes('exploitant.example.org')) {
            shouldReject = true
            reason = 'Internal email'
          } else if (excludedDomains.has(domain)) {
            shouldDelete = true
            reason = 'Excluded domain'
          } else if (partnerDomains.has(domain)) {
            shouldDelete = true
            reason = 'Partner domain'
          } else if (groupDomains.has(domain)) {
            shouldDelete = true
            reason = 'Group domain'
          } else if (genericDomains.has(domain)) {
            shouldDelete = true
            reason = 'Generic domain'
          }
        }

        // Check invalid extracted data
        if (suggestion.extracted_data) {
          const data = suggestion.extracted_data as any
          if (data.nom_hint && data.ville_hint && data.nom_hint === data.ville_hint) {
            shouldReject = true
            reason = 'Invalid data (name = city)'
          }
        }

        // Check empty subject
        if (
          !suggestion.email_thread?.subject ||
          suggestion.email_thread.subject.trim() === '' ||
          suggestion.email_thread.subject.toLowerCase() === '(sans objet)'
        ) {
          shouldReject = true
          reason = 'Missing subject'
        }

        // Apply actions
        if (shouldDelete) {
          const { error: deleteError } = await supabaseAdmin
            .from('email_to_etablissement_suggestions')
            .delete()
            .eq('id', suggestion.id)

          if (!deleteError) {
            results.invalid.deleted++
            console.log(`  ✅ Deleted: ${reason}`)
          }
        } else if (shouldReject) {
          const { error: rejectError } = await supabaseAdmin
            .from('email_to_etablissement_suggestions')
            .update({ status: 'rejected' })
            .eq('id', suggestion.id)

          if (!rejectError) {
            results.invalid.rejected++
            console.log(`  ⚠️ Rejected: ${reason}`)
          }
        }

        results.invalid.processed++
      }
    }

    // Delete old unmapped_domain suggestions (> 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: oldUnmapped, error: oldUnmappedError } = await supabaseAdmin
      .from('email_to_etablissement_suggestions')
      .delete()
      .eq('suggestion_type', 'unmapped_domain')
      .lt('created_at', thirtyDaysAgo.toISOString())
      .select('id')

    if (!oldUnmappedError && oldUnmapped) {
      results.stale.deleted += oldUnmapped.length
      console.log(`  🗑️ Deleted ${oldUnmapped.length} old unmapped_domain suggestions`)
    }

    // ==========================================
    // STEP 2: Cleanup duplicate AI suggestions
    // ==========================================
    console.log('🤖 Step 2: Cleaning duplicate AI suggestions...')

    const { data: aiSuggestions, error: fetchAIError } = await supabaseAdmin
      .from('ai_suggested_actions')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (fetchAIError) {
      console.error('Error fetching AI suggestions:', fetchAIError)
    } else if (aiSuggestions && aiSuggestions.length > 0) {
      results.duplicates.scanned = aiSuggestions.length
      console.log(`  Found ${aiSuggestions.length} pending AI suggestions`)

      // Group by entity
      const byEntity = new Map<string, any[]>()

      for (const sugg of aiSuggestions) {
        const entityKey = sugg.etablissement_id || sugg.partenaire_id || 'no_entity'
        if (!byEntity.has(entityKey)) {
          byEntity.set(entityKey, [])
        }
        byEntity.get(entityKey)!.push(sugg)
      }

      const toReject: string[] = []

      for (const [entityKey, suggestions] of byEntity.entries()) {
        const kept = new Set<string>()

        for (let i = 0; i < suggestions.length; i++) {
          if (kept.has(suggestions[i].id)) continue

          const duplicates = []
          for (let j = i + 1; j < suggestions.length; j++) {
            if (kept.has(suggestions[j].id)) continue

            if (areSuggestionsSimilar(suggestions[i], suggestions[j])) {
              duplicates.push(suggestions[j])
            }
          }

          if (duplicates.length > 0) {
            const allInGroup = [suggestions[i], ...duplicates]
            const best = allInGroup.reduce((best, curr) =>
              (curr.confidence_score || 0) > (best.confidence_score || 0) ? curr : best
            )

            kept.add(best.id)

            const toDelete = allInGroup.filter((s) => s.id !== best.id)
            toReject.push(...toDelete.map((s) => s.id))
          } else {
            kept.add(suggestions[i].id)
          }
        }
      }

      if (toReject.length > 0) {
        const { error: rejectError } = await supabaseAdmin
          .from('ai_suggested_actions')
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reason: 'Auto-rejected: Duplicate suggestion',
          })
          .in('id', toReject)

        if (!rejectError) {
          results.duplicates.rejected = toReject.length
          console.log(`  ✂️ Rejected ${toReject.length} duplicate AI suggestions`)
        }
      }
    }

    // ==========================================
    // STEP 3: Archive stale multi_entity suggestions
    // ==========================================
    console.log('📦 Step 3: Archiving stale suggestions...')

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: archivedMulti, error: archiveError } = await supabaseAdmin
      .from('email_to_etablissement_suggestions')
      .update({ status: 'archived' })
      .eq('suggestion_type', 'multi_entity')
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo.toISOString())
      .select('id')

    if (!archiveError && archivedMulti) {
      results.stale.archived = archivedMulti.length
      console.log(`  📦 Archived ${archivedMulti.length} old multi_entity suggestions`)
    }

    // ==========================================
    // Summary
    // ==========================================
    const summary = {
      success: true,
      message: `Cleanup completed: ${results.invalid.deleted + results.stale.deleted} deleted, ${results.invalid.rejected + results.duplicates.rejected} rejected, ${results.stale.archived} archived`,
      results,
    }

    console.log('✅ Cleanup complete:', summary)

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    return buildErrorResponse('cleanup-all-suggestions', error, corsHeaders, 500)
  }
})
