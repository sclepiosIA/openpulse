import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { CheckCircle, Lightbulb, Home, Building2, Loader2 } from "lucide-react";

interface EmailClassificationProgressProps {
  total: number;
  processed: number;
  matched: number;
  suggested: number;
  hors: number;
  interne: number;
  isRunning: boolean;
}

export function EmailClassificationProgress({
  total,
  processed,
  matched,
  suggested,
  hors,
  interne,
  isRunning
}: EmailClassificationProgressProps) {
  const progressPercentage = total > 0 ? (processed / total) * 100 : 0;

  return (
    <Card className="p-6 space-y-6">
      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progression globale</span>
          <span className="text-muted-foreground">
            {processed} / {total}
          </span>
        </div>
        <Progress value={progressPercentage} className="h-3" />
      </div>

      {/* Statistiques en temps réel */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold">{processed}</div>
          <div className="text-xs text-muted-foreground">Traités</div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{matched}</div>
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-xs text-muted-foreground">Attribués</div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{suggested}</div>
            <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xs text-muted-foreground">Suggestions</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{hors}</div>
            <Home className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-xs text-muted-foreground">Hors étab.</div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{interne}</div>
            <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-xs text-muted-foreground">Interne</div>
        </div>
      </div>

      {/* Indicateur de traitement */}
      {isRunning && (
        <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-primary font-medium">
            Classification en cours... Cela peut prendre plusieurs minutes.
          </span>
        </div>
      )}
    </Card>
  );
}
