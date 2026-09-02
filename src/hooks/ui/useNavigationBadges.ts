import { useMemo } from 'react';
import { useEmailCounts } from '../email/useEmailCounts';
import { usePulseTotalUnread } from '../pulse/usePulseUnreadCount';
import { useTodosUnreadCount } from '../tasks/useTodosUnreadCount';
import { useCalendarTodayCount } from '../calendar/useCalendarTodayCount';
import { useCurrentPWAApp } from '../system/useCurrentPWAApp';
import { useSupportOpenCount } from '../support/useSupportOpenCount';
import { useMissedCallsCount } from '../voice/useMissedCallsCount';
import { usePendingBookingsCount } from '../bookings/usePendingBookingsCount';
import { useRDOpenTasksCount } from '../rd/useRDOpenTasksCount';

/**
 * Interface pour les badges de navigation
 */
export interface NavigationBadges {
  emails: number;
  pulse: number;
  todos: number;
  calendar: number; // Événements du jour à venir
  support: number;
  calls: number;
  bookings: number;
  rd: number;
  total: number;
}

/**
 * Hook centralisé pour récupérer tous les compteurs de badges
 * utilisés dans la navigation (sidebar) et pour le badge PWA
 */
export function useNavigationBadges(): NavigationBadges {
  const { unreadCount: emails } = useEmailCounts();
  const pulse = usePulseTotalUnread();
  const todos = useTodosUnreadCount();
  const calendar = useCalendarTodayCount();
  const support = useSupportOpenCount();
  const calls = useMissedCallsCount();
  const bookings = usePendingBookingsCount();
  const rd = useRDOpenTasksCount();

  return useMemo(() => ({
    emails,
    pulse,
    todos,
    calendar,
    support,
    calls,
    bookings,
    rd,
    total: emails + pulse + todos + calendar + support + calls + bookings + rd,
  }), [emails, pulse, todos, calendar, support, calls, bookings, rd]);
}

/**
 * Hook pour obtenir le badge approprié pour la PWA courante
 * Retourne le compteur spécifique à l'app si on est dans une PWA dédiée,
 * sinon retourne le total
 * 
 * @returns Le nombre à afficher sur le badge PWA
 */
export function usePWABadgeCount(): number {
  const badges = useNavigationBadges();
  const currentApp = useCurrentPWAApp();
  
  return useMemo(() => {
    switch (currentApp) {
      case 'mail':
        return badges.emails;
      case 'pulse':
        return badges.pulse;
      case 'todos':
        return badges.todos;
      case 'calendar':
        return badges.calendar;
      case 'main':
      default:
        // App principale : afficher le total
        return badges.total;
    }
  }, [currentApp, badges]);
}

/**
 * Type pour les clés de badge dans la navigation
 */
export type BadgeKey = 'emailsUnread' | 'pulseUnread' | 'todosCount' | 'calendarEvents';

/**
 * Hook pour résoudre un badge par sa clé
 * Utilisé par AppSidebar pour afficher les badges dynamiques
 */
export function useBadgeByKey(badgeKey?: string): number | undefined {
  const badges = useNavigationBadges();
  
  if (!badgeKey) return undefined;
  
  const badgeMap: Record<string, number> = {
    pulseUnread: badges.pulse,
    emailsUnread: badges.emails,
    todosCount: badges.todos,
    calendarEvents: badges.calendar,
    supportTickets: badges.support,
    missedCalls: badges.calls,
    pendingBookings: badges.bookings,
    rdOpenTasks: badges.rd,
  };
  
  const count = badgeMap[badgeKey];
  return count > 0 ? count : undefined;
}
