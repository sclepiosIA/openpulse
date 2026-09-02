import { useMemo, useEffect, useRef, useState } from 'react';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ActivityFeedItem } from './ActivityFeedItem';
import { ActivityFeedSkeleton } from './ActivityFeedSkeleton';
import { ActivityDetailSheet } from './ActivityDetailSheet';
import { Button } from '@/components/ui/button';
import { Activity, ArrowUp } from 'lucide-react';
import { useActivityReactions } from '@/hooks/activity/useActivityReactions';
import { useActivityPins } from '@/hooks/activity/useActivityPins';
import type { ActivityFeedItem as Item } from '@/types/activity';

interface Props {
  items: Item[];
  isLoading?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  pendingNew?: number;
  onRefresh?: () => void;
  focusId?: string | null;
  emptyLabel?: string;
}

function groupLabel(d: Date): string {
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  if (isThisWeek(d, { locale: fr })) return 'Cette semaine';
  return format(d, 'd MMMM yyyy', { locale: fr });
}

export function ActivityFeedTimeline({
  items,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  pendingNew = 0,
  onRefresh,
  focusId,
  emptyLabel = 'Aucune activité à afficher',
}: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach((it) => {
      const key = groupLabel(new Date(it.occurred_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    return Array.from(map.entries());
  }, [items]);

  const activityKeys = useMemo(() => items.map((i) => i.id), [items]);
  const { reactionsByKey, toggle: toggleReaction } = useActivityReactions(activityKeys);
  const { pinnedKeys, togglePin } = useActivityPins();

  const [detailItem, setDetailItem] = useState<Item | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!onLoadMore || !hasNextPage) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) onLoadMore();
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onLoadMore, hasNextPage, isFetchingNextPage]);

  // Scroll to focused item
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(`activity-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusId, items.length]);

  if (isLoading && items.length === 0) return <ActivityFeedSkeleton />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {pendingNew > 0 && (
        <div className="sticky top-2 z-20 flex justify-center mb-2">
          <Button size="sm" onClick={onRefresh} className="rounded-full shadow-lg gap-2">
            <ArrowUp className="h-3.5 w-3.5" />
            {pendingNew} nouvelle{pendingNew > 1 ? 's' : ''} activité{pendingNew > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      <div className="space-y-8">
        {groups.map(([label, groupItems]) => (
          <section key={label}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
              {label} <span className="text-muted-foreground/60 font-normal normal-case">· {groupItems.length} activité{groupItems.length > 1 ? 's' : ''}</span>
            </h3>
            <div className="relative space-y-3 pl-0 md:pl-6">
              {/* Vertical line decoration */}
              <div className="hidden md:block absolute left-[19px] top-2 bottom-2 w-px bg-border" aria-hidden />
              {groupItems.map((it) => (
                <div key={it.id} className="relative">
                  <ActivityFeedItem
                    item={it}
                    reactions={reactionsByKey[it.id] ?? []}
                    pinned={pinnedKeys.has(it.id)}
                    highlight={focusId === it.id}
                    onToggleReaction={toggleReaction}
                    onTogglePin={togglePin}
                    onOpenDetail={setDetailItem}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}

        {hasNextPage && (
          <div ref={sentinelRef} className="flex justify-center py-4">
            <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
            </Button>
          </div>
        )}
      </div>

      <ActivityDetailSheet
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(o) => !o && setDetailItem(null)}
        pinned={detailItem ? pinnedKeys.has(detailItem.id) : false}
        onTogglePin={togglePin}
      />
    </div>
  );
}
