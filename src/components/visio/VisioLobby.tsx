import { useState, useRef, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { useNavigate } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisioRoom, DeviceInfo, VIDEO_CONSTRAINTS } from '@/types/visio';

interface VisioLobbyProps {
  room: VisioRoom;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onJoin: () => void;
  isJoining: boolean;
  isAuthenticated?: boolean;
}

export function VisioLobby({
  room,
  displayName,
  onDisplayNameChange,
  onJoin,
  isJoining,
  isAuthenticated = false,
}: VisioLobbyProps) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Initialize media and get devices
  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: VIDEO_CONSTRAINTS.medium,
          audio: true,
        });
        setLocalStream(stream);
        
        // Get available devices
        const deviceInfos = await navigator.mediaDevices.enumerateDevices();
        const formattedDevices: DeviceInfo[] = deviceInfos
          .filter(d => d.kind === 'audioinput' || d.kind === 'videoinput')
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label || `${d.kind === 'videoinput' ? 'Caméra' : 'Micro'} ${d.deviceId.slice(0, 5)}`,
            kind: d.kind as 'audioinput' | 'videoinput',
          }));
        setDevices(formattedDevices);
        
        // Set defaults
        const videoDevices = formattedDevices.filter(d => d.kind === 'videoinput');
        const audioDevices = formattedDevices.filter(d => d.kind === 'audioinput');
        if (videoDevices.length > 0) setSelectedVideoDevice(videoDevices[0].deviceId);
        if (audioDevices.length > 0) setSelectedAudioDevice(audioDevices[0].deviceId);
      } catch (error: unknown) {
        debug.error('Media access error:', error);
        const errName = error instanceof Error ? error.name : '';
        setMediaError(
          errName === 'NotAllowedError'
            ? 'Veuillez autoriser l\'accès à la caméra et au micro'
            : 'Impossible d\'accéder aux périphériques média'
        );
      }
    };

    initMedia();

    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Update video element
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Switch device
  const switchDevice = async (deviceId: string, kind: 'audioinput' | 'videoinput') => {
    if (!localStream) return;

    try {
      const constraints = kind === 'videoinput'
        ? { video: { deviceId: { exact: deviceId }, ...VIDEO_CONSTRAINTS.medium } }
        : { audio: { deviceId: { exact: deviceId } } };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = newStream.getTracks()[0];
      const oldTrack = kind === 'videoinput'
        ? localStream.getVideoTracks()[0]
        : localStream.getAudioTracks()[0];

      if (oldTrack) {
        localStream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStream.addTrack(newTrack);

      if (kind === 'videoinput') {
        setSelectedVideoDevice(deviceId);
      } else {
        setSelectedAudioDevice(deviceId);
      }
    } catch (error) {
      debug.error('Failed to switch device:', error);
    }
  };

  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  const audioDevices = devices.filter(d => d.kind === 'audioinput');

  const initials = displayName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{room.name}</h1>
          <p className="text-muted-foreground">
            {room.participants.length} participant{room.participants.length > 1 ? 's' : ''} dans la salle
          </p>
        </div>

        {/* Video preview */}
        <div className="relative aspect-video bg-muted rounded-xl overflow-hidden">
          {localStream && !isVideoOff ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {mediaError ? (
                <div className="text-center text-destructive p-4">
                  <VideoOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{mediaError}</p>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-3xl font-semibold text-primary">{initials}</span>
                </div>
              )}
            </div>
          )}

          {/* Media controls overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <Button
              variant={isMuted ? 'destructive' : 'secondary'}
              size="icon"
              className="rounded-full w-12 h-12"
              onClick={toggleMute} aria-label="Couper le micro">
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button
              variant={isVideoOff ? 'destructive' : 'secondary'}
              size="icon"
              className="rounded-full w-12 h-12"
              onClick={toggleVideo} aria-label="Couper la vidéo">
              {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full w-12 h-12"
              onClick={() => setShowSettings(!showSettings)} aria-label="Paramètres">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="bg-card border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Paramètres</h3>
            
            {videoDevices.length > 0 && (
              <div className="space-y-2">
                <Label>Caméra</Label>
                <Select
                  value={selectedVideoDevice}
                  onValueChange={(v) => switchDevice(v, 'videoinput')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map(d => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {audioDevices.length > 0 && (
              <div className="space-y-2">
                <Label>Microphone</Label>
                <Select
                  value={selectedAudioDevice}
                  onValueChange={(v) => switchDevice(v, 'audioinput')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDevices.map(d => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Name input and join button */}
        <div className="space-y-4">
          {/* Only show name input for unauthenticated users */}
          {!isAuthenticated && (
            <div className="space-y-2">
              <Label>Votre nom</Label>
              <Input
                value={displayName}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder="Entrez votre nom..."
              />
            </div>
          )}

          {/* Show display name for authenticated users */}
          {isAuthenticated && displayName && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Vous rejoindrez en tant que <span className="font-medium text-foreground">{displayName}</span>
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(-1)}
            >
              Annuler
            </Button>
            <Button
              className="flex-1"
              onClick={onJoin}
              disabled={isJoining || !displayName.trim() || room.status === 'ended'}
            >
              {isJoining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : room.status === 'ended' ? (
                'Réunion terminée'
              ) : (
                'Rejoindre'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
