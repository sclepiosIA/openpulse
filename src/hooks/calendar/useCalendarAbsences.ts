import { useMemo } from 'react';
import { useRHAbsences } from '../hr/useRHAbsences';
import { parseISO, format, eachDayOfInterval, isSameDay, isWithinInterval } from 'date-fns';

export interface CalendarAbsence {
  id: string;
  title: string;
  profile_id: string;
  profile_name: string;
  profile_email: string;
  start: Date;
  end: Date;
  type: string;
  status: string;
  motif?: string;
  color: string;
  isAllDay: boolean;
}

const ABSENCE_COLORS: Record<string, string> = {
  'Congés payés': '#3B82F6', // blue
  'RTT': '#10B981', // emerald
  'Maladie': '#F59E0B', // amber
  'Formation': '#8B5CF6', // violet
  'Télétravail': '#6366F1', // indigo
  'Autre': '#6B7280', // gray
};

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  'conges_payes': 'Congés payés',
  'rtt': 'RTT',
  'maladie': 'Maladie',
  'formation': 'Formation',
  'teletravail': 'Télétravail',
  'autre': 'Autre',
};

function getAbsenceColor(type: string): string {
  const label = ABSENCE_TYPE_LABELS[type] || type;
  return ABSENCE_COLORS[label] || ABSENCE_COLORS['Autre'];
}

function getAbsenceLabel(type: string): string {
  return ABSENCE_TYPE_LABELS[type] || type;
}

export function useCalendarAbsences(startDate?: string, endDate?: string, profileIds?: string[]) {
  const { absences, isLoading } = useRHAbsences(undefined, startDate, endDate);

  const calendarAbsences = useMemo(() => {
    if (!absences) return [];

    return absences
      .filter(absence => {
        // Filter by profile if specified
        if (profileIds && profileIds.length > 0 && !profileIds.includes(absence.profile_id)) {
          return false;
        }
        // Only show approved absences in calendar
        return absence.statut === 'approuve' || absence.statut === 'validé' || absence.statut === 'approuvé';
      })
      .map(absence => ({
        id: absence.id,
        title: `${getAbsenceLabel(absence.type_absence)} - ${absence.profiles?.prenom || ''} ${absence.profiles?.nom || ''}`,
        profile_id: absence.profile_id,
        profile_name: `${absence.profiles?.prenom || ''} ${absence.profiles?.nom || ''}`.trim(),
        profile_email: absence.profiles?.email || '',
        start: parseISO(absence.date_debut),
        end: parseISO(absence.date_fin),
        type: absence.type_absence,
        status: absence.statut,
        motif: absence.motif,
        color: getAbsenceColor(absence.type_absence),
        isAllDay: true,
      } as CalendarAbsence));
  }, [absences, profileIds]);

  // Get absences for a specific day
  const getAbsencesForDay = (day: Date): CalendarAbsence[] => {
    return calendarAbsences.filter(absence => 
      isWithinInterval(day, { start: absence.start, end: absence.end }) ||
      isSameDay(day, absence.start) ||
      isSameDay(day, absence.end)
    );
  };

  // Get count of absences by day in range
  const absenceCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    
    calendarAbsences.forEach(absence => {
      const days = eachDayOfInterval({ start: absence.start, end: absence.end });
      days.forEach(day => {
        const key = format(day, 'yyyy-MM-dd');
        counts[key] = (counts[key] || 0) + 1;
      });
    });

    return counts;
  }, [calendarAbsences]);

  return {
    absences: calendarAbsences,
    isLoading,
    getAbsencesForDay,
    absenceCountByDay,
    totalCount: calendarAbsences.length,
  };
}
