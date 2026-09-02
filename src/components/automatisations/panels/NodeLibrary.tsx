import { Card } from '@/components/ui/card';
import { Zap, GitBranch, Clock, Sparkles } from 'lucide-react';

interface NodeLibraryProps {
  onAddNode: (type: 'condition' | 'action' | 'delay') => void;
}

const ITEMS: Array<{
  type: 'condition' | 'action' | 'delay';
  label: string;
  description: string;
  icon: typeof Zap;
  color: string;
}> = [
  { type: 'condition', label: 'Condition', description: 'Branche if/else', icon: GitBranch, color: 'text-amber-500' },
  { type: 'action', label: 'Action', description: 'Effet métier', icon: Sparkles, color: 'text-emerald-500' },
  { type: 'delay', label: 'Délai', description: 'Attendre X temps', icon: Clock, color: 'text-blue-500' },
];

export function NodeLibrary({ onAddNode }: NodeLibraryProps) {
  return (
    <div className="w-64 border-r bg-muted/30 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold mb-3 text-foreground">Blocs disponibles</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Cliquez pour ajouter un bloc au workflow.
      </p>
      <div className="space-y-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.type}
              className="p-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              onClick={() => onAddNode(item.type)}
            >
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 ${item.color}`} />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 p-3 rounded-md bg-primary/5 border border-primary/20">
        <div className="text-xs font-semibold text-primary mb-1">💡 Astuce</div>
        <p className="text-xs text-muted-foreground">
          Reliez les blocs en glissant depuis le point de sortie d'un bloc vers le point d'entrée du suivant.
          Les variables sont interpolées avec <code className="text-[10px] bg-background px-1 rounded">{'{{trigger.field}}'}</code>.
        </p>
      </div>
    </div>
  );
}
