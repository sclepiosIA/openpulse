import { cn } from '@/lib/utils';
import { ParticipantVideo } from './ParticipantVideo';
import { VisioParticipant } from '@/types/visio';

interface RemoteStream {
  peerId: string;
  stream: MediaStream;
  participant: VisioParticipant;
}

interface VideoGridProps {
  localStream?: MediaStream | null;
  localParticipant: VisioParticipant;
  remoteStreams: RemoteStream[];
  screenStream?: MediaStream | null;
  isScreenSharing?: boolean;
}

export function VideoGrid({
  localStream,
  localParticipant,
  remoteStreams,
  screenStream,
  isScreenSharing,
}: VideoGridProps) {
  const totalParticipants = 1 + remoteStreams.length;
  
  // Determine grid layout based on participant count
  const getGridClass = () => {
    if (isScreenSharing) {
      return 'grid-cols-1';
    }
    if (totalParticipants === 1) {
      return 'grid-cols-1';
    }
    if (totalParticipants === 2) {
      return 'grid-cols-1 md:grid-cols-2';
    }
    if (totalParticipants <= 4) {
      return 'grid-cols-2';
    }
    if (totalParticipants <= 6) {
      return 'grid-cols-2 md:grid-cols-3';
    }
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  };

  return (
    <div className="flex-1 p-4 overflow-auto">
      {isScreenSharing && screenStream ? (
        // Screen sharing layout: screen takes main area, participants in sidebar
        <div className="flex flex-col lg:flex-row h-full gap-4">
          {/* Main screen share */}
          <div className="flex-1">
            <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el) el.srcObject = screenStream;
                }}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          
          {/* Participants sidebar */}
          <div className="lg:w-64 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto">
            <div className="w-40 lg:w-full flex-shrink-0">
              <ParticipantVideo
                stream={localStream || undefined}
                participant={localParticipant}
                isLocal
              />
            </div>
            {remoteStreams.map(({ stream, participant }) => (
              <div key={participant.user_id} className="w-40 lg:w-full flex-shrink-0">
                <ParticipantVideo
                  stream={stream}
                  participant={participant}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Normal grid layout
        <div className={cn('grid gap-4 h-full auto-rows-fr', getGridClass())}>
          {/* Local video */}
          <ParticipantVideo
            stream={localStream || undefined}
            participant={localParticipant}
            isLocal
            isLarge={totalParticipants <= 2}
          />
          
          {/* Remote videos */}
          {remoteStreams.map(({ stream, participant }) => (
            <ParticipantVideo
              key={participant.user_id}
              stream={stream}
              participant={participant}
              isLarge={totalParticipants <= 2}
            />
          ))}
        </div>
      )}
    </div>
  );
}
