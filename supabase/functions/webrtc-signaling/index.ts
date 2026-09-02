import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { buildErrorResponse } from "../_shared/error-sanitizer.ts";


import { corsHeaders } from '../_shared/cors.ts'
// en-tetes autorises d'origine : authorization, x-client-info, apikey, content-type;

interface SignalingPayload {
  action: 'create-room' | 'join-room' | 'leave-room' | 'signal' | 'get-room' | 'update-participant';
  roomId?: string;
  roomCode?: string;
  conversationId?: string;
  calendarEventId?: string;
  name?: string;
  displayName?: string;
  signalType?: 'offer' | 'answer' | 'ice-candidate';
  signalData?: any;
  targetUserId?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get profile ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, nom, prenom, email')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: SignalingPayload = await req.json();
    console.log(`[webrtc-signaling] Action: ${payload.action}, User: ${profile.email}`);

    switch (payload.action) {
      case 'create-room': {
        // Create a new visio room
        const { data: room, error: createError } = await supabase
          .from('pulse_visio_rooms')
          .insert({
            name: payload.name || 'Réunion OpenPulse',
            created_by: profile.id,
            conversation_id: payload.conversationId || null,
            calendar_event_id: payload.calendarEventId || null,
            status: 'waiting',
          })
          .select('*')
          .single();

        if (createError) {
          console.error('[webrtc-signaling] Create room error:', createError);
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Add creator as first participant
        await supabase
          .from('pulse_visio_participants')
          .insert({
            room_id: room.id,
            user_id: profile.id,
            display_name: `${profile.prenom || ''} ${profile.nom || ''}`.trim() || profile.email,
          });

        console.log(`[webrtc-signaling] Room created: ${room.room_code}`);

        // Send push notification to conversation members if linked to a conversation
        if (payload.conversationId) {
          try {
            // Get conversation members except creator
            const { data: members } = await supabase
              .from('pulse_conversation_members')
              .select('user_id')
              .eq('conversation_id', payload.conversationId)
              .neq('user_id', profile.id);

            if (members && members.length > 0) {
              const userIds = members.map(m => m.user_id);
              const displayName = `${profile.prenom || ''} ${profile.nom || ''}`.trim() || profile.email;

              // Invoke push notification function
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  user_ids: userIds,
                  title: '📹 Appel vidéo',
                  body: `${displayName} a démarré une visio`,
                  url: `/pulse?conversation=${payload.conversationId}`,
                  tag: `pulse_visio_${room.room_code}`,
                  type: 'pulse_visio',
                  related_id: room.id,
                },
              });

              console.log(`[webrtc-signaling] Push notification sent to ${userIds.length} members`);
            }
          } catch (notifyError) {
            console.error('[webrtc-signaling] Failed to send push notification:', notifyError);
            // Don't fail room creation if notification fails
          }
        }

