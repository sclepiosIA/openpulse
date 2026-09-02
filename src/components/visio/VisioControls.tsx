import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Settings,
  Users,
  MessageSquare,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LocalMediaState } from '@/types/visio';
import { cn } from '@/lib/utils';

interface VisioControlsProps {
  mediaState: LocalMediaState;
  participantCount: number;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
  onOpenSettings?: () => void;
  onOpenParticipants?: () => void;
  onOpenChat?: () => void;
}

export function VisioControls({
  mediaState,
  participantCount,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
  onOpenSettings,
  onOpenParticipants,
  onOpenChat,
}: VisioControlsProps) {
  return (
    <div className="sticky bottom-0 z-30 bg-slate-900 dark:bg-slate-950 border-t border-slate-700 p-3 md:p-4 shadow-2xl">
      <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
        {/* Mute button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={mediaState.isMuted ? 'Activer le micro' : 'Couper le micro'}
              aria-pressed={mediaState.isMuted}
              className={cn(
                'rounded-full w-12 h-12 sm:w-14 sm:h-14 border-2 flex-shrink-0 shadow-lg flex items-center justify-center transition-colors',
                mediaState.isMuted
                  ? 'bg-red-600 hover:bg-red-700 border-red-500'
                  : 'bg-slate-700 hover:bg-slate-600 border-slate-500'
              )}
              onClick={onToggleMute}
            >
              {mediaState.isMuted ? (
                <MicOff className="h-6 w-6 text-white" />
              ) : (
                <Mic className="h-6 w-6 text-white" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {mediaState.isMuted ? 'Activer le micro' : 'Couper le micro'}
          </TooltipContent>
        </Tooltip>

        {/* Video button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={mediaState.isVideoOff ? 'Activer la caméra' : 'Couper la caméra'}
              aria-pressed={mediaState.isVideoOff}
              className={cn(
                'rounded-full w-12 h-12 sm:w-14 sm:h-14 border-2 flex-shrink-0 shadow-lg flex items-center justify-center transition-colors',
                mediaState.isVideoOff
                  ? 'bg-red-600 hover:bg-red-700 border-red-500'
                  : 'bg-slate-700 hover:bg-slate-600 border-slate-500'
              )}
              onClick={onToggleVideo}
            >
              {mediaState.isVideoOff ? (
                <VideoOff className="h-6 w-6 text-white" />
              ) : (
                <Video className="h-6 w-6 text-white" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {mediaState.isVideoOff ? 'Activer la caméra' : 'Couper la caméra'}
          </TooltipContent>
        </Tooltip>

        {/* Screen share button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={mediaState.isScreenSharing ? "Arrêter le partage d'écran" : "Partager l'écran"}
              aria-pressed={mediaState.isScreenSharing}
              className={cn(
                'rounded-full w-12 h-12 sm:w-14 sm:h-14 border-2 flex-shrink-0 shadow-lg flex items-center justify-center transition-colors',
                mediaState.isScreenSharing
                  ? 'bg-green-600 hover:bg-green-700 border-green-500'
                  : 'bg-slate-700 hover:bg-slate-600 border-slate-500'
              )}
              onClick={onToggleScreenShare}
            >
              {mediaState.isScreenSharing ? (
                <MonitorOff className="h-6 w-6 text-white" />
              ) : (
                <MonitorUp className="h-6 w-6 text-white" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {mediaState.isScreenSharing ? 'Arrêter le partage' : 'Partager l\'écran'}
          </TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="w-px h-10 bg-slate-600 mx-1 hidden sm:block" />

        {/* Participants button */}
        {onOpenParticipants && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Participants (${participantCount})`}
                className="rounded-full w-12 h-12 sm:w-14 sm:h-14 relative bg-slate-700 hover:bg-slate-600 border-2 border-slate-500 flex-shrink-0 shadow-lg flex items-center justify-center transition-colors"
                onClick={onOpenParticipants}
              >
                <Users className="h-6 w-6 text-white" />
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                  {participantCount}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Participants</TooltipContent>
          </Tooltip>
        )}

        {/* Chat button */}
        {onOpenChat && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Ouvrir le chat"
                className="rounded-full w-12 h-12 sm:w-14 sm:h-14 hidden sm:flex bg-slate-700 hover:bg-slate-600 border-2 border-slate-500 flex-shrink-0 shadow-lg items-center justify-center transition-colors"
                onClick={onOpenChat}
              >
                <MessageSquare className="h-6 w-6 text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Chat</TooltipContent>
          </Tooltip>
        )}

        {/* Settings button */}
        {onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Paramètres"
                className="rounded-full w-12 h-12 sm:w-14 sm:h-14 hidden sm:flex bg-slate-700 hover:bg-slate-600 border-2 border-slate-500 flex-shrink-0 shadow-lg items-center justify-center transition-colors"
                onClick={onOpenSettings}
              >
                <Settings className="h-6 w-6 text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Paramètres</TooltipContent>
          </Tooltip>
        )}

        {/* Separator */}
        <div className="w-px h-10 bg-slate-600 mx-1" />

        {/* Leave button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Quitter la réunion"
              className="rounded-full w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 bg-red-600 hover:bg-red-700 border-2 border-red-500 shadow-lg flex items-center justify-center transition-colors"
              onClick={onLeave}
            >
              <PhoneOff className="h-6 w-6 text-white" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Quitter la réunion</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
