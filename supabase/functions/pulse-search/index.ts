import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

interface SearchPayload {
  query: string
  conversation_id?: string
  limit?: number
  offset?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })

    // Verify auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get the profile ID from auth user ID
    // pulse_conversation_members uses profiles.id, not auth.users.id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('[Pulse Search] Profile not found for auth user:', user.id, profileError)
      return new Response(JSON.stringify({ results: [], total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const profileId = profile.id

    const payload: SearchPayload = await req.json()
    const { query, conversation_id, limit = 20, offset = 0 } = payload

    console.log('[Pulse Search] Query:', query, 'AuthUser:', user.id, 'ProfileId:', profileId)

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({
          results: [],
          total: 0,
          error: 'Query must be at least 2 characters',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user's conversations using profile ID (not auth user ID)
    const { data: memberships } = await supabase
      .from('pulse_conversation_members')
      .select('conversation_id')
      .eq('user_id', profileId)

    if (!memberships || memberships.length === 0) {
      return new Response(JSON.stringify({ results: [], total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userConversationIds = memberships.map((m) => m.conversation_id)

    // Build search query
    const searchTerms = query
      .trim()
      .split(/\s+/)
      .map((t) => `${t}:*`)
      .join(' & ')

    let searchQuery = supabase
      .from('pulse_messages')
      .select(
        `
        id,
        content,
        created_at,
        conversation_id,
        user:profiles!pulse_messages_user_id_fkey(id, nom, prenom, email),
        conversation:pulse_conversations!pulse_messages_conversation_id_fkey(id, name)
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .in('conversation_id', userConversationIds)
      .textSearch('search_vector', searchTerms)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (conversation_id) {
      searchQuery = searchQuery.eq('conversation_id', conversation_id)
    }

    const { data: results, count, error: searchError } = await searchQuery

    if (searchError) {
      console.error('[Pulse Search] Error:', searchError)
      throw new Error(`Search failed: ${searchError.message}`)
    }

    console.log(`[Pulse Search] Found ${count} results for "${query}"`)

    // Highlight search terms in results
    const highlightedResults =
      results?.map((r: any) => {
        const queryWords = query.toLowerCase().split(/\s+/)
        let highlightedContent = r.content

        queryWords.forEach((word) => {
          const regex = new RegExp(`(${word})`, 'gi')
          highlightedContent = highlightedContent.replace(regex, '**$1**')
        })

        return {
          ...r,
          content_highlighted: highlightedContent,
        }
      }) || []

    return new Response(
      JSON.stringify({
        results: highlightedResults,
        total: count || 0,
        query,
        limit,
        offset,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    return buildErrorResponse('pulse-search', error, corsHeaders, 500)
  }
})
