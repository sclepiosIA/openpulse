import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MicOff, VideoOff } from 'lucide-react';
import { VisioParticipant } from '@/types/visio';

interface ParticipantVideoProps {
  stream?: MediaStream;
  participant: VisioParticipant;
  isLocal?: boolean;
  isLarge?: boolean;
  isSpeaking?: boolean;
}

export function ParticipantVideo({
  stream,
  participant,
  isLocal = false,
  isLarge = false,
  isSpeaking = false,
}: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = participant.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden bg-muted/50',
        isLarge ? 'aspect-video' : 'aspect-video',
        isSpeaking && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        'transition-all duration-200'
      )}
    >
      {stream && !participant.is_video_off ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={cn(
            'w-full h-full object-cover',
            isLocal && 'transform scale-x-[-1]' // Mirror for local video
          )}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <div
            className={cn(
              'rounded-full bg-primary/20 flex items-center justify-center font-semibold text-primary',
              isLarge ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl'
            )}
          >
            {initials}
          </div>
        </div>
      )}

      {/* Overlay with name and status */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium truncate">
            {participant.display_name}
            {isLocal && ' (Vous)'}
          </span>
          <div className="flex items-center gap-1">
            {participant.is_muted && (
              <div className="w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
            {participant.is_video_off && (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <VideoOff className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Screen sharing indicator */}
      {participant.is_screen_sharing && (
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 rounded bg-primary/90 text-primary-foreground text-xs font-medium">
            Partage d'écran
          </span>
        </div>
      )}

      {/* Connection quality indicator */}
      {!isLocal && participant.connection_quality !== 'good' && (
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              'px-2 py-1 rounded text-xs font-medium',
              participant.connection_quality === 'fair'
                ? 'bg-yellow-500/90 text-white'
                : 'bg-red-500/90 text-white'
            )}
          >
            {participant.connection_quality === 'fair' ? 'Connexion moyenne' : 'Mauvaise connexion'}
          </span>
        </div>
      )}
    </div>
  );
}
