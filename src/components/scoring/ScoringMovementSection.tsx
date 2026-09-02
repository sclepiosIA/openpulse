import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ScoringOverviewProspect } from '@/hooks/crm/useBehavioralScore';

interface Props {
  title: string;
  icon: React.ReactNode;
  items?: ScoringOverviewProspect[];
  loading?: boolean;
  emptyText?: string;
  onClick: (id: string) => void;
  showVelocity?: boolean;
  showLastEngagement?: boolean;
}

export function ScoringMovementSection({
  title, icon, items, loading,
  emptyText = 'Aucun prospect dans ce segment.',
  onClick, showVelocity = true, showLastEngagement = false,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
          {items && items.length > 0 && <Badge variant="secondary">{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={`scoring-movement-skeleton-${i}`} className="h-10 w-full" />)}</div>
        ) : !items?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => onClick(p.id)}
                  className="w-full flex items-center justify-between gap-2 text-sm py-2 px-2 rounded hover:bg-muted text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.nom}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{p.statut}</span>
                      {showLastEngagement && p.last_engagement_at && (
                        <span>· {formatDistanceToNow(new Date(p.last_engagement_at), { addSuffix: true, locale: fr })}</span>
                      )}
                      {showLastEngagement && !p.last_engagement_at && <span>· jamais</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {showVelocity && Number(p.velocity) !== 0 && (
                      <Badge variant="outline" className={`font-mono text-xs ${Number(p.velocity) > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {Number(p.velocity) > 0 ? '+' : ''}{Number(p.velocity).toFixed(1)}
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-mono text-xs">{p.score}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
