import { Link } from 'react-router-dom';

import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Icons from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Activity, ArrowRight } from 'lucide-react';
import { useGlobalActivityFeed } from '@/hooks/activity/useGlobalActivityFeed';
import { ActivityFeedSkeleton } from '@/components/activity/ActivityFeedSkeleton';
import { ACTIVITY_COLOR_CLASSES, type ActivityFeedItem } from '@/types/activity';
import { cn } from '@/lib/utils';

function CompactRow({ item }: { item: ActivityFeedItem }) {
  const Icon = (Icons as any)[item.icon] ?? Icons.Activity;
  const colorClass = ACTIVITY_COLOR_CLASSES[item.color] ?? ACTIVITY_COLOR_CLASSES.gray;
  const initials = (item.actor_name || '?').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const content = (
    <div className="flex gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Avatar className="h-4 w-4"><AvatarFallback className="text-[8px]">{initials}</AvatarFallback></Avatar>
          <span className="text-xs font-medium truncate">{item.actor_name}</span>
          {item.etablissement_nom && (
            <span className="text-[11px] text-muted-foreground truncate">· {item.etablissement_nom}</span>
          )}
        </div>
        <p className="text-xs mt-0.5 line-clamp-1 break-words">{item.title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true, locale: fr })}
        </p>
      </div>
    </div>
  );
  return item.link ? <Link to={item.link} className="block">{content}</Link> : content;
}

export function RecentActivityWidget() {
  const { items, isLoading } = useGlobalActivityFeed({ pageSize: 10 });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" />
          Activité récente
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7">
          <Link to="/activite" className="text-xs">
            Voir tout <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
        {isLoading ? (
          <ActivityFeedSkeleton count={4} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune activité récente</p>
        ) : (
          <div className="space-y-1">
            {items.slice(0, 10).map((it) => (
              <CompactRow key={it.id} item={it} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
