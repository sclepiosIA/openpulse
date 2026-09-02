import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { debug } from '@/lib/debug';
import { Button } from '@/components/ui/button';
import { invokeEdge } from "@/services/edgeFunctions";
import { useAuth } from '@/components/AuthProvider';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { VisioLobby } from './VisioLobby';
import { VisioRoom } from './VisioRoom';
import { TranscriptionShareModal } from './TranscriptionShareModal';
import type { VisioRoom as VisioRoomType } from '@/types/visio';

const DISPLAY_NAME_STORAGE_KEY = 'marque.visio.displayName';

interface VisioOverlayProps {
  roomCode: string;
  roomName: string;
  onClose: () => void;
}

export function VisioOverlay({ roomCode, roomName, onClose }: VisioOverlayProps) {
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  const [room, setRoom] = useState<VisioRoomType | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Post-visio transcription share modal state
  const [showTranscriptionShare, setShowTranscriptionShare] = useState(false);
  const [endedSessionId, setEndedSessionId] = useState<string | null>(null);
  
  // Initialize displayName from localStorage, then user email, then empty
  const [displayName, setDisplayName] = useState(() => {
    const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (stored) return stored;
    return user?.email || '';
  });

  // Update displayName when profile loads (if not already set from localStorage)
  useEffect(() => {
    if (profile && !localStorage.getItem(DISPLAY_NAME_STORAGE_KEY)) {
      const name = `${profile.prenom || ''} ${profile.nom || ''}`.trim() || profile.email || '';
      if (name) {
        setDisplayName(name);
        localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name);
      }
    }
  }, [profile]);

  // Persist displayName changes
  const handleDisplayNameChange = useCallback((name: string) => {
    setDisplayName(name);
    if (name.trim()) {
      localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, name);
    }
  }, []);

  // Fetch room info on mount
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await invokeEdge<any>('webrtc-signaling', { action: 'get-room', roomCode });
        if (!data?.room) {
          throw new Error('Salle introuvable');
        }

        setRoom({
          id: data.room.id,
          roomCode: data.room.roomCode,
          name: data.room.name || roomName,
          status: data.room.status,
          createdBy: data.room.createdBy,
          conversationId: data.room.conversationId,
          participants: data.room.participants || [],
          maxParticipants: data.room.maxParticipants || 20,
          startedAt: data.room.startedAt,
        });
      } catch (err: unknown) {
        debug.error('[VisioOverlay] Fetch room error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Impossible de charger la salle';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoom();
  }, [roomCode, roomName]);

  // Handle join room
  const handleJoin = useCallback(async () => {
    if (!room || !displayName.trim()) return;

    try {
      setIsJoining(true);
      setError(null);

      const data = await invokeEdge<any>('webrtc-signaling', {
          action: 'join-room',
          roomCode: room.roomCode,
          displayName: displayName.trim(),
        });
      if (!data?.success) {
        throw new Error(data?.error || 'Impossible de rejoindre la salle');
      }

      // Update room with fresh data
      setRoom(prev => prev ? {
        ...prev,
        status: 'active',
        participants: data.participants || prev.participants,
      } : null);

      setHasJoined(true);
    } catch (err: unknown) {
      debug.error('[VisioOverlay] Join error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Impossible de rejoindre la salle';
      setError(errorMessage);
    } finally {
      setIsJoining(false);
    }
  }, [room, displayName]);

  // Handle close with cleanup
  const handleClose = useCallback(() => {
    if (hasJoined && room) {
      // Leave room on close
      invokeEdge('webrtc-signaling', { action: 'leave-room', roomId: room.id })
        .catch((e: unknown) => debug.error('Error leaving room:', e));
    }
    onClose();
  }, [hasJoined, room, onClose]);

  // Handle leave from VisioRoom - opens transcription share modal
  const handleVisioLeave = useCallback((sessionId: string | null) => {
    // Leave the room via signaling
    if (room) {
      invokeEdge('webrtc-signaling', { action: 'leave-room', roomId: room.id })
        .catch((e: unknown) => debug.error('Error leaving room:', e));
    }

    // Reset joined state
    setHasJoined(false);
    
    // Show transcription share modal if there was a session
    if (sessionId) {
      setEndedSessionId(sessionId);
      setShowTranscriptionShare(true);
    } else {
      // No session, just close
      onClose();
    }
  }, [room, onClose]);

  // Handle transcription share modal close
  const handleTranscriptionShareClose = useCallback(() => {
    setShowTranscriptionShare(false);
    setEndedSessionId(null);
    onClose();
  }, [onClose]);

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement de la salle...</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={onClose} aria-label="Fermer">
          <X className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Error state
  if (error && !room) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Erreur</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  // Room ended state
  if (room.status === 'ended') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <X className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Réunion terminée</h2>
          <p className="text-muted-foreground">
            Cette réunion est terminée. Vous pouvez en créer une nouvelle depuis la conversation.
          </p>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10"
        onClick={handleClose} aria-label="Fermer">
        <X className="h-5 w-5" />
      </Button>

      {/* Error toast */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg">
          {error}
        </div>
      )}

      {/* Lobby or Room */}
      {!hasJoined ? (
        <VisioLobby
          room={room}
          displayName={displayName}
          onDisplayNameChange={handleDisplayNameChange}
          onJoin={handleJoin}
          isJoining={isJoining}
          isAuthenticated={!!user}
        />
      ) : (
        <VisioRoom room={room} onLeave={handleVisioLeave} />
      )}

      {/* Post-visio transcription share modal */}
      <TranscriptionShareModal
        open={showTranscriptionShare}
        onOpenChange={setShowTranscriptionShare}
        sessionId={endedSessionId}
        onClose={handleTranscriptionShareClose}
      />
    </div>
  );
}
