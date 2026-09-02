import { useState, useCallback, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { useNavigate } from 'react-router-dom';
import { useWebRTC } from '@/hooks/voice/useWebRTC';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { VideoGrid } from './VideoGrid';
import { VisioControls } from './VisioControls';
import { VisioRoom as VisioRoomType, VisioParticipant } from '@/types/visio';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, VideoOff, Monitor } from 'lucide-react';
import { useTranscription } from '@/contexts/TranscriptionContext';

interface VisioRoomProps {
  room: VisioRoomType;
  onLeave?: (sessionId: string | null) => void;
}

export function VisioRoom({ room, onLeave }: VisioRoomProps) {
  const navigate = useNavigate();
  const { data: profile } = useCurrentProfile();
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Transcription context (auto-start, no user control needed)
  const { 
    activeSession, 
    startSession,
    endSession,
    isRecording: isTranscribing,
  } = useTranscription();

  const displayName = profile
    ? `${profile.prenom || ''} ${profile.nom || ''}`.trim() || profile.email || 'Anonyme'
    : 'Anonyme';

  const {
    isConnected,
    isConnecting,
    hasLeft,
    localStream,
    screenStream,
    remoteStreams,
    participants,
    mediaState,
    connect,
    disconnect,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTC({
    roomId: room.id,
    userId: profile?.id || '',
    displayName,
  });

  // Connect on mount - but never after user has left
  useEffect(() => {
    if (profile?.id && !isConnected && !isConnecting && !hasLeft) {
      connect();
    }
  }, [profile?.id, isConnected, isConnecting, hasLeft, connect]);

  // Auto-start transcription when connected (non-blocking)
  useEffect(() => {
    if (isConnected && profile?.id && !activeSession) {
      // Non-blocking: la visio fonctionne même si la transcription échoue
      startSession({
        title: room.name,
        roomCode: room.roomCode || undefined,
        provider: 'marque_meet',
        conversationId: room.conversationId,
        autoRecord: true,
      }).catch((err) => {
        debug.warn('Transcription auto-start failed (non-blocking):', err);
      });
    }
  }, [isConnected, profile?.id, activeSession, startSession, room.name, room.roomCode, room.conversationId]);

  const handleLeave = useCallback(() => {
    const sessionId = activeSession?.id || null;
    
    // Arrêter la transcription si active (non-bloquant)
    if (activeSession) {
      endSession().catch((err) => {
        debug.warn('[VisioRoom] Error ending transcription session:', err);
      });
    }
    
    // Déconnexion WebRTC (non-bloquant)
    disconnect().catch((err) => {
      debug.warn('[VisioRoom] Error disconnecting WebRTC:', err);
    });
    
    // Notifier le parent si callback fourni, sinon navigation
    if (onLeave) {
      onLeave(sessionId);
    } else {
      navigate(-1);
    }
  }, [disconnect, navigate, activeSession, endSession, onLeave]);

  // Create local participant object
  const localParticipant: VisioParticipant = {
    id: 'local',
    user_id: profile?.id || '',
    display_name: displayName,
    joined_at: new Date().toISOString(),
    is_muted: mediaState.isMuted,
    is_video_off: mediaState.isVideoOff,
    is_screen_sharing: mediaState.isScreenSharing,
    connection_quality: 'good',
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-semibold">{room.name}</h1>
            <p className="text-sm text-muted-foreground">
              {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
            </p>
          </div>
          {/* Transcription indicator */}
          {isTranscribing && (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="hidden sm:inline">Transcription</span>
            </div>
          )}
        </div>
        {room.roomCode && (
          <Badge variant="outline" className="font-mono">
            {room.roomCode}
          </Badge>
        )}
      </header>

      {/* Video grid */}
      <VideoGrid
        localStream={localStream}
        localParticipant={localParticipant}
        remoteStreams={remoteStreams}
        screenStream={screenStream}
        isScreenSharing={mediaState.isScreenSharing}
      />

      {/* Controls */}
      <VisioControls
        mediaState={mediaState}
        participantCount={participants.length + 1}
        onToggleMute={toggleMute}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onLeave={handleLeave}
        onOpenParticipants={() => setShowParticipants(true)}
      />

      {/* Participants drawer */}
      <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>Participants ({participants.length + 1})</SheetTitle>
          </SheetHeader>
          <ScrollArea className="mt-4 h-[calc(100vh-8rem)]">
            <div className="space-y-2">
              {/* Local participant */}
              <ParticipantListItem
                participant={localParticipant}
                isLocal
              />
              
              {/* Remote participants */}
              {participants.map(p => (
                <ParticipantListItem
                  key={p.user_id}
                  participant={p}
                />
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ParticipantListItem({
  participant,
  isLocal = false,
}: {
  participant: VisioParticipant;
  isLocal?: boolean;
}) {
  const initials = participant.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
      <Avatar className="w-10 h-10">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {participant.display_name}
          {isLocal && <span className="text-muted-foreground ml-1">(Vous)</span>}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {participant.is_screen_sharing && (
          <Monitor className="w-4 h-4 text-primary" />
        )}
        {participant.is_muted ? (
          <MicOff className="w-4 h-4 text-destructive" />
        ) : (
          <Mic className="w-4 h-4 text-muted-foreground" />
        )}
        {participant.is_video_off && (
          <VideoOff className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
