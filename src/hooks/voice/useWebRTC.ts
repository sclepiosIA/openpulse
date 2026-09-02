import { useState, useCallback, useRef, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/shared/use-toast';
import { sanitizeSupabaseError } from '@/lib/supabaseErrorSanitizer';
import {
  VisioParticipant,
  LocalMediaState,
  ICE_SERVERS,
  VIDEO_CONSTRAINTS,
  VisioSettings,
} from '@/types/visio';

interface UseWebRTCOptions {
  roomId: string;
  userId: string;
  displayName: string;
  onParticipantJoined?: (participant: VisioParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onParticipantUpdated?: (participant: VisioParticipant) => void;
}

interface RemoteStream {
  peerId: string;
  stream: MediaStream;
  participant: VisioParticipant;
}

export function useWebRTC({
  roomId,
  userId,
  displayName,
  onParticipantJoined,
  onParticipantLeft,
  onParticipantUpdated,
}: UseWebRTCOptions) {
  const { toast } = useToast();
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasLeft, setHasLeft] = useState(false); // Prevent reconnection after voluntary leave
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, RemoteStream>>(new Map());
  const [participants, setParticipants] = useState<VisioParticipant[]>([]);
  const [mediaState, setMediaState] = useState<LocalMediaState>({
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
  });
  const [settings, setSettings] = useState<VisioSettings>({
    videoQuality: 'medium',
    noiseSuppression: true,
    echoCancellation: true,
  });
  
  // Refs
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  // Initialize local media
  const initLocalMedia = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          deviceId: settings.audioInputDevice,
        },
        video: settings.videoInputDevice
          ? { deviceId: settings.videoInputDevice, ...VIDEO_CONSTRAINTS[settings.videoQuality] }
          : VIDEO_CONSTRAINTS[settings.videoQuality],
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (error: unknown) {
      debug.error('[WebRTC] Failed to get local media:', error);
      toast({
        title: 'Erreur média',
        description: "Impossible d'accéder à la caméra/micro. Vérifiez les permissions.",
        variant: 'destructive',
      });
      return null;
    }
  }, [settings, toast]);
  
  // Create peer connection
  const createPeerConnection = useCallback((peerId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        // Send ICE candidate via signaling
        await supabase.functions.invoke('webrtc-signaling', {
          body: {
            action: 'signal',
            roomId,
            signalType: 'ice-candidate',
            signalData: event.candidate.toJSON(),
            targetUserId: peerId,
          },
        });
      }
    };
    
    // Handle incoming tracks
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          const existing = updated.get(peerId);
          updated.set(peerId, {
            peerId: peerId,
            stream,
            participant: existing?.participant || { user_id: peerId } as VisioParticipant,
          });
          return updated;
        });
      }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      debug.log(`[WebRTC] Connection state with ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Attempt reconnection
        debug.log(`[WebRTC] Connection with ${peerId} failed, cleaning up`);
        peerConnections.current.delete(peerId);
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.delete(peerId);
          return updated;
        });
      }
    };
    
    peerConnections.current.set(peerId, pc);
    return pc;
  }, [localStream, roomId]);
  
  // Create and send offer
  const createOffer = useCallback(async (peerId: string) => {
    const pc = createPeerConnection(peerId, true);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await supabase.functions.invoke('webrtc-signaling', {
        body: {
          action: 'signal',
          roomId,
          signalType: 'offer',
          signalData: pc.localDescription?.toJSON(),
          targetUserId: peerId,
        },
      });
    } catch (error) {
      debug.error('[WebRTC] Failed to create offer:', error);
    }
  }, [createPeerConnection, roomId]);
  
  // Handle incoming offer
  const handleOffer = useCallback(async (peerId: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(peerId, false);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      await supabase.functions.invoke('webrtc-signaling', {
        body: {
          action: 'signal',
          roomId,
          signalType: 'answer',
          signalData: pc.localDescription?.toJSON(),
          targetUserId: peerId,
        },
      });
    } catch (error) {
      debug.error('[WebRTC] Failed to handle offer:', error);
    }
  }, [createPeerConnection, roomId]);
  
  // Handle incoming answer
  const handleAnswer = useCallback(async (peerId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        debug.error('[WebRTC] Failed to handle answer:', error);
      }
    }
  }, []);
  
  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (peerId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        debug.error('[WebRTC] Failed to add ICE candidate:', error);
      }
    }
  }, []);
  
  // Connect to room
  const connect = useCallback(async () => {
    if (isConnecting || isConnected || hasLeft) return;
    
    setIsConnecting(true);
    
    try {
      // Initialize local media first
      const stream = await initLocalMedia();
      if (!stream) {
        setIsConnecting(false);
        return;
      }
      
      // Join room via signaling
      const { data, error } = await supabase.functions.invoke('webrtc-signaling', {
        body: {
          action: 'join-room',
          roomId,
          displayName,
        },
      });
      
      if (error) throw error;
      
      // Set initial participants
      setParticipants(data.participants || []);
      
      // Subscribe to Realtime for signaling
      const channel = supabase
        .channel(`visio-room-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pulse_visio_participants',
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            const participant = payload.new as VisioParticipant;
            
            if (payload.eventType === 'INSERT' && participant.user_id !== userId) {
              // New participant joined
              setParticipants(prev => [...prev, participant]);
              onParticipantJoined?.(participant);
              
              // Create offer to new participant
              await createOffer(participant.user_id);
            } else if (payload.eventType === 'UPDATE') {
              if (participant.user_id !== userId) {
                // Handle signaling data
                if (participant.sdp_offer && !peerConnections.current.has(participant.user_id)) {
                  await handleOffer(participant.user_id, participant.sdp_offer);
                } else if (participant.sdp_answer) {
                  await handleAnswer(participant.user_id, participant.sdp_answer);
                }
                
                // Handle ICE candidates
                if (participant.ice_candidates?.length) {
                  const lastCandidate = participant.ice_candidates[participant.ice_candidates.length - 1];
                  await handleIceCandidate(participant.user_id, lastCandidate);
                }
              }
              
              // Update participant state
              setParticipants(prev => 
                prev.map(p => p.user_id === participant.user_id ? participant : p)
              );
              onParticipantUpdated?.(participant);
            } else if (payload.eventType === 'DELETE' || participant.left_at) {
              // Participant left
              const leftId = participant.user_id;
              setParticipants(prev => prev.filter(p => p.user_id !== leftId));
              onParticipantLeft?.(leftId);
              
              // Clean up peer connection
              const pc = peerConnections.current.get(leftId);
              if (pc) {
                pc.close();
                peerConnections.current.delete(leftId);
              }
              setRemoteStreams(prev => {
                const updated = new Map(prev);
                updated.delete(leftId);
                return updated;
              });
            }
          }
        )
        .subscribe();
      
      channelRef.current = channel;
      setIsConnected(true);
      
      // Create offers to existing participants
      for (const participant of data.participants || []) {
        if (participant.user_id !== userId) {
          await createOffer(participant.user_id);
        }
      }
    } catch (error: unknown) {
      debug.error('[WebRTC] Failed to connect:', error);
      toast({
        title: 'Erreur de connexion',
        description: sanitizeSupabaseError(error),
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [
    isConnecting, isConnected, initLocalMedia, roomId, displayName, userId,
    createOffer, handleOffer, handleAnswer, handleIceCandidate, toast,
    onParticipantJoined, onParticipantLeft, onParticipantUpdated
  ]);
  
  // Disconnect from room
  const disconnect = useCallback(async () => {
    // Mark as left to prevent any reconnection attempts
    setHasLeft(true);
    
    // Leave room via signaling (fire and forget, don't await)
    supabase.functions.invoke('webrtc-signaling', {
      body: { action: 'leave-room', roomId },
    }).catch(console.warn);
    
    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    // Stop local streams
    localStream?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());
    
    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // Reset state
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setParticipants([]);
    setIsConnected(false);
  }, [roomId, localStream, screenStream]);
  
  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuted = !audioTrack.enabled;
        setMediaState(prev => ({ ...prev, isMuted: newMuted }));
        
        // Update server
        await supabase.functions.invoke('webrtc-signaling', {
          body: { action: 'update-participant', roomId, isMuted: newMuted },
        });
      }
    }
  }, [localStream, roomId]);
  
  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newVideoOff = !videoTrack.enabled;
        setMediaState(prev => ({ ...prev, isVideoOff: newVideoOff }));
        
        // Update server
        await supabase.functions.invoke('webrtc-signaling', {
          body: { action: 'update-participant', roomId, isVideoOff: newVideoOff },
        });
      }
    }
  }, [localStream, roomId]);
  
  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (mediaState.isScreenSharing) {
      // Stop screen sharing
      screenStream?.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setMediaState(prev => ({ ...prev, isScreenSharing: false }));
      
      // Restore camera track to peers
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
          }
        });
      }
      
      await supabase.functions.invoke('webrtc-signaling', {
        body: { action: 'update-participant', roomId, isScreenSharing: false },
      });
    } else {
      // Start screen sharing
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setMediaState(prev => ({ ...prev, isScreenSharing: true }));
        
        // Replace video track in all peer connections
        const screenTrack = stream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });
        
        // Handle user stopping share via browser UI
        screenTrack.onended = () => {
          toggleScreenShare();
        };
        
        await supabase.functions.invoke('webrtc-signaling', {
          body: { action: 'update-participant', roomId, isScreenSharing: true },
        });
      } catch (error) {
        debug.error('[WebRTC] Screen share failed:', error);
      }
    }
  }, [mediaState.isScreenSharing, screenStream, localStream, roomId]);
  
  // Cleanup on unmount - ensures channel is removed even if disconnect wasn't called
  useEffect(() => {
    return () => {
      // Clean up Supabase channel to prevent memory leaks
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // Stop all local media tracks
      localStream?.getTracks().forEach(track => track.stop());
      screenStream?.getTracks().forEach(track => track.stop());
      // Close all peer connections
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
    };
  }, [localStream, screenStream]);
  
  return {
    // State
    isConnected,
    isConnecting,
    hasLeft,
    localStream,
    screenStream,
    remoteStreams: Array.from(remoteStreams.values()),
    participants,
    mediaState,
    settings,
    
    // Actions
    connect,
    disconnect,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    setSettings,
    initLocalMedia,
  };
}
