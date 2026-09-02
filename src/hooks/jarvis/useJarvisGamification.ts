/**
 * JARVIS 12.0 - Hook pour la gamification
 * 
 * Gère les scores, badges et progression de l'utilisateur.
 * Intègre les événements pour incrémenter automatiquement les compteurs.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/shared/useAuth';
import { debug } from '@/lib/debug';
import { toast } from 'sonner';

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
  badges: string[];
}

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (score: UserScore) => boolean;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Premier jour avec Jarvis',
    icon: '🌟',
    condition: () => true, // Granted on first use
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: '50 tâches auto-complétées',
    icon: '🚀',
    condition: (score) => score.tasksAutoCompleted >= 50,
  },
  {
    id: 'email_ninja',
    name: 'Email Ninja',
    description: '100 emails traités par IA',
    icon: '📧',
    condition: (score) => score.emailsProcessed >= 100,
  },
  {
    id: 'time_saver',
    name: 'Time Saver',
    description: '10 heures économisées',
    icon: '⏰',
    condition: (score) => score.timeSavedMinutes >= 600,
  },
  {
    id: 'streak_warrior',
    name: 'Streak Warrior',
    description: '7 jours consécutifs',
    icon: '🔥',
    condition: (score) => score.currentStreakDays >= 7,
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: '95% suggestions acceptées',
    icon: '✨',
    condition: (score) => {
      const total = score.suggestionsAccepted + score.suggestionsRejected;
      return total >= 20 && (score.suggestionsAccepted / total) >= 0.95;
    },
  },
  {
    id: 'power_user',
    name: 'Power User',
    description: 'Niveau 5 atteint',
    icon: '💪',
    condition: (score) => score.level >= 5,
  },
];

export function useJarvisGamification() {
  const { user } = useAuth();
  const [score, setScore] = useState<UserScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current score
  const fetchScore = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('jarvis_user_scores')
        .select('user_id, total_score, weekly_score, monthly_score, level, experience_points, time_saved_minutes, tasks_auto_completed, emails_processed, suggestions_accepted, suggestions_rejected, current_streak_days, longest_streak_days, badges, challenges_completed, created_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
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
          badges: Array.isArray(data.badges) ? (data.badges as unknown as { id: string }[]).map(b => b.id) : [],
        });
      } else {
        // Initialize score for new user
        await initializeScore();
      }
    } catch (error) {
      debug.error('Error fetching score:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Initialize score for new user
  const initializeScore = async () => {
    if (!user?.id) return;

    const initialScore = {
      user_id: user.id,
      total_score: 10,
      weekly_score: 10,
      level: 1,
      experience_points: 10,
      badges: [{ id: 'early_adopter', earnedAt: new Date().toISOString() }],
    };

    try {
      const { error } = await supabase
        .from('jarvis_user_scores')
        .insert(initialScore);

      if (!error) {
        toast.success('🌟 Badge débloqué: Early Adopter!');
        setScore({
          totalScore: 10,
          weeklyScore: 10,
          level: 1,
          experiencePoints: 10,
          timeSavedMinutes: 0,
          tasksAutoCompleted: 0,
          emailsProcessed: 0,
          suggestionsAccepted: 0,
          suggestionsRejected: 0,
          currentStreakDays: 1,
          badges: ['early_adopter'],
        });
      }
    } catch (error) {
      debug.error('Error initializing score:', error);
    }
  };

  // Increment a specific metric
  const incrementMetric = useCallback(async (
    metric: 'time_saved' | 'task_completed' | 'email_processed' | 'suggestion_accepted' | 'suggestion_rejected',
    value: number = 1
  ) => {
    if (!user?.id) return;

    try {
      await supabase.rpc('increment_jarvis_score', {
        p_user_id: user.id,
        p_score_type: metric,
        p_value: value,
      });

      // Refresh score
      await fetchScore();

      // Check for new badges
      if (score) {
        checkNewBadges(score);
      }
    } catch (error) {
      debug.error('Error incrementing metric:', error);
    }
  }, [user?.id, score, fetchScore]);

  // Track time saved
  const trackTimeSaved = useCallback((minutes: number) => {
    incrementMetric('time_saved', minutes);
  }, [incrementMetric]);

  // Track task auto-completed
  const trackTaskCompleted = useCallback(() => {
    incrementMetric('task_completed', 1);
  }, [incrementMetric]);

  // Track email processed
  const trackEmailProcessed = useCallback(() => {
    incrementMetric('email_processed', 1);
  }, [incrementMetric]);

  // Track suggestion response
  const trackSuggestionResponse = useCallback((accepted: boolean) => {
    incrementMetric(accepted ? 'suggestion_accepted' : 'suggestion_rejected', 1);
  }, [incrementMetric]);

  // Check for new badges
  const checkNewBadges = useCallback(async (currentScore: UserScore) => {
    const newBadges: string[] = [];

    for (const badge of BADGE_DEFINITIONS) {
      if (!currentScore.badges.includes(badge.id) && badge.condition(currentScore)) {
        newBadges.push(badge.id);
      }
    }

    if (newBadges.length > 0 && user?.id) {
      // Update badges in database
      const updatedBadges = [
        ...currentScore.badges.map(id => ({ id, earnedAt: null })),
        ...newBadges.map(id => ({ id, earnedAt: new Date().toISOString() })),
      ];

      await supabase
        .from('jarvis_user_scores')
        .update({ badges: updatedBadges })
        .eq('user_id', user.id);

      // Show notifications
      newBadges.forEach(badgeId => {
        const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
        if (badge) {
          toast.success(`${badge.icon} Badge débloqué: ${badge.name}!`, {
            description: badge.description,
          });
        }
      });

      // Refresh score
      await fetchScore();
    }
  }, [user?.id, fetchScore]);

  // Calculate level from total score
  const calculateLevel = useCallback((totalScore: number): number => {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5000];
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (totalScore >= thresholds[i]) {
        return i + 1;
      }
    }
    return 1;
  }, []);

  // Get earned badges with details
  const getEarnedBadges = useCallback(() => {
    if (!score) return [];
    return BADGE_DEFINITIONS.filter(badge => score.badges.includes(badge.id));
  }, [score]);

  // Get available badges (not yet earned)
  const getAvailableBadges = useCallback(() => {
    if (!score) return BADGE_DEFINITIONS;
    return BADGE_DEFINITIONS.filter(badge => !score.badges.includes(badge.id));
  }, [score]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  return {
    score,
    isLoading,
    trackTimeSaved,
    trackTaskCompleted,
    trackEmailProcessed,
    trackSuggestionResponse,
    getEarnedBadges,
    getAvailableBadges,
    refreshScore: fetchScore,
    // V12.0 - Direct score addition for challenges
    addScore: async (points: number, reason?: string) => {
      if (!user?.id) return;
      try {
        await supabase.rpc('increment_jarvis_score', {
          p_user_id: user.id,
          p_score_type: 'challenge_completed',
          p_value: points,
        });
        await fetchScore();
        if (reason) {
          toast.success(`+${points} points!`, { description: reason });
        }
      } catch (error) {
        debug.error('Error adding score:', error);
      }
    },
  };
}
