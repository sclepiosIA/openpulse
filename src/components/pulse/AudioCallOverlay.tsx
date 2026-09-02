import { useState, useEffect, useCallback } from 'react'
import { debug } from '@/lib/debug'
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, X, Users, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useWebRTC } from '@/hooks/voice/useWebRTC'
import { useCurrentProfile } from '@/hooks/profile/useProfiles'
import { useTranscription } from '@/contexts/TranscriptionContext'
import { invokeEdge } from '@/services/edgeFunctions'
import { VisioRoom as VisioRoomType } from '@/types/visio'

interface AudioCallOverlayProps {
  roomCode: string
  roomName: string
  onClose: () => void
}

export function AudioCallOverlay({ roomCode, roomName, onClose }: AudioCallOverlayProps) {
  const { data: profile } = useCurrentProfile()
  const [room, setRoom] = useState<VisioRoomType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isSpeakerOff, setIsSpeakerOff] = useState(false)

  // Transcription (auto-start, no user control needed)
  const {
    activeSession,
    startSession,
    endSession,
    isRecording: isTranscribing,
  } = useTranscription()

  const {
    isConnected,
    isConnecting,
    localStream,
    remoteStreams,
    participants,
    mediaState,
    connect,
    disconnect,
    toggleMute,
  } = useWebRTC({
    roomId: room?.id || '',
    userId: profile?.id || '',
    displayName: profile ? `${profile.prenom} ${profile.nom}` : 'Membre',
  })

  // Fetch room info
  useEffect(() => {
    const fetchRoom = async () => {
      setIsLoading(true)
      try {
        const data = await invokeEdge<any>('webrtc-signaling', { action: 'get-room', roomCode })
        if (data?.room) {
          setRoom(data.room)
        } else {
          setError('Salle non trouvée')
        }
      } catch (err: any) {
        debug.error('[AudioCall] Error fetching room:', err)
        setError(err.message || 'Erreur de connexion')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRoom()
  }, [roomCode])

  // Auto-connect when room is loaded
  useEffect(() => {
    if (room && profile && !isConnected && !isConnecting) {
      connect()
    }
  }, [room, profile, isConnected, isConnecting, connect])

  // Auto-start transcription when connected
  useEffect(() => {
    if (isConnected && profile?.id && !activeSession) {
      startSession({
        title: `Appel: ${roomName}`,
        roomCode,
        provider: 'marque_meet',
        autoRecord: true,
      }).catch((e: unknown) => debug.warn('Error starting transcription session:', e))
    }
  }, [isConnected, profile?.id, activeSession, roomName, roomCode, startSession])

  // Call duration timer
  useEffect(() => {
    if (!isConnected) return

    const startTime = Date.now()
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isConnected])

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Handle hang up
  const handleHangUp = useCallback(async () => {
    // End transcription session
    if (activeSession) {
      await endSession()
    }
    await disconnect()
    onClose()
  }, [disconnect, onClose, activeSession, endSession])

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOff((prev) => !prev)
    // Mute all remote audio elements
    document.querySelectorAll<HTMLAudioElement>('.remote-audio').forEach((audio) => {
      audio.muted = !isSpeakerOff
    })
  }, [isSpeakerOff])

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Connexion à l'appel...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <PhoneOff className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Impossible de rejoindre l'appel</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    )
  }

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-background to-muted/50">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span className="text-sm font-medium">{roomName}</span>
          </div>
          {isConnected && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDuration(callDuration)}</span>
            </div>
          )}
          {/* Transcription indicator */}
          {isTranscribing && (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span>Transcription</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-9 w-9"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Participants */}
      <div className="absolute inset-0 flex items-center justify-center pt-16 pb-32">
        <div className="flex flex-wrap justify-center gap-8 max-w-4xl px-8">
          {/* Local participant */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={undefined} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {profile ? getInitials(`${profile.prenom} ${profile.nom}`) : '?'}
                </AvatarFallback>
              </Avatar>
              {/* Audio level indicator */}
              {isConnected && !mediaState.isMuted && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={`audio-call-self-bar-${i}`}
                      className="w-1 bg-primary rounded-full animate-pulse"
                      style={{
                        height: `${8 + Math.random() * 8}px`,
                        animationDelay: `${i * 0.1}s`,
                      }}
                    />
                  ))}
                </div>
              )}
              {mediaState.isMuted && (
                <div className="absolute -bottom-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1">
                  <MicOff className="h-3 w-3" />
                </div>
              )}
            </div>
            <span className="text-sm font-medium">Vous</span>
          </div>

          {/* Remote participants */}
          {remoteStreams.map((remote) => (
            <div key={remote.peerId} className="flex flex-col items-center gap-3">
              <div className="relative">
                <Avatar className="h-24 w-24 ring-4 ring-muted">
                  <AvatarFallback className="text-2xl">
                    {getInitials(remote.participant.display_name || 'Participant')}
                  </AvatarFallback>
                </Avatar>
                {/* Audio element (hidden) */}
                <audio
                  className="remote-audio hidden"
                  autoPlay
                  ref={(el) => {
                    if (el && remote.stream) {
                      el.srcObject = remote.stream
                      el.muted = isSpeakerOff
                    }
                  }}
                />
                {/* Speaking indicator */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={`audio-call-remote-${remote.peerId}-bar-${i}`}
                      className="w-1 bg-muted-foreground rounded-full animate-pulse"
                      style={{
                        height: `${6 + Math.random() * 6}px`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
                {remote.participant.is_muted && (
                  <div className="absolute -bottom-1 -right-1 bg-muted text-muted-foreground rounded-full p-1">
                    <MicOff className="h-3 w-3" />
                  </div>
                )}
              </div>
              <span className="text-sm font-medium">
                {remote.participant.display_name || 'Participant'}
              </span>
            </div>
          ))}

          {/* No other participants yet */}
          {remoteStreams.length === 0 && isConnected && (
            <div className="flex flex-col items-center gap-3 opacity-50">
              <div className="h-24 w-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <span className="text-sm text-muted-foreground">En attente...</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8">
        <div className="flex items-center justify-center gap-4">
          {/* Mute button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={mediaState.isMuted ? 'destructive' : 'outline'}
                size="lg"
                className={cn(
                  'h-14 w-14 rounded-full border-2',
                  !mediaState.isMuted &&
                    'bg-card dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                )}
                onClick={toggleMute}
              >
                {mediaState.isMuted ? (
                  <MicOff className="h-6 w-6" />
                ) : (
                  <Mic className="h-6 w-6 text-foreground dark:text-white" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {mediaState.isMuted ? 'Activer le micro' : 'Couper le micro'}
            </TooltipContent>
          </Tooltip>

          {/* Hang up button */}
          <Button
            variant="destructive"
            size="lg"
            aria-label="Raccrocher"
            title="Raccrocher"
            className="h-16 w-16 rounded-full shadow-lg"
            onClick={handleHangUp}
          >
            <PhoneOff className="h-7 w-7" />
          </Button>

          {/* Speaker button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isSpeakerOff ? 'destructive' : 'outline'}
                size="lg"
                className={cn(
                  'h-14 w-14 rounded-full border-2',
                  !isSpeakerOff &&
                    'bg-card dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                )}
                onClick={toggleSpeaker}
              >
                {isSpeakerOff ? (
                  <VolumeX className="h-6 w-6" />
                ) : (
                  <Volume2 className="h-6 w-6 text-foreground dark:text-white" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isSpeakerOff ? 'Activer le son' : 'Couper le son'}</TooltipContent>
          </Tooltip>
        </div>

        {/* Connection status */}
        {isConnecting && (
          <p className="text-center text-sm text-muted-foreground mt-4">Connexion en cours...</p>
        )}
      </div>
    </div>
  )
}
