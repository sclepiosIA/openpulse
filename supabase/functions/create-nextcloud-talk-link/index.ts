import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  console.log('[create-nextcloud-talk-link] v1.1 - Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title } = await req.json();

    if (!title) {
      throw new Error('Title is required');
    }

    // Get shared Nextcloud credentials from Supabase secrets
    const NEXTCLOUD_URL = Deno.env.get('NEXTCLOUD_URL');
    const NEXTCLOUD_USERNAME = Deno.env.get('NEXTCLOUD_USERNAME');
    const NEXTCLOUD_APP_PASSWORD = Deno.env.get('NEXTCLOUD_APP_PASSWORD');

    // Debug logs
    console.log('[create-nextcloud-talk-link] DEBUG - NEXTCLOUD_URL:', NEXTCLOUD_URL);
    console.log('[create-nextcloud-talk-link] DEBUG - NEXTCLOUD_USERNAME:', NEXTCLOUD_USERNAME);
    console.log('[create-nextcloud-talk-link] DEBUG - APP_PASSWORD length:', NEXTCLOUD_APP_PASSWORD?.length, 'chars');
    console.log('[create-nextcloud-talk-link] DEBUG - APP_PASSWORD preview:', 
      NEXTCLOUD_APP_PASSWORD ? `${NEXTCLOUD_APP_PASSWORD.substring(0, 3)}...${NEXTCLOUD_APP_PASSWORD.substring(NEXTCLOUD_APP_PASSWORD.length - 3)}` : 'undefined'
    );

    if (!NEXTCLOUD_URL || !NEXTCLOUD_USERNAME || !NEXTCLOUD_APP_PASSWORD) {
      throw new Error('Nextcloud not configured. Please configure NEXTCLOUD_URL, NEXTCLOUD_USERNAME, and NEXTCLOUD_APP_PASSWORD secrets.');
    }

    const nextcloudBaseUrl = NEXTCLOUD_URL.replace(/\/+$/, '');
    console.log('[create-nextcloud-talk-link] DEBUG - Normalized base URL:', nextcloudBaseUrl);

    // Verify user is authenticated
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('[create-nextcloud-talk-link] User authenticated, using shared Nextcloud account');

    // Create basic auth header
    const basicAuth = btoa(`${NEXTCLOUD_USERNAME}:${NEXTCLOUD_APP_PASSWORD}`);

    // Create a public Talk room
    const talkApiUrl = `${nextcloudBaseUrl}/ocs/v2.php/apps/spreed/api/v4/room`;
    
    const talkResponse = await fetch(talkApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'OCS-APIRequest': 'true',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        roomType: 3, // Public room
        roomName: title.substring(0, 100) // Nextcloud has a limit on room name length
      })
    });

    console.log('[create-nextcloud-talk-link] DEBUG - API URL:', talkApiUrl);
    console.log('[create-nextcloud-talk-link] DEBUG - Response status:', talkResponse.status);

    if (!talkResponse.ok) {
      const errorText = await talkResponse.text();
      console.error('[create-nextcloud-talk-link] Talk API error:', errorText);
      console.error('[create-nextcloud-talk-link] DEBUG - Full error response:', {
        status: talkResponse.status,
        statusText: talkResponse.statusText,
        headers: Object.fromEntries(talkResponse.headers.entries())
      });
      throw new Error('Failed to create Nextcloud Talk room. Check credentials and permissions.');
    }

    const talkData = await talkResponse.json();
    
    // OCS API wraps response in ocs.data
    const roomData = talkData.ocs?.data;
    
    if (!roomData?.token) {
      console.error('[create-nextcloud-talk-link] Unexpected response:', talkData);
      throw new Error('No room token in Nextcloud response');
    }

    // Construct the Talk call URL
    const talkLink = `${nextcloudBaseUrl}/call/${roomData.token}`;

    console.log('[create-nextcloud-talk-link] Created Talk link:', talkLink);

    return new Response(
      JSON.stringify({ 
        success: true, 
        talkLink,
        roomToken: roomData.token,
        roomName: roomData.displayName || title
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('create-nextcloud-talk-link', error, corsHeaders, 500);
  }
});
