import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIProgressIndicatorProps {
  operationType: "reformulate" | "translate" | "suggest" | "analyze" | "correct";
  onComplete?: () => void;
  className?: string;
}

const operationMessages = {
  reformulate: {
    title: "Reformulation en cours",
    description: "L'IA reformule votre texte...",
    icon: Brain,
  },
  translate: {
    title: "Traduction en cours",
    description: "L'IA traduit votre texte...",
    icon: Brain,
  },
  correct: {
    title: "Correction en cours",
    description: "L'IA vérifie l'orthographe et la grammaire...",
    icon: Brain,
  },
  suggest: {
    title: "Génération de suggestions",
    description: "L'IA analyse le contexte et génère des suggestions...",
    icon: Brain,
  },
  analyze: {
    title: "Analyse IA en cours",
    description: "L'IA analyse le contenu de l'email (jusqu'à 90s)...",
    icon: Brain,
  },
};

export function AIProgressIndicator({ 
  operationType, 
  onComplete,
  className 
}: AIProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const maxTime = 90; // 90 secondes max
  const config = operationMessages[operationType];
  const Icon = config.icon;

  useEffect(() => {
    const startTime = Date.now();
    
    // Update progress every 100ms
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
      
      // Calculate progress (0-100)
      const progressValue = Math.min((elapsed / maxTime) * 100, 99);
      setProgress(progressValue);
      
      // If we reach max time, stop
      if (elapsed >= maxTime) {
        clearInterval(progressInterval);
        setProgress(100);
        onComplete?.();
      }
    }, 100);

    return () => clearInterval(progressInterval);
  }, [maxTime, onComplete]);

  const remainingTime = Math.max(0, maxTime - elapsedTime);
  const isWarning = elapsedTime > 60; // Warning after 60s

  return (
    <Card className={cn(
      "p-4 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 animate-fade-in",
      className
    )}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon className="h-5 w-5 text-primary animate-pulse" />
            <Loader2 className="h-5 w-5 text-primary animate-spin absolute inset-0" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm">{config.title}</h4>
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <Progress 
            value={progress} 
            className="h-2 transition-all duration-300"
          />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              Temps écoulé: <span className="font-mono font-medium">{elapsedTime}s</span>
            </span>
            <span className={cn(
              "font-mono font-medium transition-colors",
              isWarning ? "text-orange-500 animate-pulse" : "text-muted-foreground"
            )}>
              Reste: {remainingTime}s
            </span>
          </div>
        </div>

        {/* Warning for long operations */}
        {isWarning && (
          <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 rounded-md animate-fade-in border border-orange-200 dark:border-orange-900">
            ⏱️ Opération longue détectée - L'IA traite une requête complexe
          </div>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-75" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150" />
          </div>
          <span className="text-muted-foreground">
            Traitement par GPT-5 (Azure OpenAI)
          </span>
        </div>
      </div>
    </Card>
  );
}
