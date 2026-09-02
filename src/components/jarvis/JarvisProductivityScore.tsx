/**
 * JARVIS 12.0 - Productivity Score Component
 * 
 * Dashboard de gamification avec scores, badges et progression.
 * Encourage l'engagement et récompense l'utilisation efficace de Jarvis.
 */

import { useState, useEffect } from 'react';
import { debug } from '@/lib/debug';
import { motion } from 'framer-motion';
import {
  Trophy,
  Zap,
  CheckCircle2,
  Mail,
  Target,
  Flame,
  Award,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/shared/useAuth';
import { supabase } from "@/integrations/supabase/client";

interface UserScore {
  totalScore: number;
  weeklyScore: number;
  level: number;
  experiencePoints: number;
  timeSavedMinutes: number;
  tasksAutoCompleted: number;
  emailsProcessed: number;
  suggestionsAccepted: number;
  suggestionsRejected: number;
  currentStreakDays: number;
  longestStreakDays: number;
  badges: BadgeInfo[];
}

interface BadgeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt?: string;
  progress?: number;
}

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5000];

const ALL_BADGES: BadgeInfo[] = [
  { id: 'early_adopter', name: 'Early Adopter', description: 'Premier jour avec Jarvis', icon: '🌟' },
  { id: 'data_master', name: 'Data Master', description: '100 requêtes de données', icon: '📊' },
  { id: 'speed_demon', name: 'Speed Demon', description: '50 tâches auto-complétées', icon: '🚀' },
  { id: 'email_ninja', name: 'Email Ninja', description: '100 emails traités par IA', icon: '📧' },
  { id: 'time_saver', name: 'Time Saver', description: '10 heures économisées', icon: '⏰' },
  { id: 'streak_warrior', name: 'Streak Warrior', description: '7 jours consécutifs', icon: '🔥' },
  { id: 'perfectionist', name: 'Perfectionist', description: '95% suggestions acceptées', icon: '✨' },
  { id: 'power_user', name: 'Power User', description: 'Niveau 5 atteint', icon: '💪' },
];

interface JarvisProductivityScoreProps {
  className?: string;
  compact?: boolean;
}

