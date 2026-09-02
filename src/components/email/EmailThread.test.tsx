import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { EmailThread } from './EmailThread'

const {
  THREAD_ID,
  USER,
  TOAST_FN,
  SONNER_SUCCESS,
  SONNER_ERROR,
  NAVIGATE_FN,
  ARCHIVE_THREAD_FN,
  MARK_SPAM_FN,
  MARK_READ_FN,
  UPDATE_TAGS_FN,
  FORWARD_EMAIL_FN,
  HANDLE_ERROR_FN,
  KEYBOARD_CONFIGS,
  SCROLL_INTO_VIEW,
  THREAD_DATA,
  ERROR_OBJECT,
  SANITIZED_RESULT,
  GROUPE_INFO,
  ETABLISSEMENTS,
  mockFrom,
  mockInvoke,
  builderState,
} = vi.hoisted(() => {
  const THREAD_ID_VALUE = 'thread-1'
  const USER_VALUE = {
    user: { id: 'u1', email: 'user@test.co' },
    session: { user: { id: 'u1', email: 'user@test.co' } },
    isLoading: false,
  }

  const toastFn = vi.fn()
  const sonnerSuccess = vi.fn()
  const sonnerError = vi.fn()
  const navigateFn = vi.fn()
  const archiveThreadFn = vi.fn().mockResolvedValue({ data: null, error: null })
  const markSpamFn = vi.fn().mockResolvedValue({ data: null, error: null })
  const markReadFn = vi.fn().mockResolvedValue({ data: null, error: null })
  const updateTagsFn = vi.fn().mockResolvedValue({ data: null, error: null })
  const forwardEmailFn = vi.fn().mockResolvedValue({ data: null, error: null })
  const handleErrorFn = vi.fn()
  const keyboardConfigs: Array<Record<string, unknown>> = []
  const scrollIntoView = vi.fn()

  const threadData = {
    id: THREAD_ID_VALUE,
    subject: 'Sujet conversation',
    ai_generated_title: 'Titre IA',
    ai_summary: 'Résumé IA',
    category: 'support',
    priority: 'high',
    tags: ['urgent', 'client'],
    is_archived: false,
    is_spam: false,
    account: { email_address: 'account@test.co' },
    etablissement: { id: 'e1', nom: 'Clinic One' },
    partenaire: null,
    messages: [
      {
        id: 'm1',
        message_id: 'msg-1',
        subject: 'Old subject',
        from_name: 'Alice',
        from_address: 'alice@test.co',
        to_addresses: ['user@test.co'],
        cc_addresses: ['cc@test.co'],
        bcc_addresses: [],
        body_html: '<p>old body</p>',
        body_text: 'old body',
        sent_date: '2024-01-01T10:00:00.000Z',
      },
      {
        id: 'm2',
        message_id: 'msg-2',
        subject: 'Newest subject',
        from_name: 'Bob',
        from_address: 'bob@test.co',
        to_addresses: ['user@test.co'],
        cc_addresses: [],
        bcc_addresses: [],
        body_html: '<p>new body</p>',
        body_text: 'new body',
        sent_date: '2024-01-02T10:00:00.000Z',
      },
    ],
  }

  const errorObject = { message: 'x' }

  const sanitizedResult = {
    subject: 'Sujet nettoyé',
    from_name: 'Expéditeur nettoyé',
    body_html: '<p>HTML nettoyé</p>',
    body_text: 'Texte nettoyé',
    encodingWasCorrected: true,
  }

  const groupeInfo = {
    hasMultipleEtablissementsInGroupe: false,
    groupeId: null,
    groupeNom: null,
  }

  const etablissements = [{ id: 'et1', nom: 'Etab 1' }]

  const builderState = {
    response: { data: threadData, error: null as null | { message: string } },
  }

  const createBuilder = () => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      upsert: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve(builderState.response)),
      maybeSingle: vi.fn(() => Promise.resolve(builderState.response)),
      then: (onFulfilled: (value: typeof builderState.response) => unknown) =>
        Promise.resolve(builderState.response).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve(builderState.response).catch(onRejected),
    }
    return builder
  }

  const fromFn = vi.fn(() => createBuilder())
  const invokeFn = vi.fn().mockResolvedValue({ data: {}, error: null })

  return {
    THREAD_ID: THREAD_ID_VALUE,
    USER: USER_VALUE,
    TOAST_FN: toastFn,
    SONNER_SUCCESS: sonnerSuccess,
    SONNER_ERROR: sonnerError,
    NAVIGATE_FN: navigateFn,
    ARCHIVE_THREAD_FN: archiveThreadFn,
    MARK_SPAM_FN: markSpamFn,
    MARK_READ_FN: markReadFn,
    UPDATE_TAGS_FN: updateTagsFn,
    FORWARD_EMAIL_FN: forwardEmailFn,
    HANDLE_ERROR_FN: handleErrorFn,
    KEYBOARD_CONFIGS: keyboardConfigs,
    SCROLL_INTO_VIEW: scrollIntoView,
    THREAD_DATA: threadData,
    ERROR_OBJECT: errorObject,
    SANITIZED_RESULT: sanitizedResult,
    GROUPE_INFO: groupeInfo,
    ETABLISSEMENTS: etablissements,
    mockFrom: fromFn,
    mockInvoke: invokeFn,
    builderState,
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: mockInvoke,
    },
  },
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    variant?: string
    className?: string
  }) => (
    <button data-variant={variant} className={className} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => <div data-testid="progress">{value ?? 0}</div>,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => (
    <svg data-testid="icon" className={className} />
  )
  return {
    ArrowLeft: Icon,
    Loader2: Icon,
    Reply: Icon,
    ReplyAll: Icon,
    Forward: Icon,
    ChevronsUpDown: Icon,
    Keyboard: Icon,
  }
})

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: TOAST_FN }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (error: { message?: string }) =>
    `sanitized:${error?.message ?? 'unknown'}`,
}))

