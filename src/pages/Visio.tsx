import { useState, useEffect, useCallback } from 'react';
import { debug } from '@/lib/debug';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchVisioRoom } from '@/services/visio/visioRooms';
import { useAuth } from '@/components/AuthProvider';
import { useCurrentProfile } from '@/hooks/profile/useProfiles';
import { VisioRoom } from '@/components/visio/VisioRoom';
import { VisioLobby } from '@/components/visio/VisioLobby';
import { VisioRoom as VisioRoomType } from '@/types/visio';
import { Button } from '@/components/ui/button';
import { PageDataState } from '@/components/common/PageDataState';

const DISPLAY_NAME_STORAGE_KEY = 'marque.visio.displayName';

export default function Visio() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useCurrentProfile();
  
  const [room, setRoom] = useState<VisioRoomType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  
  // Initialize displayName from localStorage, then user email, then empty
  const [displayName, setDisplayName] = useState(() => {
    const stored = localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    if (stored) return stored;
    return '';
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

  // Fetch room info
  useEffect(() => {
    const fetchRoom = async () => {
      if (!roomCode) {
        setError('Code de salle manquant');
        setIsLoading(false);
        return;
      }

      try {
        const r = await fetchVisioRoom(roomCode);
        setRoom(r);
      } catch (err: unknown) {
        debug.error('Failed to fetch room:', err);
        const errorMessage = err instanceof Error ? err.message : 'Impossible de charger la salle';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoom();
  }, [roomCode]);

  const handleJoin = async () => {
    setHasJoined(true);
  };

  if (isLoading) {
    return (
      <PageDataState isLoading={true} isError={false}>
        <></>
      </PageDataState>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Salle introuvable</h1>
          <p className="text-muted-foreground">{error || 'Cette salle n\'existe pas ou a été fermée.'}</p>
          <Button onClick={() => navigate(-1)}>Retour</Button>
        </div>
      </div>
    );
  }

  if (room.status === 'ended') {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Réunion terminée</h1>
          <p className="text-muted-foreground">Cette réunion est terminée.</p>
          <Button onClick={() => navigate(-1)}>Retour</Button>
        </div>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <VisioLobby
        room={room}
        displayName={displayName}
        onDisplayNameChange={handleDisplayNameChange}
        onJoin={handleJoin}
        isJoining={false}
        isAuthenticated={!!user}
      />
    );
  }

  return <VisioRoom room={room} />;
}
