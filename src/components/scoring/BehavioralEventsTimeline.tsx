import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBehavioralEvents } from '@/hooks/crm/useBehavioralScore';
import { BEHAVIORAL_EVENT_LABELS } from '@/types/scoring';
import { Mail, MousePointerClick, Reply, CalendarCheck, CalendarX, CheckSquare, FileText, Zap, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const ICONS = {
  email_opened: Mail,
  email_clicked: MousePointerClick,
  email_replied: Reply,
  meeting_attended: CalendarCheck,
  meeting_no_show: CalendarX,
  task_completed: CheckSquare,
  document_viewed: FileText,
  quick_response: Zap,
} as const;

interface Props {
  etablissementId: string;
  limit?: number;
}

export function BehavioralEventsTimeline({ etablissementId, limit = 20 }: Props) {
  const { data: events, isLoading } = useBehavioralEvents(etablissementId, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Événements récents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : !events?.length ? (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Aucun événement comportemental enregistré.
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-3">
            <ul className="space-y-3">
              {events.map(ev => {
                const Icon = ICONS[ev.event_type] ?? Activity;
                const positive = ev.weight >= 0;
                return (
                  <li key={ev.id} className="flex items-start gap-3 text-sm">
                    <div className={`mt-0.5 rounded-full p-1.5 ${positive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{BEHAVIORAL_EVENT_LABELS[ev.event_type]}</span>
                        <Badge variant="outline" className={`font-mono text-xs shrink-0 ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
                          {ev.weight > 0 ? '+' : ''}{ev.weight}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ev.occurred_at), { addSuffix: true, locale: fr })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