vi.mock('sonner', () => ({
  toast: {
    success: SONNER_SUCCESS,
    error: SONNER_ERROR,
  },
}))

vi.mock('./EmailReply', () => ({
  EmailReply: () => <div data-testid="email-reply">reply</div>,
}))

vi.mock('./UnifiedEmailContextCard', () => ({
  UnifiedEmailContextCard: ({
    threadTitle,
    senderEmail,
  }: {
    threadTitle?: string
    senderEmail?: string
  }) => (
    <div data-testid="unified-context-card">
      <span>{threadTitle}</span>
      <span>{senderEmail}</span>
    </div>
  ),
}))

vi.mock('./EmailReplyAll', () => ({
  EmailReplyAll: () => <div data-testid="email-reply-all">reply-all</div>,
}))

vi.mock('./EmailForwardDialog', () => ({
  EmailForwardDialog: () => <div data-testid="email-forward-dialog">forward</div>,
}))

vi.mock('./AIProgressIndicator', () => ({
  AIProgressIndicator: ({ operationType }: { operationType: string }) => (
    <div data-testid="ai-progress">{operationType}</div>
  ),
}))

vi.mock('./EmailKeyboardShortcutsDialog', () => ({
  EmailKeyboardShortcutsDialog: () => <div data-testid="shortcuts-dialog">shortcuts</div>,
}))

vi.mock('./AssignThreadDialog', () => ({
  AssignThreadDialog: () => <div data-testid="assign-thread-dialog">assign</div>,
}))

vi.mock('./MobileThreadHeader', () => ({
  MobileThreadHeader: () => <div data-testid="mobile-thread-header">mobile-header</div>,
}))

vi.mock('./EmailThreadGroupeCard', () => ({
  EmailThreadGroupeCard: () => <div data-testid="groupe-card">groupe</div>,
}))

vi.mock('./MobileEstablishmentCard', () => ({
  MobileEstablishmentCard: () => (
    <div data-testid="mobile-establishment-card">mobile-etablissement</div>
  ),
}))

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}))

vi.mock('@/hooks/email/useEmailThreadActions', () => ({
  useEmailThreadActions: () => ({
    archiveThread: ARCHIVE_THREAD_FN,
    isArchiving: false,
    markAsSpam: MARK_SPAM_FN,
    isMarkingSpam: false,
    markAsRead: MARK_READ_FN,
    updateTags: UPDATE_TAGS_FN,
    isUpdatingTags: false,
    forwardEmail: FORWARD_EMAIL_FN,
    isForwarding: false,
  }),
}))

vi.mock('@/lib/emailUtils', () => ({
  getAllThreadParticipants: vi.fn(() => ['alice@test.co', 'bob@test.co']),
  sanitizeAllEmailFields: vi.fn(() => SANITIZED_RESULT),
}))

vi.mock('@/hooks/email/useThreadGroupeParticipants', () => ({
  useThreadGroupeParticipants: () => GROUPE_INFO,
}))

vi.mock('@/hooks/crm/useGroupeEtablissements', () => ({
  useGroupeEtablissements: () => ({ data: ETABLISSEMENTS }),
}))

vi.mock('@/hooks/shared/useErrorHandler', () => ({
  useErrorHandler: () => ({ handleError: HANDLE_ERROR_FN }),
}))

vi.mock('@/hooks/email/useEmailThreadKeyboard', () => ({
  useEmailThreadKeyboard: (config: Record<string, unknown>) => {
    KEYBOARD_CONFIGS.push(config)
  },
}))

vi.mock('@/lib/debug', () => ({
  debug: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => USER,
}))

