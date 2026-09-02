import { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  MonitorSpeaker,
  ChevronUp,
  ChevronDown,
  X,
  Users,
  FileText,
  Loader2,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTranscription } from '@/contexts/TranscriptionContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function GlobalTranscriptionWidget() {
  const {
    activeSession,
    isSessionActive,
    isRecording,
    isConnecting,
    isExtendedMode,
    toggleRecording,
    toggleExtendedMode,
    endSession,
    segments,
    participants,
    currentText,
  } = useTranscription();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, isExpanded]);

  // Don't render if no active session
  if (!isSessionActive || !activeSession) {
    return null;
  }

  const activeTranscribingCount = participants.filter(p => p.is_transcribing && !p.left_at).length;
  const recentSegments = segments.slice(-10);

  // Minimized view - just a small indicator
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant={isRecording ? "destructive" : "secondary"}
          className="rounded-full shadow-lg"
          onClick={() => setIsMinimized(false)}
        >
          {isRecording && <Radio className="h-3 w-3 mr-2 animate-pulse" />}
          <FileText className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn(
      "fixed bottom-4 right-4 z-50 shadow-xl border-2 transition-all duration-300",
      isExpanded ? "w-96 h-[500px]" : "w-80",
      isRecording && "border-destructive/50"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
        {/* Recording indicator */}
        {isRecording && (
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
        )}
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{activeSession.title}</h4>
          <p className="text-xs text-muted-foreground">
            {activeTranscribingCount} en transcription
          </p>
        </div>

        {/* Actions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsExpanded(!isExpanded)} aria-label="Suivant">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isExpanded ? 'Réduire' : 'Agrandir'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(true)} aria-label="Suivant">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Minimiser</TooltipContent>
        </Tooltip>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Mode toggle */}
          <div className="p-3 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorSpeaker className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="extended-mode" className="text-xs">
                  Mode étendu (micro + haut-parleurs)
                </Label>
              </div>
              <Switch
                id="extended-mode"
                checked={isExtendedMode}
                onCheckedChange={toggleExtendedMode}
                disabled={isRecording}
              />
            </div>
            {isExtendedMode && (
              <p className="text-xs text-muted-foreground mt-1">
                Capture toutes les voix de la réunion
              </p>
            )}
          </div>

          {/* Participants */}
          <div className="p-2 border-b">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span>Participants ({participants.filter(p => !p.left_at).length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {participants.filter(p => !p.left_at).map(p => (
                <Badge 
                  key={p.id} 
                  variant={p.is_transcribing ? "default" : "secondary"}
                  className="text-xs"
                >
                  {p.is_transcribing && <Mic className="h-2 w-2 mr-1" />}
                  {p.display_name.split(' ')[0]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Transcription segments */}
          <ScrollArea 
            className="flex-1 h-[250px]" 
            ref={scrollRef as any}
          >
            <div className="p-3 space-y-2">
              {recentSegments.length === 0 ? (
                <div className="text-center py-4">
                  {isRecording ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        En attente de paroles...
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Parlez pendant au moins 10 secondes
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Démarrez la transcription pour voir les segments
                    </p>
                  )}
                </div>
              ) : (
                recentSegments.map((segment) => (
                  <div key={segment.id} className="text-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-xs text-primary">
                        {segment.speaker_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {segment.created_at && format(new Date(segment.created_at), 'HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{segment.text}</p>
                  </div>
                ))
              )}
              
              {/* Current text (live) */}
              {currentText && (
                <div className="text-sm animate-pulse">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-xs text-primary">Vous</span>
                    <span className="text-xs text-muted-foreground">en cours...</span>
                  </div>
                  <p className="text-muted-foreground italic">{currentText}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}

      {/* Controls */}
      <div className="p-3 border-t bg-muted/30 flex items-center gap-2">
        {/* Main mic toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isRecording ? "destructive" : "default"}
              size="sm"
              className="flex-1"
              onClick={toggleRecording}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isRecording ? (
                <MicOff className="h-4 w-4 mr-2" />
              ) : (
                <Mic className="h-4 w-4 mr-2" />
              )}
              {isConnecting 
                ? 'Connexion...' 
                : isRecording 
                  ? 'Arrêter' 
                  : 'Transcrire'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isRecording ? 'Arrêter la transcription' : 'Démarrer la transcription'}
          </TooltipContent>
        </Tooltip>

        {/* End session */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={endSession} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Terminer la session</TooltipContent>
        </Tooltip>
      </div>
    </Card>
  );
}
