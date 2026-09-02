import { useCallback, useMemo } from 'react';
import { BarChart3, Check, Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePulsePoll, useVotePoll, useUnvotePoll } from '@/hooks/pulse/usePulsePolls';
import { cn } from '@/lib/utils';

interface PollInlineCardProps {
  pollId: string;
}

export function PollInlineCard({ pollId }: PollInlineCardProps) {
  const { data: poll, isLoading, error } = usePulsePoll(pollId);
  const vote = useVotePoll();
  const unvote = useUnvotePoll();

  const isExpired = useMemo(() => {
    if (!poll?.ends_at) return false;
    return new Date(poll.ends_at) < new Date();
  }, [poll?.ends_at]);

  const hasVoted = useMemo(() => {
    return (poll?.my_votes?.length || 0) > 0;
  }, [poll?.my_votes]);

  // Calculate remaining time for active polls - MUST be before conditional returns
  const remainingTime = useMemo(() => {
    if (!poll?.ends_at || isExpired) return null;
    const endsAt = new Date(poll.ends_at);
    const now = new Date();
    const diffMs = endsAt.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}j restant${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `${diffHours}h restante${diffHours > 1 ? 's' : ''}`;
    return 'Se termine bientôt';
  }, [poll?.ends_at, isExpired]);

  const handleVote = useCallback((optionId: string) => {
    if (!poll || isExpired) return;

    const alreadyVoted = poll.my_votes?.includes(optionId);

    if (alreadyVoted) {
      unvote.mutate({ pollId: poll.id, optionId });
    } else {
      // If not multiple choice, remove previous vote first
      if (!poll.is_multiple_choice && poll.my_votes && poll.my_votes.length > 0) {
        // Remove all previous votes
        poll.my_votes.forEach(prevOptionId => {
          unvote.mutate({ pollId: poll.id, optionId: prevOptionId });
        });
      }
      vote.mutate({ pollId: poll.id, optionId });
    }
  }, [poll, isExpired, vote, unvote]);

  if (isLoading) {
    return (
      <div className="mt-2 p-3 bg-muted/30 rounded-lg border space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="mt-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20 text-sm text-destructive">
        Impossible de charger le sondage
      </div>
    );
  }

  const totalVotes = poll.total_votes || 0;

  return (
    <div className="mt-3 p-4 bg-card rounded-xl border shadow-sm space-y-3 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">{poll.question}</span>
        </div>
        {isExpired ? (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full font-medium">
            Terminé
          </span>
        ) : remainingTime && (
          <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full font-medium">
            {remainingTime}
          </span>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options?.map((option, index) => {
          const voteCount = option.vote_count || 0;
          const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isSelected = poll.my_votes?.includes(option.id);
          
          // Different colors for options
          const optionColors = [
            'bg-primary/20',
            'bg-blue-500/20',
            'bg-emerald-500/20',
            'bg-amber-500/20',
            'bg-purple-500/20',
          ];
          const barColor = isSelected ? 'bg-primary/25' : optionColors[index % optionColors.length];

          return (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              disabled={isExpired || vote.isPending || unvote.isPending}
              className={cn(
                "w-full relative overflow-hidden rounded-lg border p-3 text-left transition-all duration-200",
                "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background/50",
                (isExpired || vote.isPending || unvote.isPending) && "cursor-default opacity-80"
              )}
            >
              {/* Background progress bar */}
              {hasVoted && (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-500 ease-out rounded-l-lg",
                    barColor
                  )}
                  style={{ width: `${percentage}%` }}
                />
              )}

              {/* Content */}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className={cn("text-sm", isSelected && "font-medium text-foreground")}>
                    {option.text}
                  </span>
                </div>
                {hasVoted && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {voteCount}
                    </span>
                    <span className="text-sm font-semibold text-foreground min-w-[2.5rem] text-right">
                      {percentage}%
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
        <div className="flex items-center gap-1.5 pt-2">
          <Users className="h-3.5 w-3.5" />
          <span className="font-medium">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2 pt-2">
          {poll.is_multiple_choice && (
            <span className="bg-muted px-2 py-0.5 rounded text-xs">Choix multiples</span>
          )}
          {poll.is_anonymous && (
            <span className="bg-muted px-2 py-0.5 rounded text-xs">Anonyme</span>
          )}
        </div>
      </div>
    </div>
  );
}
