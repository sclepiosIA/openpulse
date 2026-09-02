import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();

    switch (action) {
      case 'create': {
        const { title, roomCode, externalMeetingUrl, etablissementId, partenaireId, groupeId, conversationId, userId, language = 'fr' } = params;

        if (!title || !userId) {
          throw new Error('Title and userId are required');
        }

        // Create session
        const { data: session, error: sessionError } = await supabase
          .from('visio_transcription_sessions')
          .insert({
            title,
            room_code: roomCode,
            external_meeting_url: externalMeetingUrl,
            etablissement_id: etablissementId,
            partenaire_id: partenaireId,
            groupe_id: groupeId,
            conversation_id: conversationId,
            created_by: userId,
            language,
            status: 'active',
          })
          .select()
          .single();

        if (sessionError) throw sessionError;

        // Add creator as participant
        const { error: participantError } = await supabase
          .from('visio_transcription_participants')
          .insert({
            session_id: session.id,
            user_id: userId,
            display_name: params.displayName || 'Participant',
            is_transcribing: false,
          });

        if (participantError) {
          console.error('Error adding participant:', participantError);
        }

        console.log(`Created transcription session: ${session.id}`);

        return new Response(JSON.stringify({
          success: true,
          session,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'join': {
        const { sessionId, userId, displayName } = params;

        if (!sessionId || !userId) {
          throw new Error('sessionId and userId are required');
        }

        // Check session exists and is active
        const { data: session, error: sessionError } = await supabase
          .from('visio_transcription_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionError || !session) {
          throw new Error('Session not found');
        }

        if (session.status !== 'active') {
          throw new Error('Session is no longer active');
        }

        // Add or update participant
        const { data: participant, error: participantError } = await supabase
          .from('visio_transcription_participants')
          .upsert({
            session_id: sessionId,
            user_id: userId,
            display_name: displayName || 'Participant',
            joined_at: new Date().toISOString(),
            left_at: null,
            is_transcribing: false,
          }, {
            onConflict: 'session_id,user_id',
          })
          .select()
          .single();

        if (participantError) throw participantError;

        console.log(`User ${userId} joined session ${sessionId}`);

        return new Response(JSON.stringify({
          success: true,
          session,
          participant,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'leave': {
        const { sessionId, userId } = params;

        if (!sessionId || !userId) {
          throw new Error('sessionId and userId are required');
        }

        const { error } = await supabase
          .from('visio_transcription_participants')
          .update({
            left_at: new Date().toISOString(),
            is_transcribing: false,
          })
          .eq('session_id', sessionId)
          .eq('user_id', userId);

        if (error) throw error;

        console.log(`User ${userId} left session ${sessionId}`);

        return new Response(JSON.stringify({
          success: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-transcribing': {
        const { sessionId, userId, isTranscribing } = params;

        if (!sessionId || !userId) {
          throw new Error('sessionId and userId are required');
        }

        const { error } = await supabase
          .from('visio_transcription_participants')
          .update({ is_transcribing: isTranscribing })
          .eq('session_id', sessionId)
          .eq('user_id', userId);

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'end': {
        const { sessionId, userId } = params;

        if (!sessionId) {
          throw new Error('sessionId is required');
        }

        // Update session status
        const { data: session, error: sessionError } = await supabase
          .from('visio_transcription_sessions')
          .update({
            status: 'processing',
            ended_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (sessionError) throw sessionError;

        // Mark all participants as left
        await supabase
          .from('visio_transcription_participants')
          .update({
            left_at: new Date().toISOString(),
            is_transcribing: false,
          })
          .eq('session_id', sessionId)
          .is('left_at', null);

        console.log(`Session ${sessionId} ended, triggering summary processing...`);

        // Trigger summary processing asynchronously
        const baseUrl = supabaseUrl.replace('.supabase.co', '.supabase.co/functions/v1');
        fetch(`${baseUrl}/process-transcription-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ sessionId }),
        }).catch(err => console.error('Error triggering summary:', err));

        return new Response(JSON.stringify({
          success: true,
          session,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get': {
        const { sessionId } = params;

        if (!sessionId) {
          throw new Error('sessionId is required');
        }

        const { data: session, error: sessionError } = await supabase
          .from('visio_transcription_sessions')
          .select(`
            *,
            participants:visio_transcription_participants(*),
            segments:visio_transcription_segments(*)
          `)
          .eq('id', sessionId)
          .single();

        if (sessionError) throw sessionError;

        return new Response(JSON.stringify({
          success: true,
          session,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error: unknown) {
    return buildErrorResponse('visio-transcription-session', error, corsHeaders, 500);
  }

});
