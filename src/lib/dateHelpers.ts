/**
 * @deprecated Use imports from '@/lib/dateUtils' instead.
 * This file re-exports from dateUtils for backward compatibility.
 */
export {
  isToday,
  isPast,
  isFuture,
  addDays,
  differenceInDaysAbs,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  formatRelativeTime,
  isWeekend,
  getBusinessDays,
  parseISODate,
  getQuarter,
} from './dateUtils';
