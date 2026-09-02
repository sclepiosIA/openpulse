import { useMemo } from 'react';
import { useCalendarEvents } from '../calendar/useCalendarEvents';
import { useCalendarAbsences } from '../calendar/useCalendarAbsences';
import { useTeamAvailabilities } from './useAvailabilities';
import {
  addDays,
  addMinutes,
  setHours,
  setMinutes,
  isWeekend,
  isBefore,
  isAfter,
  areIntervalsOverlapping,
  format,
  startOfDay,
  endOfDay,
} from 'date-fns';

export interface AvailableSlot {
  start: Date;
  end: Date;
  score: number; // Higher = better (considers time of day, all participants available, etc.)
}

interface BusyInterval {
  start: Date;
  end: Date;
  userId?: string;
}

interface FindSlotsParams {
  participantUserIds: string[];
  durationMinutes: number;
  searchStartDate: Date;
  searchEndDate: Date;
  workingHoursStart?: number; // 9 = 9:00 AM
  workingHoursEnd?: number; // 18 = 6:00 PM
  includeWeekends?: boolean;
  maxResults?: number;
}

export function useFindAvailableSlots({
  participantUserIds,
  durationMinutes,
  searchStartDate,
  searchEndDate,
  workingHoursStart = 9,
  workingHoursEnd = 18,
  includeWeekends = false,
  maxResults = 10,
}: FindSlotsParams) {
  // Get all calendar events for participants
  const { data: events } = useCalendarEvents({
    startDate: searchStartDate,
    endDate: searchEndDate,
  });

  // Get absences for participants
  const { absences } = useCalendarAbsences(
    format(searchStartDate, 'yyyy-MM-dd'),
    format(searchEndDate, 'yyyy-MM-dd'),
    participantUserIds
  );

  // Get availabilities (blocked time) for participants
  const { data: availabilities } = useTeamAvailabilities(
    participantUserIds,
    searchStartDate.toISOString(),
    searchEndDate.toISOString()
  );

  const availableSlots = useMemo(() => {
    if (participantUserIds.length === 0) return [];

    // Collect all busy intervals
    const busyIntervals: BusyInterval[] = [];

    // Add events as busy
    (events || []).forEach(event => {
      if (event.status !== 'cancelled') {
        busyIntervals.push({
          start: new Date(event.start_time),
          end: new Date(event.end_time),
        });
      }
    });

    // Add absences as busy (all day)
    (absences || []).forEach(absence => {
      busyIntervals.push({
        start: startOfDay(absence.start),
        end: endOfDay(absence.end),
        userId: absence.profile_id,
      });
    });

    // Add personal unavailabilities as busy
    (availabilities || []).forEach(avail => {
      busyIntervals.push({
        start: new Date(avail.start_time),
        end: new Date(avail.end_time),
        userId: avail.user_id,
      });
    });

    // Sort busy intervals by start time
    busyIntervals.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find free slots
    const slots: AvailableSlot[] = [];
    let currentDate = new Date(Math.max(searchStartDate.getTime(), Date.now()));

    while (isBefore(currentDate, searchEndDate) && slots.length < maxResults * 3) {
      // Skip weekends if configured
      if (!includeWeekends && isWeekend(currentDate)) {
        currentDate = addDays(currentDate, 1);
        currentDate = setHours(setMinutes(currentDate, 0), workingHoursStart);
        continue;
      }

      // Set to working hours start if before
      const dayStart = setHours(setMinutes(startOfDay(currentDate), 0), workingHoursStart);
      const dayEnd = setHours(setMinutes(startOfDay(currentDate), 0), workingHoursEnd);

      if (isBefore(currentDate, dayStart)) {
        currentDate = dayStart;
      }

      // If after working hours, move to next day
      if (isAfter(currentDate, dayEnd) || currentDate.getHours() >= workingHoursEnd) {
        currentDate = addDays(currentDate, 1);
        currentDate = setHours(setMinutes(currentDate, 0), workingHoursStart);
        continue;
      }

      // Check if this slot is free
      const slotEnd = addMinutes(currentDate, durationMinutes);

      // Don't go past working hours
      if (isAfter(slotEnd, dayEnd)) {
        currentDate = addDays(currentDate, 1);
        currentDate = setHours(setMinutes(currentDate, 0), workingHoursStart);
        continue;
      }

      const slotInterval = { start: currentDate, end: slotEnd };

      const hasConflict = busyIntervals.some(busy =>
        areIntervalsOverlapping(slotInterval, busy, { inclusive: false })
      );

      if (!hasConflict) {
        // Calculate score (prefer mid-morning and early afternoon)
        const hour = currentDate.getHours();
        let score = 100;
        
        // Prefer 10-12 and 14-16
        if (hour >= 10 && hour <= 11) score += 20;
        else if (hour >= 14 && hour <= 15) score += 15;
        else if (hour === 9) score += 10;
        else if (hour >= 16) score -= 10;

        // Prefer earlier dates
        const daysFromNow = Math.floor((currentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        score -= daysFromNow * 2;

        slots.push({
          start: new Date(currentDate),
          end: new Date(slotEnd),
          score,
        });

        // Move to end of this slot
        currentDate = slotEnd;
      } else {
        // Move forward by 30 minutes
        currentDate = addMinutes(currentDate, 30);
      }
    }

    // Sort by score and return top results
    return slots
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }, [
    participantUserIds,
    durationMinutes,
    searchStartDate,
    searchEndDate,
    workingHoursStart,
    workingHoursEnd,
    includeWeekends,
    maxResults,
    events,
    absences,
    availabilities,
  ]);

  return {
    slots: availableSlots,
    isLoading: false,
  };
}
