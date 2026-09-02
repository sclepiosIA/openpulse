import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProspectScoreBadgeProps {
  score: number | null | undefined;
  factors?: { label: string; points: number; detail: string }[];
  velocity?: number | null;
  behavioralScore?: number | null;
  className?: string;
  compact?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (score >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  if (score >= 30) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 70) return 'Chaud';
  if (score >= 50) return 'Tiède';
  if (score >= 30) return 'Froid';
  return 'Très froid';
}

function VelocityIndicator({ velocity }: { velocity: number }) {
  const rounded = Math.round(velocity * 10) / 10;
  if (Math.abs(rounded) < 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3 w-3" /> stable
      </span>
    );
  }
  if (rounded > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600">
        <ArrowUp className="h-3 w-3" /> +{rounded}/sem
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-red-500">
      <ArrowDown className="h-3 w-3" /> {rounded}/sem
    </span>
  );
}

export function ProspectScoreBadge({
  score,
  factors,
  velocity,
  behavioralScore,
  className,
  compact,
}: ProspectScoreBadgeProps) {
  if (score === null || score === undefined) return null;

  const hasVelocity = velocity !== null && velocity !== undefined;
  const showTrend = hasVelocity && Math.abs(velocity!) >= 0.5;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'font-mono tabular-nums gap-1 border-0 font-medium',
        getScoreColor(score),
        className
      )}
    >
      <TrendingUp className="h-3 w-3" />
      {compact ? score : `${score}/100`}
      {showTrend && (velocity! > 0
        ? <ArrowUp className="h-3 w-3" />
        : <ArrowDown className="h-3 w-3" />)}
    </Badge>
  );

  if (!factors?.length && !hasVelocity && behavioralScore == null) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-semibold text-sm">
              Score de conversion : {score}/100 — {getScoreLabel(score)}
            </p>
            {(behavioralScore != null || hasVelocity) && (
              <div className="space-y-1 text-xs border-b border-border pb-2">
                {behavioralScore != null && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Score comportemental</span>
                    <span className="font-mono">{behavioralScore}/50</span>
                  </div>
                )}
                {hasVelocity && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Vélocité</span>
                    <VelocityIndicator velocity={velocity!} />
                  </div>
                )}
              </div>
            )}
            {factors?.map((f) => (
              <div key={`factor-${f.label}`} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span className={cn('font-mono', f.points >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {f.points > 0 ? '+' : ''}{f.points}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
