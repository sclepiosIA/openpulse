import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProspectAttribution } from '@/hooks/crm/useProspectAttribution';
import { ATTRIBUTION_CHANNEL_LABELS, type AttributionChannel } from '@/types/scoring';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { GitBranch } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  etablissementId: string;
}

export function AttributionFunnel({ etablissementId }: Props) {
  const { data, isLoading } = useProspectAttribution(etablissementId);

  const channels = Object.entries(data?.by_channel ?? {}) as Array<[AttributionChannel, number]>;
  const sorted = channels.sort((a, b) => b[1] - a[1]);
  const max = sorted[0]?.[1] ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          Attribution multi-touch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Aucun touchpoint enregistré.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {sorted.map(([channel, weight]) => (
                <div key={channel} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{ATTRIBUTION_CHANNEL_LABELS[channel]}</span>
                    <Badge variant="outline" className="font-mono text-xs">{weight}</Badge>
                  </div>
                  <Progress value={(weight / max) * 100} className="h-2" />
                </div>
              ))}
            </div>

            {(data?.first_touch || data?.last_touch) && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t text-xs">
                {data?.first_touch && (
                  <div>
                    <div className="text-muted-foreground mb-0.5">First touch</div>
                    <div className="font-medium">{ATTRIBUTION_CHANNEL_LABELS[data.first_touch.channel]}</div>
                    <div className="text-muted-foreground">
                      {format(new Date(data.first_touch.occurred_at), 'dd MMM yyyy', { locale: fr })}
                    </div>
                  </div>
                )}
                {data?.last_touch && (
                  <div>
                    <div className="text-muted-foreground mb-0.5">Last touch</div>
                    <div className="font-medium">{ATTRIBUTION_CHANNEL_LABELS[data.last_touch.channel]}</div>
                    <div className="text-muted-foreground">
                      {format(new Date(data.last_touch.occurred_at), 'dd MMM yyyy', { locale: fr })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
