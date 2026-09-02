import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';
import { REACTION_EMOJIS } from '@/types/activity';
import type { AggregatedReaction } from '@/hooks/activity/useActivityReactions';
import { cn } from '@/lib/utils';

interface Props {
  activityKey: string;
  reactions: AggregatedReaction[];
  onToggle: (emoji: string, currently: boolean) => void;
}

export function ReactionBar({ activityKey, reactions, onToggle }: Props) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(r.emoji, r.reactedByMe); }}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 h-6 rounded-full text-xs border transition-colors',
            r.reactedByMe ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-muted/50 border-transparent hover:bg-muted'
          )}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums font-medium">{r.count}</span>
        </button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
            aria-label="Ajouter une réaction"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" onClick={(e) => e.stopPropagation()} align="start">
          <div className="flex gap-0.5">
            {REACTION_EMOJIS.map((e) => {
              const cur = reactions.find((r) => r.emoji === e);
              return (
                <button
                  key={e}
                  onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); onToggle(e, !!cur?.reactedByMe); }}
                  className={cn(
                    'h-8 w-8 rounded-md hover:bg-muted text-lg leading-none flex items-center justify-center',
                    cur?.reactedByMe && 'bg-primary/10'
                  )}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
