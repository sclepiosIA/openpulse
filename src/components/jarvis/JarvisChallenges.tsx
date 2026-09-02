/**
 * JARVIS V12.0 - Challenges Hebdomadaires
 * 
 * Système de gamification avec défis personnalisés basés sur des données réelles
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Zap,
  CheckCircle2,
  Star,
  Flame,
  TrendingUp,
  Mail,
  ListTodo,
  Users,
  Award,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useJarvisGamification } from '@/hooks/jarvis/useJarvisGamification';
import { useTaches } from '@/hooks/tasks/useTaches';
import { startOfWeek, isAfter, parseISO } from 'date-fns';

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  type: 'daily' | 'weekly' | 'special';
  target: number;
  current: number;
  points: number;
  completed: boolean;
  color: string;
}

interface JarvisChallengesProps {
  compact?: boolean;
  className?: string;
}

/**
 * Calcule les challenges à partir des données réelles (tâches).
 * Les compteurs reflètent l'activité de la semaine en cours.
 */
function useLiveChallenges(): Challenge[] {
  const { data: taches } = useTaches();

  return useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    // Tâches de la semaine
    const weekTasks = (taches || []).filter(t => {
      const updated = t.updated_at ? parseISO(t.updated_at) : null;
      return updated && isAfter(updated, weekStart);
    });

    const completedThisWeek = weekTasks.filter(t => t.statut === 'Terminé').length;
    const highPriorityDone = weekTasks.filter(t => t.statut === 'Terminé' && t.priorite === 'high').length;
    const totalActive = (taches || []).filter(t => t.statut !== 'Terminé').length;

    // Unique responsables collaborés cette semaine
    const uniqueCollabs = new Set(
      weekTasks
        .filter(t => t.responsable_id)
        .map(t => t.responsable_id)
    ).size;

    return [
      {
        id: 'tasks_complete',
        title: '100% Productivité',
        description: 'Complétez 20 tâches cette semaine',
        icon: ListTodo,
        type: 'weekly',
        target: 20,
        current: Math.min(completedThisWeek, 20),
        points: 100,
        completed: completedThisWeek >= 20,
        color: 'from-emerald-500 to-emerald-600',
      },
      {
        id: 'high_priority',
        title: 'Priorité Max',
        description: 'Terminez 5 tâches haute priorité',
        icon: Zap,
        type: 'weekly',
        target: 5,
        current: Math.min(highPriorityDone, 5),
        points: 75,
        completed: highPriorityDone >= 5,
        color: 'from-purple-500 to-purple-600',
      },
      {
        id: 'inbox_zero',
        title: 'Inbox Zéro',
        description: 'Réduisez les tâches actives sous 10',
        icon: Mail,
        type: 'weekly',
        target: 10,
        current: Math.min(10, Math.max(0, 10 - totalActive + 10)),
        points: 50,
        completed: totalActive <= 10,
        color: 'from-blue-500 to-blue-600',
      },
      {
        id: 'team_collab',
        title: "Esprit d'équipe",
        description: 'Collaborez avec 3 membres différents',
        icon: Users,
        type: 'weekly',
        target: 3,
        current: Math.min(uniqueCollabs, 3),
        points: 80,
        completed: uniqueCollabs >= 3,
        color: 'from-pink-500 to-pink-600',
      },
    ];
  }, [taches]);
}

export function JarvisChallenges({ compact = false, className }: JarvisChallengesProps) {
  const { score, addScore } = useJarvisGamification();
  const challenges = useLiveChallenges();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const completedCount = challenges.filter(c => c.completed).length;
  const totalPoints = challenges.reduce((sum, c) => sum + (c.completed ? c.points : 0), 0);
  const potentialPoints = challenges.reduce((sum, c) => sum + c.points, 0);

  const handleClaimReward = async (challengeId: string, points: number) => {
    setClaimingId(challengeId);
    await new Promise(r => setTimeout(r, 500));
    await addScore(points, 'Challenge complété');
    setClaimingId(null);
  };

  if (compact) {
    const activeChallenge = challenges.find(c => !c.completed) || challenges[0];
    return (
      <motion.div 
        className={cn("p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20", className)}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-gradient-to-br", activeChallenge.color)}>
            <activeChallenge.icon className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{activeChallenge.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress 
                value={(activeChallenge.current / activeChallenge.target) * 100} 
                className="h-1.5 flex-1"
              />
              <span className="text-xs text-muted-foreground">
                {activeChallenge.current}/{activeChallenge.target}
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            +{activeChallenge.points}pts
          </Badge>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
            <Trophy className="h-5 w-5 text-primary" />
            Challenges de la semaine
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {completedCount}/{challenges.length} complétés • {totalPoints}/{potentialPoints} pts gagnés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-destructive" />
          <span className="font-bold text-lg text-foreground">{score?.currentStreakDays || 0}</span>
          <span className="text-sm text-muted-foreground">jours</span>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progression globale</span>
          <span className="text-sm text-muted-foreground">
            {Math.round((completedCount / challenges.length) * 100)}%
          </span>
        </div>
        <Progress value={(completedCount / challenges.length) * 100} className="h-2" />
      </div>

      {/* Challenges Grid */}
      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {challenges.map((challenge, index) => {
            const Icon = challenge.icon;
            const progress = (challenge.current / challenge.target) * 100;
            
            return (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "relative p-4 rounded-xl border transition-all",
                  challenge.completed 
                    ? "bg-primary/5 border-primary/30" 
                    : "bg-card hover:bg-accent/50 border-border"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-xl bg-gradient-to-br shadow-lg",
                    challenge.color,
                    challenge.completed && "opacity-60"
                  )}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{challenge.title}</h4>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px]",
                          challenge.type === 'daily' && "border-primary/50 text-primary",
                          challenge.type === 'weekly' && "border-secondary/50 text-secondary-foreground",
                          challenge.type === 'special' && "border-accent/50 text-accent-foreground"
                        )}
                      >
                        {challenge.type === 'daily' ? 'Quotidien' : 
                         challenge.type === 'weekly' ? 'Hebdo' : 'Spécial'}
                      </Badge>
                      {challenge.completed && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {challenge.description}
                    </p>

                    <div className="flex items-center gap-3 mt-3">
                      <Progress 
                        value={progress} 
                        className={cn("h-2 flex-1", challenge.completed && "opacity-60")} 
                      />
                      <span className="text-xs font-medium min-w-[60px] text-right">
                        {challenge.current}/{challenge.target}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-primary">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="font-bold">{challenge.points}</span>
                    </div>
                    
                    {challenge.completed && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-primary hover:bg-primary/90"
                        onClick={() => handleClaimReward(challenge.id, challenge.points)}
                        disabled={claimingId === challenge.id}
                      >
                        {claimingId === challenge.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          >
                            <Award className="h-3 w-3" />
                          </motion.div>
                        ) : (
                          <>
                            <Award className="h-3 w-3 mr-1" />
                            Réclamer
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Motivation Footer */}
      <motion.div 
        className="text-center py-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4 inline mr-1 text-primary" />
          Complétez tous les challenges pour débloquer des récompenses exclusives !
        </p>
      </motion.div>
    </div>
  );
}
