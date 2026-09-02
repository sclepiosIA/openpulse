/**
 * JarvisPredictionsPanel - Panneau des prédictions comportementales
 * 
 * Affiche les prédictions de Jarvis basées sur le comportement utilisateur.
 */

import { motion } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  Clock,
  Zap,
  Brain,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useJarvisEnhanced } from '@/hooks/jarvis/useJarvisEnhanced';

interface JarvisPredictionsPanelProps {
  onExecutePrediction: (command: string) => void;
}

const CATEGORY_STYLES: Record<string, { icon: typeof Sparkles; color: string }> = {
  routine: { icon: Clock, color: 'text-blue-500' },
  productivity: { icon: TrendingUp, color: 'text-emerald-500' },
  sales: { icon: Zap, color: 'text-amber-500' },
  management: { icon: Brain, color: 'text-purple-500' },
};

export function JarvisPredictionsPanel({ onExecutePrediction }: JarvisPredictionsPanelProps) {
  const { 
    predictions, 
    behaviorStats, 
    isPredictionsLoading, 
    getContextualPredictions,
    refetchPredictions 
  } = useJarvisEnhanced();

  const contextualPredictions = getContextualPredictions();

  if (isPredictionsLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Brain className="h-6 w-6 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Prédictions IA</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7"
          onClick={() => refetchPredictions()} aria-label="Actualiser">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Behavior Stats Summary */}
      {behaviorStats && (
        <div className="grid grid-cols-3 gap-2">
          <StatCard 
            label="Actions ce mois" 
            value={behaviorStats.total_actions} 
          />
          <StatCard 
            label="Heures de pointe" 
            value={behaviorStats.peak_hours.slice(0, 2).map(h => `${h}h`).join(', ')} 
          />
          <StatCard 
            label="Actions fréquentes" 
            value={behaviorStats.most_common_actions.length} 
          />
        </div>
      )}

      {/* Contextual Predictions */}
      {contextualPredictions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">
            Basé sur vos habitudes actuelles
          </p>
          {contextualPredictions.map((pred, index) => (
            <PredictionCard 
              key={`${pred.action}-${index}`}
              prediction={pred}
              index={index}
              onExecute={() => pred.executableCommand && onExecutePrediction(pred.executableCommand)}
            />
          ))}
        </div>
      )}

      {/* All Predictions */}
      {predictions.length > 0 && contextualPredictions.length < predictions.length && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1">
            Autres suggestions
          </p>
          {predictions
            .filter(p => !contextualPredictions.find(cp => cp.action === p.action))
            .slice(0, 3)
            .map((pred, index) => (
              <PredictionCard 
                key={`${pred.action}-other-${index}`}
                prediction={pred}
                index={index}
                onExecute={() => pred.executableCommand && onExecutePrediction(pred.executableCommand)}
                muted
              />
            ))}
        </div>
      )}

      {predictions.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Pas assez de données pour générer des prédictions</p>
          <p className="text-xs mt-1">Continuez à utiliser Jarvis pour améliorer les suggestions</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}

interface PredictionCardProps {
  prediction: {
    action: string;
    probability: number;
    reason: string;
    executableCommand?: string;
    category?: string;
  };
  index: number;
  onExecute: () => void;
  muted?: boolean;
}

function PredictionCard({ prediction, index, onExecute, muted }: PredictionCardProps) {
  const category = prediction.category || 'productivity';
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.productivity;
  const Icon = style.icon;
  
  const probabilityPercent = Math.round(prediction.probability * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start h-auto py-2.5 px-3 rounded-xl",
          "hover:bg-muted/50 transition-all group",
          "border border-transparent hover:border-border/50",
          muted && "opacity-70"
        )}
        onClick={onExecute}
        disabled={!prediction.executableCommand}
      >
        <div className="flex items-start gap-3 w-full">
          {/* Icon */}
          <div className={cn(
            "flex-shrink-0 p-1.5 rounded-lg bg-muted/50",
            style.color
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium truncate">
                {formatActionName(prediction.action)}
              </span>
              <Badge 
                variant="secondary" 
                className={cn(
                  "text-[9px] h-4 px-1.5",
                  probabilityPercent >= 80 && "bg-emerald-500/10 text-emerald-600",
                  probabilityPercent >= 60 && probabilityPercent < 80 && "bg-amber-500/10 text-amber-600"
                )}
              >
                {probabilityPercent}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {prediction.reason}
            </p>
            {/* Probability bar */}
            <Progress 
              value={probabilityPercent} 
              className="h-1 mt-2"
            />
          </div>

          {/* Arrow */}
          <ChevronRight className={cn(
            "h-4 w-4 text-muted-foreground/50 flex-shrink-0",
            "group-hover:text-primary group-hover:translate-x-0.5",
            "transition-all"
          )} />
        </div>
      </Button>
    </motion.div>
  );
}

function formatActionName(action: string): string {
  const names: Record<string, string> = {
    'daily_briefing': 'Briefing du jour',
    'weekly_review': 'Revue hebdomadaire',
    'weekly_summary': 'Bilan de la semaine',
    'end_of_day_review': 'Fin de journée',
    'mid_month_review': 'Point mi-mois',
    'month_end_close': 'Clôture mensuelle',
    'support_review': 'Revue support',
    'check_pipeline': 'Pipeline commercial',
    'check_emails': 'Vérifier emails',
    'review_tasks': 'Voir mes tâches',
    'check_invoices': 'Factures à suivre',
  };
  
  return names[action] || action.replace(/_/g, ' ');
}
