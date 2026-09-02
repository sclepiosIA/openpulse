import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileTableViewProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
  compact?: boolean;
}

export function MobileTableView<T>({
  data,
  keyExtractor,
  renderCard,
  emptyMessage = 'Aucune donnée disponible',
  className,
  compact = false,
}: MobileTableViewProps<T>) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {data.map((item) => (
        <Card 
          key={keyExtractor(item)} 
          className={cn(
            'touch-target-comfortable',
            compact && 'shadow-sm'
          )}
        >
          <CardContent className={cn(compact ? 'p-3' : 'p-4')}>
            {renderCard(item)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Composant helper pour les rows de détails
export function MobileTableRow({
  label,
  value,
  badge,
  className,
}: {
  label: string;
  value: React.ReactNode;
  badge?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between py-2', className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {value}
        {badge && (
          <Badge variant="outline" className="text-xs">
            {badge}
          </Badge>
        )}
      </div>
    </div>
  );
}