export function JarvisProductivityScore({ className, compact = false }: JarvisProductivityScoreProps) {
  const { user } = useAuth();
  const [score, setScore] = useState<UserScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    
    const fetchScore = async () => {
      try {
        const { data, error } = await supabase
          .from('jarvis_user_scores')
          .select('total_score, weekly_score, level, experience_points, time_saved_minutes, tasks_auto_completed, emails_processed, suggestions_accepted, suggestions_rejected, current_streak_days, longest_streak_days, badges')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (data) {
          setScore({
            totalScore: data.total_score || 0,
            weeklyScore: data.weekly_score || 0,
            level: data.level || 1,
            experiencePoints: data.experience_points || 0,
            timeSavedMinutes: data.time_saved_minutes || 0,
            tasksAutoCompleted: data.tasks_auto_completed || 0,
            emailsProcessed: data.emails_processed || 0,
            suggestionsAccepted: data.suggestions_accepted || 0,
            suggestionsRejected: data.suggestions_rejected || 0,
            currentStreakDays: data.current_streak_days || 0,
            longestStreakDays: data.longest_streak_days || 0,
            badges: (data.badges as unknown as BadgeInfo[]) || [],
          });
        } else {
          // Initialize with defaults
          setScore({
            totalScore: 0,
            weeklyScore: 0,
            level: 1,
            experiencePoints: 0,
            timeSavedMinutes: 0,
            tasksAutoCompleted: 0,
            emailsProcessed: 0,
            suggestionsAccepted: 0,
            suggestionsRejected: 0,
            currentStreakDays: 0,
            longestStreakDays: 0,
            badges: [],
          });
        }
      } catch (error) {
        debug.error('Error fetching score:', error);
        setScore({
          totalScore: 0,
          weeklyScore: 0,
          level: 1,
          experiencePoints: 0,
          timeSavedMinutes: 0,
          tasksAutoCompleted: 0,
          emailsProcessed: 0,
          suggestionsAccepted: 0,
          suggestionsRejected: 0,
          currentStreakDays: 0,
          longestStreakDays: 0,
          badges: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchScore();
  }, [user?.id]);

  if (isLoading) {
    return <ScoreSkeleton compact={compact} className={className} />;
  }

  if (!score) {
    return null;
  }

  const levelProgress = calculateLevelProgress(score.totalScore, score.level);
  const acceptanceRate = score.suggestionsAccepted + score.suggestionsRejected > 0
    ? Math.round((score.suggestionsAccepted / (score.suggestionsAccepted + score.suggestionsRejected)) * 100)
    : 0;
  const timeSavedFormatted = formatTimeSaved(score.timeSavedMinutes);
  const earnedBadges = score.badges.filter(b => b.earnedAt);

  if (compact) {
    return (
      <CompactScore 
        score={score} 
        levelProgress={levelProgress}
        className={className}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-4', className)}
    >
      {/* Main Score Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Votre Score Jarvis</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground">{score.totalScore}</span>
                <span className="text-sm text-muted-foreground">pts</span>
                {score.weeklyScore > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    +{score.weeklyScore} cette semaine
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <Badge className="bg-primary/20 text-primary border-primary/30 text-lg px-3 py-1">
                Niveau {score.level}
              </Badge>
            </div>
          </div>
          
          {/* Level Progress */}
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progression niveau {score.level + 1}</span>
              <span>{Math.round(levelProgress)}%</span>
            </div>
            <Progress value={levelProgress} className="h-2" />
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Zap}
          label="Temps gagné"
          value={timeSavedFormatted}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <StatCard
          icon={CheckCircle2}
          label="Tâches auto"
          value={score.tasksAutoCompleted.toString()}
          color="text-emerald-600 dark:text-emerald-400"
          bgColor="bg-emerald-600/10"
        />
        <StatCard
          icon={Mail}
          label="Emails IA"
          value={score.emailsProcessed.toString()}
          color="text-primary"
          bgColor="bg-primary/10"
        />
        <StatCard
          icon={Target}
          label="Suggestions"
          value={`${acceptanceRate}%`}
          color="text-secondary-foreground"
          bgColor="bg-secondary/30"
        />
      </div>

      {/* Streak */}
      {score.currentStreakDays > 0 && (
        <Card className="bg-gradient-to-r from-destructive/10 to-destructive/5 border-destructive/30">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-destructive" />
                <span className="font-medium">Série actuelle</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-destructive">{score.currentStreakDays}</span>
                <span className="text-sm text-muted-foreground">jours</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-4 w-4 text-primary" />
            <span>Badges débloqués</span>
            <Badge variant="secondary" className="ml-auto">
              {earnedBadges.length}/{ALL_BADGES.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          <div className="flex flex-wrap gap-2">
            <TooltipProvider>
              {ALL_BADGES.map((badge) => {
                const isEarned = earnedBadges.some(b => b.id === badge.id);
                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center text-lg',
                          isEarned 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'bg-muted/50 border border-border/50 grayscale opacity-50'
                        )}
                      >
                        {badge.icon}
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Sub-components
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  bgColor 
}: { 
  icon: typeof Zap; 
  label: string; 
  value: string; 
  color: string; 
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', bgColor)}>
            <Icon className={cn('h-4 w-4', color)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompactScore({ 
  score, 
  levelProgress,
  className 
}: { 
  score: UserScore; 
  levelProgress: number;
  className?: string;
}) {
  return (
    <div className={cn('p-3 rounded-lg bg-muted/30 border border-border/50', className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{score.totalScore} pts</span>
        </div>
        <Badge variant="secondary" className="text-xs">Niv. {score.level}</Badge>
      </div>
      <Progress value={levelProgress} className="h-1.5" />
    </div>
  );
}

function ScoreSkeleton({ compact, className }: { compact: boolean; className?: string }) {
  if (compact) {
    return (
      <div className={cn('p-3 rounded-lg bg-muted/30 border border-border/50', className)}>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-1.5 w-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// Helpers
function calculateLevelProgress(totalScore: number, currentLevel: number): number {
  const currentThreshold = LEVEL_THRESHOLDS[currentLevel - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[currentLevel] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const levelRange = nextThreshold - currentThreshold;
  const progress = totalScore - currentThreshold;
  return Math.min(100, (progress / levelRange) * 100);
}

function formatTimeSaved(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
}
