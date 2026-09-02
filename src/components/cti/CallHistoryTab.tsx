/**
 * CallHistoryTab — journal d'appels d'une entité (établissement / prospect / contact).
 */
import { useCalls } from '@/hooks/voice/useCalls'
import { linkify } from '@/lib/linkify'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, PhoneIncoming, PhoneOutgoing, Loader2 } from 'lucide-react'
import { CallRecordingPlayer } from './CallRecordingPlayer'
import { CALL_STATUS_LABELS } from '@/types/calls'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Props {
  etablissementId?: string
  prospectId?: string
  contactId?: string
}

export function CallHistoryTab({ etablissementId, prospectId, contactId }: Props) {
  const { data: calls, isLoading } = useCalls({ etablissementId, prospectId, contactId, limit: 50 })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!calls || calls.length === 0) {
    return (
      <Card>
        <CardContent className="text-center text-muted-foreground py-10">
          Aucun appel enregistré.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4" /> Historique d'appels ({calls.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {calls.map((c) => (
            <div key={c.id} className="py-3 flex items-start gap-3">
              <div className="mt-1">
                {c.direction === 'outbound' ? (
                  <PhoneOutgoing className="h-4 w-4 text-primary" />
                ) : (
                  <PhoneIncoming className="h-4 w-4 text-success" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">
                    {c.display_name || (c.direction === 'outbound' ? c.to_number : c.from_number)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {CALL_STATUS_LABELS[c.status]}
                  </Badge>
                  {c.duration_sec > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(c.duration_sec / 60)}m {c.duration_sec % 60}s
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(c.started_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  {' · '}
                  {formatDistanceToNow(new Date(c.started_at), { addSuffix: true, locale: fr })}
                </div>
                {c.notes && (
                  <div className="text-xs mt-2 bg-muted/30 rounded p-2 whitespace-pre-wrap break-words">
                    {linkify(c.notes)}
                  </div>
                )}
                <div className="mt-2">
                  <CallRecordingPlayer recordingPath={c.recording_path} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
