import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Users, Clock, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

import type { TranscriptionSegment, TranscriptionParticipant } from '@/types/transcription';

interface TranscriptionLiveViewProps {
  sessionId: string;
  segments: TranscriptionSegment[];
  participants: TranscriptionParticipant[];
  sessionStartedAt: string;
  onExport?: () => void;
}

export function TranscriptionLiveView({
  sessionId,
  segments,
  participants,
  sessionStartedAt,
  onExport,
}: TranscriptionLiveViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const formatTime = (ms?: number) => {
    if (!ms) return '00:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = () => {
    const startTime = new Date(sessionStartedAt).getTime();
    const now = Date.now();
    const durationMs = now - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const activeParticipants = participants.filter(p => !p.left_at);
  const transcribingParticipants = participants.filter(p => p.is_transcribing);

  // Group consecutive segments by speaker
  const groupedSegments = segments.reduce<Array<{
    speakerName: string;
    segments: TranscriptionSegment[];
  }>>((acc, segment) => {
    const last = acc[acc.length - 1];
    if (last && last.speakerName === segment.speaker_name) {
      last.segments.push(segment);
    } else {
      acc.push({
        speakerName: segment.speaker_name,
        segments: [segment],
      });
    }
    return acc;
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const handleExportTxt = () => {
    const content = segments
      .map(seg => `[${formatTime(seg.start_time_ms)}] ${seg.speaker_name}: ${seg.text}`)
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${sessionId.substring(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-medium">Transcription en direct</CardTitle>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportTxt}>
              <Download className="h-4 w-4 mr-1" />
              TXT
            </Button>
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <FileText className="h-4 w-4 mr-1" />
                PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Participants sidebar */}
        <div className="w-48 border-r p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Participants</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              {activeParticipants.length}
            </Badge>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {activeParticipants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {getInitials(participant.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {participant.display_name}
                    </p>
                  </div>
                  {participant.is_transcribing ? (
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  ) : (
                    <MicOff className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Transcript content */}
        <div className="flex-1 flex flex-col">
          <ScrollArea
            className="flex-1 p-4"
            ref={scrollRef}
            onScroll={handleScroll}
          >
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Mic className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">En attente de transcription...</p>
                <p className="text-xs">Activez votre micro pour commencer</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedSegments.map((group, groupIndex) => (
                  <div key={groupIndex} className="flex gap-3">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="text-xs">
                        {getInitials(group.speakerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {group.speakerName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(group.segments[0]?.start_time_ms)}
                        </span>
                      </div>
                      <div className="text-sm text-foreground/90 space-y-1">
                        {group.segments.map((segment) => (
                          <p key={segment.id}>{segment.text}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Auto-scroll indicator */}
          {!autoScroll && segments.length > 0 && (
            <div className="border-t p-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAutoScroll(true);
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                  }
                }}
              >
                ↓ Défiler vers le bas
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
