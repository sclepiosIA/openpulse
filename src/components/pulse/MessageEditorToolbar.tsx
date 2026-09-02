import { RefObject } from 'react';
import { Paperclip, Send, Smile, Sparkles, Loader2, Languages, Minimize2, Maximize2, Hash, Slash, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ReactionPicker } from './ReactionPicker';
import { VoiceDictationButton } from './VoiceDictationButton';
import { cn } from '@/lib/utils';

type AIAction = 'improve' | 'reformulate' | 'translate' | 'shorten' | 'expand';

interface MessageEditorToolbarProps {
  compactMode?: boolean;
  content: string;
  attachedFilesCount: number;
  isFocused: boolean;
  isAIProcessing: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  sendPending: boolean;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (v: boolean) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  insertChar: (c: string) => void;
  toggleRecording: () => void;
  handleAIAction: (a: AIAction) => void;
  handleEmojiSelect: (e: string) => void;
  handleSubmit: () => void;
}

export function MessageEditorToolbar({
  compactMode,
  content,
  attachedFilesCount,
  isFocused,
  isAIProcessing,
  isRecording,
  isTranscribing,
  audioLevel,
  sendPending,
  showEmojiPicker,
  setShowEmojiPicker,
  fileInputRef,
  insertChar,
  toggleRecording,
  handleAIAction,
  handleEmojiSelect,
  handleSubmit,
}: MessageEditorToolbarProps) {
  return (
    <div className={cn(
      'flex items-center justify-between border-t bg-muted/30 gap-2 min-w-0',
      compactMode ? 'px-1.5 py-1.5' : 'px-2 sm:px-2.5 py-2'
    )}>
      <div className="flex items-center min-w-0 shrink overflow-hidden">
        <TooltipProvider delayDuration={300}>
          <div className="hidden sm:flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-all" type="button" onClick={() => insertChar('/')} aria-label="Commandes">
                  <Slash className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Commandes (/)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary transition-all" type="button" onClick={() => insertChar('#')} aria-label="Lier une entité">
                  <Hash className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Lier une entité (#)</TooltipContent>
            </Tooltip>
          </div>

          <div className="hidden sm:block w-px h-5 bg-border mx-1.5" />

          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className={cn('hover:bg-primary/10 hover:text-primary transition-all', compactMode ? 'h-8 w-8' : 'h-10 w-10 sm:h-9 sm:w-9')} type="button" onClick={() => fileInputRef.current?.click()} aria-label="Joindre un fichier">
                  <Paperclip className={cn(compactMode ? 'h-4 w-4' : 'h-5 w-5')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Joindre un fichier</TooltipContent>
            </Tooltip>
            {!compactMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden sm:flex h-9 w-9 hover:bg-primary/10 hover:text-primary transition-all" type="button" onClick={() => insertChar('@')} aria-label="Mentionner quelqu'un">
                    <AtSign className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Mentionner (@)</TooltipContent>
              </Tooltip>
            )}
          </div>

          {!compactMode && <div className="hidden sm:block w-px h-5 bg-border mx-1.5" />}

          <div className="flex items-center gap-0.5">
            <div className={cn('flex items-center justify-center', compactMode ? 'h-8 w-8' : 'h-10 w-10 sm:h-9 sm:w-9')}>
              <VoiceDictationButton isRecording={isRecording} isProcessing={isTranscribing} audioLevel={audioLevel} onClick={toggleRecording} compactMode={compactMode} />
            </div>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={cn('transition-all', compactMode ? 'h-8 w-8' : 'h-9 w-9', content.trim() ? 'hover:bg-violet-100 dark:hover:bg-violet-950 hover:text-violet-600 dark:hover:text-violet-400' : 'opacity-40')} type="button" disabled={!content.trim() || isAIProcessing} aria-label="Assistant IA">
                      {isAIProcessing ? (
                        <Loader2 className={cn(compactMode ? 'h-4 w-4' : 'h-5 w-5', 'animate-spin text-violet-500')} />
                      ) : (
                        <Sparkles className={cn(compactMode ? 'h-4 w-4' : 'h-5 w-5', content.trim() ? 'text-violet-500' : '')} />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">Assistant IA</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => handleAIAction('improve')} disabled={isAIProcessing}>
                  <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                  Améliorer le message
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIAction('reformulate')} disabled={isAIProcessing}>
                  <span className="mr-2">🔄</span>
                  Reformuler
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAIAction('shorten')} disabled={isAIProcessing}>
                  <Minimize2 className="h-4 w-4 mr-2 text-blue-500" />
                  Raccourcir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAIAction('expand')} disabled={isAIProcessing}>
                  <Maximize2 className="h-4 w-4 mr-2 text-green-500" />
                  Développer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAIAction('translate')} disabled={isAIProcessing}>
                  <Languages className="h-4 w-4 mr-2 text-purple-500" />
                  Traduire en anglais
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!compactMode && (
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-amber-100 dark:hover:bg-amber-950 hover:text-amber-600 dark:hover:text-amber-400 transition-all" type="button" aria-label="Ajouter un emoji">
                        <Smile className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Emoji</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-auto p-0" align="start" side="top">
                  <ReactionPicker onSelect={handleEmojiSelect} />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isFocused && !compactMode && (
          <span className="hidden md:inline text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↵</kbd> envoyer
          </span>
        )}

        <Button
          size={compactMode ? 'default' : 'lg'}
          className={cn(
            'gap-2 font-medium shadow-sm transition-all',
            compactMode ? 'h-9 w-9 p-0 rounded-full' : 'h-11 sm:h-10 px-5 sm:px-4',
            (content.trim() || attachedFilesCount > 0)
              ? 'bg-primary hover:bg-primary/90 hover:shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted'
          )}
          onClick={handleSubmit}
          disabled={(!content.trim() && attachedFilesCount === 0) || sendPending}
          aria-label="Envoyer"
        >
          {sendPending ? (
            <Loader2 className={cn(compactMode ? 'h-4 w-4' : 'h-5 w-5', 'animate-spin')} />
          ) : (
            <>
              <Send className={cn(compactMode ? 'h-4 w-4' : 'h-5 w-5 sm:h-4 sm:w-4')} />
              {!compactMode && <span className="hidden sm:inline">Envoyer</span>}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
