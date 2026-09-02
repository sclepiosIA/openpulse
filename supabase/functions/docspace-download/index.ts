import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import { buildErrorResponse } from '../_shared/error-sanitizer.ts'

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type

/**
 * DocSpace Download Edge Function
 *
 * Downloads a document from DocSpace and saves it back to Supabase Storage.
 * Used when closing the editor to sync changes back.
 */

export async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const DOCSPACE_URL = Deno.env.get('ONLYOFFICE_DOCSPACE_URL')
    const API_KEY = Deno.env.get('ONLYOFFICE_API_KEY')

    if (!DOCSPACE_URL || !API_KEY) {
      throw new Error('DocSpace configuration missing')
    }

    const docspaceAuth = API_KEY.startsWith('Bearer ') ? API_KEY : `Bearer ${API_KEY}`

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        // This is a short-lived Edge Function client, not a browser session.
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token)

    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { documentId, docSpaceFileId, deleteFromDocSpace = true } = body

    if (!documentId || !docSpaceFileId) {
      return new Response(JSON.stringify({ error: 'Missing documentId or docSpaceFileId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get document info via user-scoped client so RLS applies (ownership / folder permissions)
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle()

    if (docError || !document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Download content from DocSpace (force binary download)
    const contentResponse = await fetch(
      `${DOCSPACE_URL}/api/2.0/files/${docSpaceFileId}/download`,
      {
        method: 'GET',
        headers: {
          Authorization: docspaceAuth,
        },
      }
    )

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text()
      console.error('DocSpace download failed:', contentResponse.status, errorText)
      return new Response(
        JSON.stringify({
          error: 'Failed to download from DocSpace',
          details: errorText,
          status: contentResponse.status,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const fileBlob = await contentResponse.blob()
    const fileBuffer = await fileBlob.arrayBuffer()

    // Upload to Supabase Storage (overwrite existing)
    const { error: uploadError } = await supabaseAdmin.storage
      .from(document.storage_bucket)
      .upload(document.storage_path, fileBuffer, {
        contentType: document.mime_type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return new Response(JSON.stringify({ error: 'Failed to save to storage' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update document metadata
    await supabaseAdmin
      .from('documents')
      .update({
        updated_at: new Date().toISOString(),
        file_size_bytes: fileBuffer.byteLength,
        source_type: null,
        source_id: null,
      })
      .eq('id', documentId)

    // Log audit entry
    await supabaseAdmin.from('document_audit_log').insert({
      document_id: documentId,
      action: 'edited_docspace',
      performed_by: claimsData.user.id,
      new_value: {
        size: fileBuffer.byteLength,
        saved_at: new Date().toISOString(),
      },
    })

    // Optionally delete the file from DocSpace
    if (deleteFromDocSpace) {
      try {
        await fetch(`${DOCSPACE_URL}/api/2.0/files/file/${docSpaceFileId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        })
        console.log('Deleted temporary file from DocSpace')
      } catch (deleteErr) {
        console.warn('Failed to delete from DocSpace:', deleteErr)
        // Non-blocking, continue anyway
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    return buildErrorResponse('docspace-download', error, corsHeaders, 500)
  }
}

serve(handler)
