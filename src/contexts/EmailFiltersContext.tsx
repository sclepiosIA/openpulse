import { createContext, useContext, useState, ReactNode } from 'react';
import { EmailFilters, EmailMailbox } from '@/hooks/email/useEmailFilters';
import { debug } from '@/lib/debug';

interface EmailFiltersContextType {
  globalFilters: EmailFilters;
  updateGlobalFilter: <K extends keyof EmailFilters>(key: K, value: EmailFilters[K]) => void;
  resetGlobalFilters: () => void;
  triggerUnreadFilter: () => void;
}

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

export const EmailFiltersContext = createContext<EmailFiltersContextType | undefined>(undefined);

export function EmailFiltersProvider({ children, initialFilters }: { children: ReactNode; initialFilters?: Partial<EmailFilters> }) {
  const [globalFilters, setGlobalFilters] = useState<EmailFilters>({
    ...defaultFilters,
    ...initialFilters,
    unreadOnly:
      initialFilters?.unreadOnly ??
      (typeof window !== 'undefined' && sessionStorage.getItem('email_open_unread_only') === 'true'),
  });

  if (typeof window !== 'undefined' && sessionStorage.getItem('email_open_unread_only') === 'true') {
    sessionStorage.removeItem('email_open_unread_only');
  }

  const updateGlobalFilter = <K extends keyof EmailFilters>(
    key: K,
    value: EmailFilters[K]
  ) => {
    debug.log('🔄 Global filter updated:', key, value);
    setGlobalFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetGlobalFilters = () => {
    debug.log('🔄 Resetting global filters (preserving entity locks)');
    setGlobalFilters(prev => ({
      ...defaultFilters,
      // Preserve entity-locked filters so reset doesn't break contextual views
      etablissementId: prev.etablissementId,
      groupeId: prev.groupeId,
      partenaireId: prev.partenaireId,
    }));
  };

  const triggerUnreadFilter = () => {
    debug.log('📧 Triggering unread-only filter from context');
    setGlobalFilters(prev => ({ ...prev, unreadOnly: true }));
  };

  return (
    <EmailFiltersContext.Provider value={{ 
      globalFilters, 
      updateGlobalFilter, 
      resetGlobalFilters,
      triggerUnreadFilter 
    }}>
      {children}
    </EmailFiltersContext.Provider>
  );
}

export function useEmailFiltersContext() {
  const context = useContext(EmailFiltersContext);
  if (context === undefined) {
    throw new Error('useEmailFiltersContext must be used within EmailFiltersProvider');
  }
  return context;
}
