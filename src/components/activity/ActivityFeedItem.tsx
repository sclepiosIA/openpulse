import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Icons from 'lucide-react';
import { Pin, PinOff, Link2, ExternalLink, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { ACTIVITY_COLOR_CLASSES, ACTIVITY_TYPE_LABELS, type ActivityFeedItem as Item } from '@/types/activity';
import { ReactionBar } from './ReactionBar';
import type { AggregatedReaction } from '@/hooks/activity/useActivityReactions';

interface Props {
  item: Item;
  reactions: AggregatedReaction[];
  pinned: boolean;
  highlight?: boolean;
  onToggleReaction: (activityKey: string, emoji: string, currently: boolean) => void;
  onTogglePin: (activityKey: string, currently: boolean) => void;
  onOpenDetail: (item: Item) => void;
}

export function ActivityFeedItem({
  item,
  reactions,
  pinned,
  highlight,
  onToggleReaction,
  onTogglePin,
  onOpenDetail,
}: Props) {
  const Icon = (Icons as any)[item.icon] ?? Icons.Activity;
  const colorClass = ACTIVITY_COLOR_CLASSES[item.color] ?? ACTIVITY_COLOR_CLASSES.gray;
  const initials = (item.actor_name || '?')
    .split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const time = new Date(item.occurred_at);
  const meta: any = item.metadata || {};

  const copyLink = async () => {
    const url = `${window.location.origin}/activite?focus=${encodeURIComponent(item.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié');
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  return (
    <article
      id={`activity-${item.id}`}
      className={cn(
        'relative group rounded-xl border bg-card hover:shadow-md transition-all duration-200',
        highlight && 'ring-2 ring-primary animate-pulse',
        pinned && 'border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10'
      )}
    >
      <div className="flex gap-3 p-4">
        {/* Timeline node + icon */}
        <div className="relative flex flex-col items-center shrink-0">
          <div className={cn('h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-background', colorClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <header className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <span className="font-semibold text-sm truncate">{item.actor_name}</span>
              <Badge variant="secondary" className="text-[10px] h-5">
                {ACTIVITY_TYPE_LABELS[item.type]}
              </Badge>
              {pinned && <Pin className="h-3 w-3 text-amber-500" />}
            </div>
            <div className="flex items-center gap-1">
              <time
                className="text-xs text-muted-foreground tabular-nums"
                title={format(time, 'PPPp', { locale: fr })}
              >
                {format(time, 'HH:mm')} · {formatDistanceToNow(time, { addSuffix: true, locale: fr })}
              </time>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Plus d'options">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onTogglePin(item.id, pinned)}>
                    {pinned ? <><PinOff className="h-3.5 w-3.5 mr-2" /> Désépingler</> : <><Pin className="h-3.5 w-3.5 mr-2" /> Épingler</>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={copyLink}>
                    <Link2 className="h-3.5 w-3.5 mr-2" /> Copier le lien
                  </DropdownMenuItem>
                  {item.link && (
                    <DropdownMenuItem asChild>
                      <Link to={item.link}><ExternalLink className="h-3.5 w-3.5 mr-2" /> Ouvrir</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            className="mt-2 text-left w-full"
          >
            <h3 className="text-sm font-medium leading-snug line-clamp-2 break-words">{item.title}</h3>
            {item.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{item.description}</p>
            )}
          </button>

          {/* Contextual chips */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {item.etablissement_id && item.etablissement_nom && (
              <Link to={`/etablissements/${item.etablissement_id}`} onClick={(e) => e.stopPropagation()}>
                <Badge variant="outline" className="text-[10px] h-5 hover:bg-muted">
                  🏥 {item.etablissement_nom}
                </Badge>
              </Link>
            )}
            {meta.statut && (
              <Badge variant="outline" className="text-[10px] h-5">{String(meta.statut)}</Badge>
            )}
            {meta.priorite && (
              <Badge variant="outline" className="text-[10px] h-5">⚡ {String(meta.priorite)}</Badge>
            )}
            {typeof meta.montant_ttc === 'number' && (
              <Badge variant="outline" className="text-[10px] h-5">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(meta.montant_ttc)}
              </Badge>
            )}
            {meta.category && (
              <Badge variant="outline" className="text-[10px] h-5">{String(meta.category)}</Badge>
            )}
          </div>

          {/* Footer: reactions */}
          <footer className="mt-2.5 pt-2 border-t border-border/50">
            <ReactionBar
              activityKey={item.id}
              reactions={reactions}
              onToggle={(emoji, currently) => onToggleReaction(item.id, emoji, currently)}
            />
          </footer>
        </div>
      </div>
    </article>
  );
}
