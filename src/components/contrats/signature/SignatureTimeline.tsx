import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SIGNATURE_EVENT_LABELS, type SignatureEvent } from '@/types/signature';

interface Props { events: SignatureEvent[]; }

const dotColor: Record<string, string> = {
  created: 'bg-gray-400',
  sent: 'bg-blue-500',
  opened: 'bg-amber-500',
  viewed: 'bg-amber-500',
  signed: 'bg-indigo-500',
  completed: 'bg-green-500',
  refused: 'bg-red-500',
  expired: 'bg-orange-500',
  reminded: 'bg-blue-400',
  cancelled: 'bg-slate-500',
  error: 'bg-red-600',
};

export default function SignatureTimeline({ events }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Historique de la signature
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun événement enregistré pour le moment.
          </p>
        ) : (
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dotColor[e.event_type] ?? 'bg-gray-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium">{SIGNATURE_EVENT_LABELS[e.event_type] ?? e.event_type}</p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                  {(e.signer_email || e.signer_name) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {e.signer_name ?? e.signer_email}
                      {e.signer_name && e.signer_email ? ` · ${e.signer_email}` : ''}
                    </p>
                  )}
                  {e.ip_address && (
                    <Badge variant="outline" className="mt-1 text-[10px]">IP {String(e.ip_address)}</Badge>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
