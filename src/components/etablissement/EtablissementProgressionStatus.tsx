import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, Circle } from "lucide-react";
import { PHASE_GROUPS, PhaseKey, getPhaseByStatus } from "@/config/phases";
import { cn } from "@/lib/utils";

interface TasksBreakdown {
  commercial?: { total: number; completed: number };
  contractuel?: { total: number; completed: number };
  conformite?: { total: number; completed: number };
  deploiement?: { total: number; completed: number };
  formation?: { total: number; completed: number };
  golive?: { total: number; completed: number };
  production?: { total: number; completed: number };
}

interface EtablissementProgressionStatusProps {
  statut: string;
  progression: number;
  etablissementId: string;
  tasksBreakdown?: TasksBreakdown;
  onPhaseClick?: (phase: PhaseKey) => void;
}

const STATUS_FLOW = [
  { key: 'Prospect', label: 'Prospect', category: 'commercial' },
  { key: 'Contractuel', label: 'Contractuel', category: 'contractuel' },
  { key: 'Conformité', label: 'Conformité', category: 'conformite' },
  { key: 'Déploiement', label: 'Déploiement', category: 'deploiement' },
  { key: 'Formation', label: 'Formation', category: 'formation' },
  { key: 'Go-Live', label: 'Go-Live', category: 'golive' },
  { key: 'Production', label: 'Production', category: 'production' },
];

// Mapping des phases vers les clés du breakdown pour agréger correctement
const PHASE_TO_BREAKDOWN_KEYS: Record<PhaseKey, (keyof TasksBreakdown)[]> = {
  commercial: ['commercial'],
  deploiement: ['contractuel', 'conformite', 'deploiement', 'formation', 'golive'],
  production: ['production'],
};

export function EtablissementProgressionStatus({
  statut,
  progression,
  tasksBreakdown = {},
  onPhaseClick,
}: EtablissementProgressionStatusProps) {
  const currentPhase = getPhaseByStatus(statut);

  const getPhaseProgress = (phaseKey: PhaseKey) => {
    let totalTasks = 0;
    let completedTasks = 0;

    // Utiliser le mapping explicite des clés de breakdown par phase
    const breakdownKeys = PHASE_TO_BREAKDOWN_KEYS[phaseKey];
    breakdownKeys.forEach(key => {
      const breakdown = tasksBreakdown[key];
      if (breakdown) {
        totalTasks += breakdown.total;
        completedTasks += breakdown.completed;
      }
    });

    return {
      totalTasks,
      completedTasks,
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  };

  const getPhaseStatus = (phaseKey: PhaseKey): 'completed' | 'current' | 'upcoming' => {
    const phase = PHASE_GROUPS[phaseKey];
    const currentStatusIndex = STATUS_FLOW.findIndex(s => s.key === statut);
    
    // Find first and last status indices for this phase
    const phaseIndices = STATUS_FLOW
      .map((s, idx) => ({ status: s, index: idx }))
      .filter(item => (phase.statuts as readonly string[]).includes(item.status.key));
    
    if (phaseIndices.length === 0) return 'upcoming';
    
    const phaseFirstStatusIndex = phaseIndices[0].index;
    const phaseLastStatusIndex = phaseIndices[phaseIndices.length - 1].index;

    if (currentStatusIndex > phaseLastStatusIndex) {
      return 'completed';
    } else if (currentStatusIndex >= phaseFirstStatusIndex && currentStatusIndex <= phaseLastStatusIndex) {
      return 'current';
    } else {
      return 'upcoming';
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Progression globale</CardTitle>
            <Badge variant="secondary" className="text-lg font-bold">
              {Math.round(progression)}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progression} className="h-3" />
        </CardContent>
      </Card>

      {/* Phase Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.keys(PHASE_GROUPS) as PhaseKey[]).map((phaseKey) => {
          const phase = PHASE_GROUPS[phaseKey];
          const Icon = phase.icon;
          const progress = getPhaseProgress(phaseKey);
          const status = getPhaseStatus(phaseKey);
          const isActive = currentPhase === phaseKey;

          return (
            <Card
              key={phaseKey}
              className={cn(
                "relative transition-all duration-200 cursor-pointer hover:shadow-lg",
                phase.borderColor,
                isActive && "ring-2 ring-primary shadow-md",
                status === 'completed' && "opacity-75"
              )}
              onClick={() => onPhaseClick?.(phaseKey)}
            >
              <CardHeader className={cn("pb-3", phase.bgColor)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" style={{ color: phase.color }} />
                    <CardTitle className="text-base font-semibold">
                      {phase.label}
                    </CardTitle>
                  </div>
                  {status === 'completed' && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      Terminé
                    </Badge>
                  )}
                  {isActive && (
                    <Badge variant="default">
                      En cours
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Sub-steps */}
                <div className="space-y-2 mb-4">
                  {phase.statuts.map((statusKey) => {
                    const isCurrentStatus = statusKey === statut;
                    const statusIndex = STATUS_FLOW.findIndex(s => s.key === statusKey);
                    const currentStatusIndex = STATUS_FLOW.findIndex(s => s.key === statut);
                    const isCompleted = statusIndex < currentStatusIndex;

                    return (
                      <div
                        key={statusKey}
                        className={cn(
                          "flex items-center gap-2 text-sm px-2 py-1 rounded",
                          isCurrentStatus && "bg-primary/10 font-medium"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className={cn(
                            "h-4 w-4",
                            isCurrentStatus ? "text-primary fill-primary" : "text-muted-foreground"
                          )} />
                        )}
                        <span className={cn(
                          isCompleted && "line-through text-muted-foreground"
                        )}>
                          {statusKey}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Tasks Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tâches</span>
                    <span className="font-medium">
                      {progress.completedTasks}/{progress.totalTasks}
                    </span>
                  </div>
                  <Progress value={progress.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">
                    {progress.percentage}% complété
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
