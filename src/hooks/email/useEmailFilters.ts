import { useState, useEffect, useContext } from "react";
import { EmailFiltersContext } from "@/contexts/EmailFiltersContext";

export type EmailMailbox = 'inbox' | 'sent' | 'trash' | 'all';

export interface EmailFilters {
  search: string;
  category: string | null;
  priority: string | null;
  unreadOnly: boolean;
  unprocessedOnly: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
  etablissementId: string | null;
  groupeId: string | null;
  partenaireId: string | null;
  mailbox: EmailMailbox;
}

export function useEmailFilters(useGlobalContext = false) {
  // ALWAYS call useContext unconditionally to respect Rules of Hooks.
  // Only consume the value when the caller opted into the global context.
  const ctxValue = useContext(EmailFiltersContext);
  const context = useGlobalContext ? ctxValue ?? null : null;

  const [filters, setFilters] = useState<EmailFilters>(
    context?.globalFilters || {
      search: "",
      category: null,
      priority: null,
      unreadOnly: false,
      unprocessedOnly: false,
      dateFrom: null,
      dateTo: null,
      etablissementId: null,
      groupeId: null,
      partenaireId: null,
      mailbox: 'inbox',
    }
  );

  // Sync with global context if enabled
  useEffect(() => {
    if (context?.globalFilters) {
      // Silent sync - no console log to reduce noise
      setFilters(context.globalFilters);
    }
  }, [context?.globalFilters]);

  const updateFilter = <K extends keyof EmailFilters>(
    key: K,
    value: EmailFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    // Also update global context if available
    if (context) {
      context.updateGlobalFilter(key, value);
    }
  };

  const resetFilters = () => {
    const defaultFilters: EmailFilters = {
      search: "",
      category: null,
      priority: null,
      unreadOnly: false,
      unprocessedOnly: false,
      dateFrom: null,
      dateTo: null,
      etablissementId: null,
      groupeId: null,
      partenaireId: null,
      mailbox: 'inbox',
    };
    setFilters(defaultFilters);
    // Also reset global context if available
    if (context) {
      context.resetGlobalFilters();
    }
  };

  return { filters, updateFilter, resetFilters };
}
