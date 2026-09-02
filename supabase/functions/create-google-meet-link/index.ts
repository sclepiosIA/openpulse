import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";

import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

serve(async (req) => {
  console.log('[create-google-meet-link] v1.1 - Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, startTime, endTime } = await req.json();

    if (!title) {
      throw new Error('Title is required');
    }

    // Get shared OAuth credentials from Supabase secrets
    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const GOOGLE_REFRESH_TOKEN = Deno.env.get('GOOGLE_REFRESH_TOKEN');

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }

    if (!GOOGLE_REFRESH_TOKEN) {
      throw new Error('Google refresh token not configured. Please run oauth-google-setup to get the GOOGLE_REFRESH_TOKEN.');
    }

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

    console.log('[create-google-meet-link] User authenticated, using shared Google account');

    // Refresh the access token using the shared refresh_token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[create-google-meet-link] Token refresh error:', errorText);
      throw new Error('Failed to refresh Google access token. The shared account may need to be re-authorized.');
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    console.log('[create-google-meet-link] Access token refreshed successfully');

    // Default times if not provided
    const now = new Date();
    const defaultStart = startTime || now.toISOString();
    const defaultEnd = endTime || new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Create calendar event with Meet link
    const eventData = {
      summary: title,
      start: { dateTime: defaultStart, timeZone: 'Europe/Paris' },
      end: { dateTime: defaultEnd, timeZone: 'Europe/Paris' },
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    };

    const calendarResponse = await fetch(
      `${GOOGLE_CALENDAR_API}?conferenceDataVersion=1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      }
    );

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error('[create-google-meet-link] Calendar API error:', errorText);
      throw new Error('Failed to create Google Meet link');
    }

    const event = await calendarResponse.json();
    const meetLink = event.hangoutLink;

    if (!meetLink) {
      throw new Error('No Meet link in response');
    }

    console.log('[create-google-meet-link] Created Meet link:', meetLink);

    return new Response(
      JSON.stringify({ 
        success: true, 
        meetLink,
        eventId: event.id,
        eventLink: event.htmlLink
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    return buildErrorResponse('create-google-meet-link', error, corsHeaders, 500);
  }
});
