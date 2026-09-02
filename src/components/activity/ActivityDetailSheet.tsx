import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Icons from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ExternalLink, Pin, PinOff, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { ACTIVITY_COLOR_CLASSES, ACTIVITY_TYPE_LABELS, type ActivityFeedItem } from '@/types/activity';
import { cn } from '@/lib/utils';

interface Props {
  item: ActivityFeedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinned: boolean;
  onTogglePin: (key: string, currently: boolean) => void;
}

export function ActivityDetailSheet({ item, open, onOpenChange, pinned, onTogglePin }: Props) {
  if (!item) return null;
  const Icon = (Icons as any)[item.icon] ?? Icons.Activity;
  const colorClass = ACTIVITY_COLOR_CLASSES[item.color] ?? ACTIVITY_COLOR_CLASSES.gray;
  const initials = (item.actor_name || '?').split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const meta: any = item.metadata || {};

  const copyLink = async () => {
    const url = `${window.location.origin}/activite?focus=${encodeURIComponent(item.id)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Lien copié');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={cn('h-12 w-12 rounded-full flex items-center justify-center', colorClass)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="secondary" className="text-[10px] mb-1">{ACTIVITY_TYPE_LABELS[item.type]}</Badge>
              <SheetTitle className="text-left text-base leading-snug">{item.title}</SheetTitle>
            </div>
          </div>
          <SheetDescription className="text-left">
            {format(new Date(item.occurred_at), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{item.actor_name}</p>
              <p className="text-xs text-muted-foreground">Auteur</p>
            </div>
          </div>

          {item.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap break-words">{item.description}</p>
            </div>
          )}

          {item.etablissement_id && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Établissement</p>
              <Link to={`/etablissements/${item.etablissement_id}`}>
                <Badge variant="outline" className="hover:bg-muted">
                  🏥 {item.etablissement_nom || 'Voir la fiche'}
                </Badge>
              </Link>
            </div>
          )}

          {Object.keys(meta).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Détails</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(meta).map(([k, v]) => (
                  <div key={k} className="bg-muted/50 rounded p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p>
                    <p className="font-medium truncate">{v == null ? '—' : String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        <div className="flex flex-wrap gap-2">
          {item.link && (
            <Button asChild size="sm">
              <Link to={item.link}><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Ouvrir</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onTogglePin(item.id, pinned)}>
            {pinned ? <><PinOff className="h-3.5 w-3.5 mr-1.5" /> Désépingler</> : <><Pin className="h-3.5 w-3.5 mr-1.5" /> Épingler</>}
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" /> Copier le lien
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
