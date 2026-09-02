import { useState } from 'react';
import { Mic, MicOff, Square, Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAzureTranscription } from '@/hooks/ai/useAzureTranscription';

interface TranscriptionWidgetProps {
  sessionId: string;
  userId: string;
  displayName: string;
  language?: string;
  onEnd?: () => void;
  className?: string;
}

export function TranscriptionWidget({
  sessionId,
  userId,
  displayName,
  language = 'fr',
  onEnd,
  className = '',
}: TranscriptionWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const {
    isRecording,
    isConnecting,
    segments,
    participants,
    currentText,
    error,
    startRecording,
    stopRecording,
  } = useAzureTranscription({
    sessionId,
    userId,
    displayName,
    language,
  });

  const activeParticipants = participants.filter(p => !p.left_at);
  const transcribingParticipants = participants.filter(p => p.is_transcribing);

  // Get last 5 segments for preview
  const recentSegments = segments.slice(-5);

  const formatTime = (ms?: number) => {
    if (!ms) return '00:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={`w-80 shadow-lg ${className}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Transcription</CardTitle>
              {isRecording && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {activeParticipants.length}
              </Badge>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="py-2 px-4 space-y-3">
            {/* Error message */}
            {error && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {error}
              </div>
            )}

            {/* Participants transcribing */}
            {transcribingParticipants.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {transcribingParticipants.map(p => (
                  <Badge key={p.id} variant="secondary" className="text-xs">
                    <Mic className="h-3 w-3 mr-1 text-red-500" />
                    {p.display_name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Current text being transcribed */}
            {currentText && (
              <div className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                {currentText}
              </div>
            )}

            {/* Recent segments */}
            {recentSegments.length > 0 && (
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {recentSegments.map((segment) => (
                    <div key={segment.id} className="text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {segment.speaker_name}
                        </span>
                        <span>·</span>
                        <span>{formatTime(segment.start_time_ms)}</span>
                      </div>
                      <p className="text-foreground/80">{segment.text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Empty state */}
            {recentSegments.length === 0 && !currentText && !isRecording && (
              <div className="text-xs text-muted-foreground text-center py-4">
                Cliquez sur le micro pour démarrer la transcription
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant={isRecording ? 'destructive' : 'default'}
                size="sm"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isConnecting}
                className="flex-1"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Connexion...
                  </>
                ) : isRecording ? (
                  <>
                    <MicOff className="h-4 w-4 mr-2" />
                    Arrêter
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Transcrire
                  </>
                )}
              </Button>

              {onEnd && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEnd}
                  className="ml-2"
                >
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Segments count */}
            <div className="text-xs text-muted-foreground text-center">
              {segments.length} segment{segments.length !== 1 ? 's' : ''} transcrit{segments.length !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
