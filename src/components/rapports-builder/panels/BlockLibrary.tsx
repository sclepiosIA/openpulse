import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hash, BarChart3, LineChart, PieChart, Table2, TrendingDown, FileText } from 'lucide-react';
import type { WidgetType } from '@/types/report';

interface Props {
  onAdd: (type: WidgetType) => void;
}

const BLOCKS: Array<{ type: WidgetType; label: string; icon: any; desc: string }> = [
  { type: 'kpi', label: 'KPI', icon: Hash, desc: 'Indicateur unique' },
  { type: 'bar_chart', label: 'Barres', icon: BarChart3, desc: 'Graphique en barres' },
  { type: 'line_chart', label: 'Lignes', icon: LineChart, desc: 'Évolution temporelle' },
  { type: 'donut_chart', label: 'Donut', icon: PieChart, desc: 'Répartition circulaire' },
  { type: 'table', label: 'Tableau', icon: Table2, desc: 'Liste de données' },
  { type: 'funnel', label: 'Funnel', icon: TrendingDown, desc: 'Entonnoir de conversion' },
  { type: 'markdown', label: 'Texte', icon: FileText, desc: 'Texte libre / titre' },
];

export function BlockLibrary({ onAdd }: Props) {
  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider px-2">Bibliothèque</p>
        {BLOCKS.map(b => (
          <Button
            key={b.type}
            variant="outline"
            className="w-full justify-start h-auto py-3"
            onClick={() => onAdd(b.type)}
          >
            <b.icon className="h-4 w-4 mr-3 shrink-0 text-primary" />
            <div className="flex flex-col items-start text-left">
              <span className="text-sm font-medium">{b.label}</span>
              <span className="text-[10px] text-muted-foreground">{b.desc}</span>
            </div>
          </Button>
        ))}
      </div>
    </ScrollArea>
  );
}
