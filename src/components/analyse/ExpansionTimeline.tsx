import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp } from 'lucide-react';

interface ExpansionTimelineProps {
  etablissements: any[];
}

export function ExpansionTimeline({ etablissements }: ExpansionTimelineProps) {
  // Regrouper les établissements par année de signature
  const timelineData = etablissements
    .filter((e: any) => e.date_signature)
    .reduce((acc: Record<number, any[]>, etab: any) => {
      const year = new Date(etab.date_signature).getFullYear();
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(etab);
      return acc;
    }, {} as Record<number, any[]>);

  const years = Object.keys(timelineData)
    .map(Number)
    .sort((a, b) => b - a);

  if (years.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline d'Expansion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune donnée de date de signature disponible
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Timeline d'Expansion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {years.map((year, index) => {
            const yearEtabs = timelineData[year];
            const regionSet = new Set(yearEtabs.map((e) => e.region));

            return (
              <div key={year} className="relative">
                {index < years.length - 1 && (
                  <div className="absolute left-4 top-12 bottom-0 w-px bg-border" />
                )}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-2 pb-8">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{year}</h3>
                      <Badge variant="secondary">{yearEtabs.length} nouveaux</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {regionSet.size} région{regionSet.size > 1 ? 's' : ''} :{' '}
                      {Array.from(regionSet).slice(0, 3).join(', ')}
                      {regionSet.size > 3 && ` +${regionSet.size - 3}`}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {yearEtabs.slice(0, 5).map((etab: any) => (
                        <Badge key={etab.id} variant="outline" className="text-xs">
                          {etab.ville}
                        </Badge>
                      ))}
                      {yearEtabs.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{yearEtabs.length - 5}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
