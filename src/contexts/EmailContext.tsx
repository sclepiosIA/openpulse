import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { EmailThread, EmailDraft, EmailFilters } from '@/types/email';
import { useVirtualBreadcrumb } from '@/hooks/shared/useVirtualBreadcrumb';

interface EmailContextState {
  // Navigation
  selectedThread: string | null;
  composing: boolean;
  draftToEdit: EmailDraft | null;
  accountId: string;
  
  // Data
  threads: EmailThread[];
  isLoading: boolean;
  
  // Filters
  filters: EmailFilters;
  
  // UI State
  isSyncing: boolean;
}

interface EmailContextActions {
  // Navigation actions
  selectThread: (id: string | null, threadSubject?: string) => void;
  startComposing: () => void;
  editDraft: (draft: EmailDraft | null) => void;
  goBack: () => void;
  
  // Account actions
  changeAccount: (id: string) => void;
  
  // Filter actions
  updateFilters: (filters: Partial<EmailFilters>) => void;
  resetFilters: () => void;
  
  // Data actions
  setThreads: (threads: EmailThread[]) => void;
  setIsLoading: (loading: boolean) => void;
  
  // Sync actions
  setIsSyncing: (syncing: boolean) => void;
  
  // Thread actions
  refreshThreads: () => Promise<void>;
}

interface EmailContextValue {
  state: EmailContextState;
  actions: EmailContextActions;
}

const EmailContext = createContext<EmailContextValue | null>(null);

const initialFilters: EmailFilters = {
  search: '',
  category: null,
  priority: null,
  unreadOnly: false,
  unprocessedOnly: false,
  hasAttachments: false,
  etablissementId: null,
  groupeId: null,
  partenaireId: null,
  dateFrom: null,
  dateTo: null,
  mailbox: 'inbox',
};

interface EmailProviderProps {
  children: ReactNode;
  initialAccountId?: string;
  onRefresh?: () => Promise<void>;
}

export function EmailProvider({ children, initialAccountId = '', onRefresh }: EmailProviderProps) {
  // State
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [draftToEdit, setDraftToEdit] = useState<EmailDraft | null>(null);
  const [accountId, setAccountId] = useState(initialAccountId);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<EmailFilters>(initialFilters);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { pushEntry, popEntry } = useVirtualBreadcrumb();

  // Navigation actions
  const selectThread = useCallback((id: string | null, threadSubject?: string) => {
    if (id && threadSubject) {
      pushEntry(`Email: ${threadSubject}`, () => {
        setSelectedThread(null);
        setComposing(false);
        setDraftToEdit(null);
      }, '/emails');
    } else if (!id) {
      popEntry();
    }
    
    setSelectedThread(id);
    if (id) {
      // Reset composing state when selecting a thread
      setComposing(false);
      setDraftToEdit(null);
    }
  }, [pushEntry, popEntry]);

  const startComposing = useCallback(() => {
    pushEntry('Nouveau message', () => {
      setComposing(false);
      setDraftToEdit(null);
    }, '/emails');
    setComposing(true);
    setSelectedThread(null);
    setDraftToEdit(null);
  }, [pushEntry]);

  const editDraft = useCallback((draft: EmailDraft | null) => {
    if (draft) {
      pushEntry('Modifier brouillon', () => {
        setDraftToEdit(null);
        setComposing(false);
      }, '/emails');
      setComposing(true);
      setSelectedThread(null);
    }
    setDraftToEdit(draft);
  }, [pushEntry]);

  const goBack = useCallback(() => {
    popEntry();
    if (composing) {
      setComposing(false);
      setDraftToEdit(null);
    } else if (selectedThread) {
      setSelectedThread(null);
    }
  }, [composing, selectedThread, popEntry]);

  // Account actions
  const changeAccount = useCallback((id: string) => {
    setAccountId(id);
    sessionStorage.setItem('selected_email_account', id);
    // Reset view when changing account
    setSelectedThread(null);
    setComposing(false);
    setDraftToEdit(null);
  }, []);

  // Filter actions
  const updateFilters = useCallback((newFilters: Partial<EmailFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  // Refresh action
  const refreshThreads = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  const state: EmailContextState = {
    selectedThread,
    composing,
    draftToEdit,
    accountId,
    threads,
    isLoading,
    filters,
    isSyncing,
  };

  const actions: EmailContextActions = {
    selectThread,
    startComposing,
    editDraft,
    goBack,
    changeAccount,
    updateFilters,
    resetFilters,
    setThreads,
    setIsLoading,
    setIsSyncing,
    refreshThreads,
  };

  return (
    <EmailContext.Provider value={{ state, actions }}>
      {children}
    </EmailContext.Provider>
  );
}

export function useEmailContext() {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmailContext must be used within an EmailProvider');
  }
  return context;
}

export function useEmailState() {
  const { state } = useEmailContext();
  return state;
}

export function useEmailActions() {
  const { actions } = useEmailContext();
  return actions;
}
