import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGeographicStats } from '@/hooks/geography/useGeographicStats';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FranceRegionMapProps {
  onRegionClick?: (region: string) => void;
  selectedRegion?: string | null;
}

export function FranceRegionMap({ onRegionClick, selectedRegion }: FranceRegionMapProps) {
  const { stats } = useGeographicStats();

  const getRegionStyle = (count: number) => {
    if (count === 0) return {
      bg: 'bg-muted/30',
      border: 'border-muted-foreground/10',
      text: 'text-muted-foreground/50',
    };
    if (count <= 3) return {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-400',
    };
    if (count <= 8) return {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-400',
    };
    if (count <= 15) return {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-700 dark:text-emerald-400',
    };
    return {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      text: 'text-primary',
    };
  };

  const sortedRegions = Object.entries(stats.byRegion)
    .sort(([, a], [, b]) => b - a);

  const maxCount = Math.max(...Object.values(stats.byRegion), 1);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-chart-2/10">
              <MapPin className="h-4 w-4 text-chart-2" />
            </div>
            <CardTitle className="text-base font-semibold">Répartition par région</CardTitle>
          </div>
          {/* Légende inline */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              1-3
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              4-8
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              9-15
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              15+
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 lg:px-6 pb-4 lg:pb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 lg:gap-3">
          {sortedRegions.map(([region, count]) => {
            const style = getRegionStyle(count);
            const isSelected = selectedRegion === region;
            const widthPercent = (count / maxCount) * 100;

            return (
              <button
                key={region}
                onClick={() => onRegionClick?.(region)}
                className={cn(
                  "relative p-3 lg:p-4 rounded-xl border-2 transition-all text-left group overflow-hidden",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  isSelected 
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]"
                    : cn("hover:border-primary/50", style.bg, style.border)
                )}
              >
                {/* Barre de progression */}
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 h-1 rounded-b-xl transition-all",
                    count === 0 ? "bg-muted-foreground/10" : "bg-current opacity-30"
                  )}
                  style={{ width: `${widthPercent}%` }}
                />
                
                <div className="relative space-y-1">
                  <p className={cn(
                    "text-xs font-medium truncate leading-tight",
                    isSelected ? "text-primary" : style.text
                  )}>
                    {region}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-xl lg:text-2xl font-bold",
                      isSelected ? "text-primary" : count === 0 ? "text-muted-foreground/50" : ""
                    )}>
                      {count}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      étab.
                    </span>
                  </div>
                </div>
                
                {/* Badge sélectionné */}
                {isSelected && (
                  <Badge className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0 h-5 bg-primary text-primary-foreground">
                    ✓
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Légende mobile */}
        <div className="flex sm:hidden items-center justify-center gap-4 text-xs mt-4 pt-3 border-t">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            1-3
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            4-8
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            9+
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
