import { useQuery } from '@tanstack/react-query';
import { subDays, eachDayOfInterval, format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import type { RDUserStory, RDSprint } from '@/types/rd';

interface BurndownDataPoint {
  date: string;
  ideal: number;
  actual: number;
  remaining: number;
}

interface CFDDataPoint {
  date: string;
  backlog: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}

export function useSprintBurndown(sprint: RDSprint | null | undefined, stories: RDUserStory[] | undefined) {
  return useQuery({
    queryKey: ['sprint-burndown', sprint?.id],
    queryFn: async (): Promise<BurndownDataPoint[]> => {
      if (!sprint || !stories) return [];

      const startDate = parseISO(sprint.date_debut);
      const endDate = parseISO(sprint.date_fin);
      const today = startOfDay(new Date());

      // Calculate total points
      const totalPoints = stories.reduce((sum, s) => sum + (s.points || 0), 0);
      if (totalPoints === 0) return [];

      // Generate all days in sprint
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const totalDays = days.length;

      // Calculate ideal burndown
      const idealPointsPerDay = totalPoints / (totalDays - 1);

      // For actual burndown, we simulate based on current done stories
      // In a real implementation, you'd have a history table tracking points completed per day
      const donePoints = stories
        .filter(s => s.statut === 'done')
        .reduce((sum, s) => sum + (s.points || 0), 0);

      const remainingPoints = totalPoints - donePoints;

      return days.map((day, index) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const idealRemaining = Math.max(0, totalPoints - (idealPointsPerDay * index));
        
        // For past days, show actual; for future, show projection
        let actualRemaining: number;
        if (isAfter(day, today)) {
          // Future: no data
          actualRemaining = remainingPoints; // Keep at current for projection
        } else if (format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
          actualRemaining = remainingPoints;
        } else {
          // Past: interpolate (simplified - in real app, use history)
          const progress = index / Math.max(1, days.findIndex(d => format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')));
          actualRemaining = Math.max(0, totalPoints - (donePoints * Math.min(1, progress)));
        }

        return {
          date: format(day, 'dd/MM'),
          ideal: Math.round(idealRemaining * 10) / 10,
          actual: isBefore(day, today) || format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') 
            ? Math.round(actualRemaining * 10) / 10 
            : 0, // Don't show actual for future dates
          remaining: Math.round(actualRemaining * 10) / 10,
        };
      });
    },
    enabled: !!sprint && !!stories,
  });
}

export function useCumulativeFlowData(projetId: string | undefined, stories: RDUserStory[] | undefined) {
  return useQuery({
    queryKey: ['cfd-data', projetId],
    queryFn: async (): Promise<CFDDataPoint[]> => {
      if (!stories || stories.length === 0) return [];

      // Get the last 14 days
      const days = eachDayOfInterval({
        start: subDays(new Date(), 13),
        end: new Date(),
      });

      // Count current stories by status
      const statusCounts = {
        backlog: stories.filter(s => s.statut === 'backlog').length,
        todo: stories.filter(s => s.statut === 'todo').length,
        in_progress: stories.filter(s => s.statut === 'in_progress').length,
        review: stories.filter(s => s.statut === 'review').length,
        done: stories.filter(s => s.statut === 'done').length,
      };

      const total = stories.length;
      const doneRatio = statusCounts.done / Math.max(1, total);

      // Simulate historical data (in real app, use history table)
      return days.map((day, index) => {
        const progress = index / 13; // 0 to 1 over 14 days
        
        // Simulate gradual progression
        const simulatedDone = Math.round(statusCounts.done * progress);
        const remainingFromDone = statusCounts.done - simulatedDone;
        
        return {
          date: format(day, 'dd/MM'),
          backlog: Math.max(0, statusCounts.backlog + Math.round(remainingFromDone * 0.3)),
          todo: Math.max(0, statusCounts.todo + Math.round(remainingFromDone * 0.25)),
          in_progress: Math.max(0, statusCounts.in_progress + Math.round(remainingFromDone * 0.25)),
          review: Math.max(0, statusCounts.review + Math.round(remainingFromDone * 0.2)),
          done: simulatedDone,
        };
      });
    },
    enabled: !!projetId && !!stories,
  });
}
