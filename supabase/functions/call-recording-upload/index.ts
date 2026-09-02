// Edge function: call-recording-upload
// Reçoit un blob audio multipart et l'upload dans le bucket privé call-recordings.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { origineAutorisee } from '../_shared/cors.ts'
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': origineAutorisee(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const form = await req.formData();
    const callId = form.get('call_id')?.toString();
    const file = form.get('file');

    if (!callId || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Missing call_id or file' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier ownership de l'appel
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('id, user_id')
      .eq('id', callId)
      .single();

    if (callError || !call || call.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Call not found or forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limite taille 50 Mo
    if (file.size > 50 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large (max 50 MB)' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'webm';
    const path = `${user.id}/${callId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('call-recordings')
      .upload(path, file, {
        contentType: file.type || 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      console.error('[call-recording-upload] Upload error:', uploadError.message);
      return new Response(JSON.stringify({ error: 'Upload failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabase
      .from('calls')
      .update({ recording_path: path })
      .eq('id', callId);

    if (updateError) {
      console.error('[call-recording-upload] DB update error:', updateError.message);
    }

    return new Response(JSON.stringify({ ok: true, path }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    return buildErrorResponse('call-recording-upload', e, corsHeaders, 500);
  }
});
