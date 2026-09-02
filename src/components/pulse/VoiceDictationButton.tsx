import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VoiceDictationButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  audioLevel: number;
  disabled?: boolean;
  onClick: () => void;
  compactMode?: boolean;
}

export function VoiceDictationButton({
  isRecording,
  isProcessing,
  audioLevel,
  disabled,
  onClick,
  compactMode = false,
}: VoiceDictationButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative transition-all",
            compactMode ? "h-8 w-8" : "h-9 w-9",
            isRecording && "text-destructive hover:text-destructive bg-destructive/10 hover:bg-destructive/20"
          )}
          type="button"
          onClick={onClick}
          disabled={disabled || isProcessing}
          aria-label={isRecording ? "Arrêter la dictée" : "Dictée vocale"}
        >
          {isProcessing ? (
            <Loader2 className={cn(compactMode ? "h-4 w-4" : "h-5 w-5", "animate-spin")} />
          ) : isRecording ? (
            <>
              <MicOff className={cn(compactMode ? "h-4 w-4" : "h-5 w-5", "relative z-10")} />
              {/* Pulsing ring animation */}
              <span 
                className="absolute inset-0 rounded-lg border-2 border-destructive animate-ping opacity-30"
              />
              {/* Audio level ring */}
              <span 
                className="absolute inset-0 rounded-lg border-2 border-destructive/50 transition-all duration-75"
                style={{
                  transform: `scale(${1 + audioLevel * 0.15})`,
                  opacity: 0.3 + audioLevel * 0.5,
                }}
              />
            </>
          ) : (
            <Mic className={cn(compactMode ? "h-4 w-4" : "h-5 w-5")} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isProcessing 
          ? "Transcription en cours..." 
          : isRecording 
            ? "Cliquez pour arrêter" 
            : <>Dictée vocale <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Ctrl+⇧+M</kbd></>
        }
      </TooltipContent>
    </Tooltip>
  );
}