        return new Response(JSON.stringify({
          success: true,
          room: {
            id: room.id,
            roomCode: room.room_code,
            name: room.name,
            status: room.status,
            link: `/visio/${room.room_code}`,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-room': {
        // Get room by code
        const { data: room, error: roomError } = await supabase
          .from('pulse_visio_rooms')
          .select(`
            *,
            created_by_profile:profiles!pulse_visio_rooms_created_by_fkey(id, nom, prenom, email),
            participants:pulse_visio_participants(
              id, user_id, display_name, joined_at, left_at, 
              is_muted, is_video_off, is_screen_sharing, connection_quality
            )
          `)
          .eq('room_code', payload.roomCode)
          .single();

        if (roomError) {
          return new Response(JSON.stringify({ error: 'Room not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Filter active participants (no left_at)
        const activeParticipants = room.participants?.filter((p: any) => !p.left_at) || [];

        return new Response(JSON.stringify({
          success: true,
          room: {
            id: room.id,
            roomCode: room.room_code,
            name: room.name,
            status: room.status,
            createdBy: room.created_by_profile,
            conversationId: room.conversation_id,
            participants: activeParticipants,
            startedAt: room.started_at,
            maxParticipants: room.max_participants,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'join-room': {
        // Find room by code or ID
        let room;
        if (payload.roomCode) {
          const { data, error } = await supabase
            .from('pulse_visio_rooms')
            .select('*')
            .eq('room_code', payload.roomCode)
            .single();
          if (error) throw new Error('Room not found');
          room = data;
        } else if (payload.roomId) {
          const { data, error } = await supabase
            .from('pulse_visio_rooms')
            .select('*')
            .eq('id', payload.roomId)
            .single();
          if (error) throw new Error('Room not found');
          room = data;
        } else {
          throw new Error('Room code or ID required');
        }

        if (room.status === 'ended') {
          return new Response(JSON.stringify({ error: 'Room has ended' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if already a participant
        const { data: existingParticipant } = await supabase
          .from('pulse_visio_participants')
          .select('*')
          .eq('room_id', room.id)
          .eq('user_id', profile.id)
          .is('left_at', null)
          .single();

        if (!existingParticipant) {
          // Add as participant
          await supabase
            .from('pulse_visio_participants')
            .insert({
              room_id: room.id,
              user_id: profile.id,
              display_name: payload.displayName || `${profile.prenom || ''} ${profile.nom || ''}`.trim() || profile.email,
            });
        }

        // Update room status to active if first active participant
        if (room.status === 'waiting') {
          await supabase
            .from('pulse_visio_rooms')
            .update({ status: 'active', started_at: new Date().toISOString() })
            .eq('id', room.id);
        }

        // Get all participants
        const { data: participants } = await supabase
          .from('pulse_visio_participants')
          .select('*')
          .eq('room_id', room.id)
          .is('left_at', null);

        console.log(`[webrtc-signaling] User ${profile.email} joined room ${room.room_code}`);

        return new Response(JSON.stringify({
          success: true,
          room: {
            id: room.id,
            roomCode: room.room_code,
            name: room.name,
            status: 'active',
            conversationId: room.conversation_id,
          },
          participants: participants || [],
          userId: profile.id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'leave-room': {
        // Mark participant as left
        const { error: leaveError } = await supabase
          .from('pulse_visio_participants')
          .update({ left_at: new Date().toISOString() })
          .eq('room_id', payload.roomId)
          .eq('user_id', profile.id)
          .is('left_at', null);

        if (leaveError) {
          console.error('[webrtc-signaling] Leave error:', leaveError);
        }

        // Check if room is now empty
        const { data: remaining } = await supabase
          .from('pulse_visio_participants')
          .select('id')
          .eq('room_id', payload.roomId)
          .is('left_at', null);

        if (!remaining || remaining.length === 0) {
          // End the room
          await supabase
            .from('pulse_visio_rooms')
            .update({ status: 'ended', ended_at: new Date().toISOString() })
            .eq('id', payload.roomId);
        }

        console.log(`[webrtc-signaling] User ${profile.email} left room ${payload.roomId}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'signal': {
        // Store signaling data in participant record for Realtime to pick up
        if (payload.signalType === 'offer') {
          await supabase
            .from('pulse_visio_participants')
            .update({ sdp_offer: payload.signalData })
            .eq('room_id', payload.roomId)
            .eq('user_id', profile.id);
        } else if (payload.signalType === 'answer') {
          await supabase
            .from('pulse_visio_participants')
            .update({ sdp_answer: payload.signalData })
            .eq('room_id', payload.roomId)
            .eq('user_id', profile.id);
        } else if (payload.signalType === 'ice-candidate') {
          // Append ICE candidate
          const { data: participant } = await supabase
            .from('pulse_visio_participants')
            .select('ice_candidates')
            .eq('room_id', payload.roomId)
            .eq('user_id', profile.id)
            .single();

          const candidates = participant?.ice_candidates || [];
          candidates.push(payload.signalData);

          await supabase
            .from('pulse_visio_participants')
            .update({ ice_candidates: candidates })
            .eq('room_id', payload.roomId)
            .eq('user_id', profile.id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-participant': {
        // Update participant state
        const updates: any = {};
        if (typeof payload.isMuted === 'boolean') updates.is_muted = payload.isMuted;
        if (typeof payload.isVideoOff === 'boolean') updates.is_video_off = payload.isVideoOff;
        if (typeof payload.isScreenSharing === 'boolean') updates.is_screen_sharing = payload.isScreenSharing;

        await supabase
          .from('pulse_visio_participants')
          .update(updates)
          .eq('room_id', payload.roomId)
          .eq('user_id', profile.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    return buildErrorResponse('webrtc-signaling', error, corsHeaders, 500);
  }

});