vi.mock('./EmailThread.types', () => ({
  EMAIL_THREAD_DETAIL_SELECT: 'id,subject,messages(*)',
}))

vi.mock('./EmailThreadStickyHeader', () => ({
  EmailThreadStickyHeader: ({
    sanitizedMessagesCount,
    onArchiveToggle,
    onProcessAI,
    onReply,
    onReplyAll,
    onForward,
    onExpandAll,
    onCollapseAll,
    onShowShortcuts,
  }: {
    sanitizedMessagesCount: number
    onArchiveToggle: () => void
    onProcessAI: () => void
    onReply: () => void
    onReplyAll: () => void
    onForward: () => void
    onExpandAll: () => void
    onCollapseAll: () => void
    onShowShortcuts: () => void
  }) => (
    <div data-testid="sticky-header">
      <span>messages:{sanitizedMessagesCount}</span>
      <button onClick={onArchiveToggle}>archive-toggle</button>
      <button onClick={onProcessAI}>process-ai</button>
      <button onClick={onReply}>reply-open</button>
      <button onClick={onReplyAll}>replyall-open</button>
      <button onClick={onForward}>forward-open</button>
      <button onClick={onExpandAll}>expand-all</button>
      <button onClick={onCollapseAll}>collapse-all</button>
      <button onClick={onShowShortcuts}>show-shortcuts</button>
    </div>
  ),
}))

vi.mock('./EmailThreadMessageItem', () => ({
  EmailThreadMessageItem: ({
    message,
  }: {
    message: { id: string; subject?: string; from_name?: string }
  }) => (
    <div data-testid={`message-item-${message.id}`}>
      {message.subject ?? message.from_name ?? message.id}
    </div>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog">{children}</div>
  ),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => NAVIGATE_FN,
  }
})

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('EmailThread', () => {
  beforeEach(() => {
    builderState.response = { data: THREAD_DATA, error: null }
    mockFrom.mockClear()
    mockInvoke.mockClear()
    TOAST_FN.mockClear()
    SONNER_SUCCESS.mockClear()
    SONNER_ERROR.mockClear()
    NAVIGATE_FN.mockClear()
    ARCHIVE_THREAD_FN.mockClear()
    MARK_SPAM_FN.mockClear()
    MARK_READ_FN.mockClear()
    UPDATE_TAGS_FN.mockClear()
    FORWARD_EMAIL_FN.mockClear()
    HANDLE_ERROR_FN.mockClear()
    KEYBOARD_CONFIGS.length = 0
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
    Element.prototype.scrollIntoView = SCROLL_INTO_VIEW
    SCROLL_INTO_VIEW.mockClear()
  })

  it('affiche le loader puis les données métier du thread chargé', async () => {
    render(<EmailThread threadId={THREAD_ID} onBack={vi.fn()} />, { wrapper: createWrapper() })

    expect(screen.getByTestId('icon')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('sticky-header')).toBeInTheDocument()
    })

    expect(mockFrom).toHaveBeenCalledWith('email_threads')
    expect(screen.getByText('messages:2')).toBeInTheDocument()
    expect(screen.getByTestId('unified-context-card')).toHaveTextContent('Titre IA')
    expect(screen.getByTestId('unified-context-card')).toHaveTextContent('bob@test.co')
  })

  it("déclenche l'archivage via le header sticky avec les bonnes valeurs", async () => {
    render(<EmailThread threadId={THREAD_ID} onBack={vi.fn()} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sticky-header')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('archive-toggle'))

    await waitFor(() => {
      expect(ARCHIVE_THREAD_FN).toHaveBeenCalledWith({
        threadId: THREAD_ID,
        archived: true,
      })
    })
  })

  it("traite avec l'IA puis refetch le thread et affiche un toast de succès", async () => {
    render(<EmailThread threadId={THREAD_ID} onBack={vi.fn()} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByTestId('sticky-header')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('process-ai'))

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('process-email-with-ai', {
        body: { thread_id: THREAD_ID },
      })
    })

    await waitFor(() => {
      expect(TOAST_FN).toHaveBeenCalledWith({ title: 'Analyse IA terminée' })
    })

    expect(mockFrom).toHaveBeenCalledTimes(2)
  })

  it("affiche l'état erreur quand la récupération du thread échoue", async () => {
    builderState.response = { data: null, error: ERROR_OBJECT }

    const onBack = vi.fn()
    render(<EmailThread threadId={THREAD_ID} onBack={onBack} />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Conversation introuvable ou inaccessible.')).toBeInTheDocument()
    })

    expect(TOAST_FN).toHaveBeenCalledWith({
      title: 'Impossible de charger la conversation',
      description: 'sanitized:x',
      variant: 'destructive',
    })

    fireEvent.click(screen.getByText('Retour'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
