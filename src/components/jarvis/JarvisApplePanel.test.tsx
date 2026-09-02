import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JarvisApplePanel } from './JarvisApplePanel'

const {
  CURRENT_PROFILE,
  mockUseCurrentProfile,

  mockSubmitMessageFeedback,
  mockUseJarvisFeedback,

  JARVIS_STATE,
  mockChat,
  mockClearChat,
  mockConfirmToolCall,
  mockRejectToolCall,
  mockSetMessages,
  mockUseJarvis,

  PERSIST_STATE,
  mockSaveMessages,
  mockLoadConversation,
  mockCreateConversation,
  mockUseJarvisConversationPersistence,
} = vi.hoisted(() => {
  const CURRENT_PROFILE = { prenom: 'Ada', nom: 'Lovelace' }

  const mockUseCurrentProfile = vi.fn(() => ({ data: CURRENT_PROFILE }))

  const mockSubmitMessageFeedback = vi.fn()
  const mockUseJarvisFeedback = vi.fn(() => ({ submitMessageFeedback: mockSubmitMessageFeedback }))

  const mockChat = vi.fn(async () => undefined)
  const mockClearChat = vi.fn()
  const mockConfirmToolCall = vi.fn(async () => undefined)
  const mockRejectToolCall = vi.fn(async () => undefined)
  const mockSetMessages = vi.fn()

  const JARVIS_STATE: {
    pendingCount: number
    messages: Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      timestamp?: string
      toolCalls?: Array<{
        id: string
        name: string
        status: 'requires_confirmation' | 'confirmed' | 'rejected'
        arguments?: unknown
      }>
    }>
    isTyping: boolean
    isConfirming: boolean
  } = {
    pendingCount: 0,
    messages: [],
    isTyping: false,
    isConfirming: false,
  }

  const mockUseJarvis = vi.fn(() => ({
    pendingCount: JARVIS_STATE.pendingCount,
    messages: JARVIS_STATE.messages,
    setMessages: mockSetMessages,
    isTyping: JARVIS_STATE.isTyping,
    chat: mockChat,
    clearChat: mockClearChat,
    confirmToolCall: mockConfirmToolCall,
    rejectToolCall: mockRejectToolCall,
    isConfirming: JARVIS_STATE.isConfirming,
  }))

  const mockSaveMessages = vi.fn(async () => undefined)
  const mockLoadConversation = vi.fn(async (_id: string) => [])
  const mockCreateConversation = vi.fn(async () => 'c-new')

  const PERSIST_STATE: {
    conversations: Array<{ id: string }>
    currentConversationId: string | null
  } = {
    conversations: [],
    currentConversationId: null,
  }

  const mockUseJarvisConversationPersistence = vi.fn(() => ({
    saveMessages: mockSaveMessages,
    loadConversation: mockLoadConversation,
    conversations: PERSIST_STATE.conversations,
    currentConversationId: PERSIST_STATE.currentConversationId,
    createConversation: mockCreateConversation,
  }))

  return {
    CURRENT_PROFILE,
    mockUseCurrentProfile,

    mockSubmitMessageFeedback,
    mockUseJarvisFeedback,

    JARVIS_STATE,
    mockChat,
    mockClearChat,
    mockConfirmToolCall,
    mockRejectToolCall,
    mockSetMessages,
    mockUseJarvis,

    PERSIST_STATE,
    mockSaveMessages,
    mockLoadConversation,
    mockCreateConversation,
    mockUseJarvisConversationPersistence,
  }
})

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: mockUseCurrentProfile,
}))

vi.mock('@/hooks/jarvis/useJarvisFeedback', () => ({
  useJarvisFeedback: mockUseJarvisFeedback,
}))

vi.mock('@/hooks/jarvis/useJarvis', () => ({
  useJarvis: mockUseJarvis,
}))

vi.mock('@/hooks/jarvis/useJarvisConversationPersistence', () => ({
  useJarvisConversationPersistence: mockUseJarvisConversationPersistence,
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode }>(
    ({ className, children }, ref) => (
      <div ref={ref} className={className} data-testid="scroll-area">
        {children}
      </div>
    )
  ),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}))

vi.mock('./JarvisAppleHeader', () => ({
  JarvisAppleHeader: ({
    pendingCount,
    isTyping,
    onNewConversation,
    onOpenHistory,
    onClose,
  }: {
    pendingCount: number
    isTyping: boolean
    onNewConversation: () => void
    onOpenHistory: () => void
    onClose?: () => void
  }) => (
    <div data-testid="header">
      <div data-testid="pending">{pendingCount}</div>
      <div data-testid="typing">{isTyping ? 'yes' : 'no'}</div>
      <button type="button" onClick={onNewConversation}>
        new
      </button>
      <button type="button" onClick={onOpenHistory}>
        history
      </button>
      <button type="button" onClick={() => onClose?.()}>
        close
      </button>
    </div>
  ),
}))

vi.mock('./JarvisAppleWelcome', () => ({
  JarvisAppleWelcome: ({
    userName,
    onSendMessage,
  }: {
    userName: string
    onSendMessage: (message: string) => void
  }) => (
    <div data-testid="welcome">
      <div data-testid="welcome-name">{userName}</div>
      <button type="button" onClick={() => onSendMessage('hello from welcome')}>
        send-welcome
      </button>
    </div>
  ),
}))

vi.mock('./JarvisAppleInput', () => ({
  JarvisAppleInput: ({
    value,
    onChange,
    onSubmit,
    isLoading,
    placeholder,
  }: {
    value: string
    onChange: (v: string) => void
    onSubmit: () => void
    isLoading: boolean
    placeholder?: string
  }) => (
    <div data-testid="input">
      <div data-testid="input-loading">{isLoading ? 'yes' : 'no'}</div>
      <div data-testid="input-placeholder">{placeholder}</div>
      <div data-testid="input-value">{value}</div>
      <button type="button" onClick={() => onChange('Salut Jarvis')}>
        change
      </button>
      <button type="button" onClick={onSubmit}>
        submit
      </button>
    </div>
  ),
}))

vi.mock('./JarvisAppleMessage', () => ({
  JarvisAppleMessage: ({
    role,
    content,
    onFeedback,
    onRegenerate,
  }: {
    role: 'user' | 'assistant'
    content: string
    timestamp?: string
    onFeedback: (type: 'up' | 'down') => void
    onRegenerate?: () => void
  }) => (
    <div data-testid="message">
      <div data-testid="message-role">{role}</div>
      <div data-testid="message-content">{content}</div>
      <button type="button" onClick={() => onFeedback('up')}>
        fb-up
      </button>
      {onRegenerate ? (
        <button type="button" onClick={onRegenerate}>
          regen
        </button>
      ) : null}
    </div>
  ),
}))

vi.mock('./JarvisAppleThinking', () => ({
  JarvisAppleThinking: () => <div data-testid="thinking">thinking</div>,
}))

vi.mock('./JarvisHistorySheet', () => ({
  JarvisHistorySheet: ({
    open,
    onOpenChange,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }) => (
    <div data-testid="history-sheet">
      <div data-testid="history-open">{open ? 'yes' : 'no'}</div>
      <button type="button" onClick={() => onOpenChange(false)}>
        close-history
      </button>
    </div>
  ),
}))

vi.mock('./JarvisEmailPreview', () => ({
  JarvisEmailPreview: ({
    emailData,
    onConfirm,
    onCancel,
    isConfirming,
  }: {
    emailData: { to: string; subject?: string; body: string; cc?: string[]; thread_id?: string }
    onConfirm: () => void
    onCancel: () => void
    isConfirming: boolean
  }) => (
    <div data-testid="email-preview">
      <div data-testid="email-to">{emailData.to}</div>
      <div data-testid="email-body">{emailData.body}</div>
      <div data-testid="email-confirming">{isConfirming ? 'yes' : 'no'}</div>
      <button type="button" onClick={onConfirm}>
        confirm-email
      </button>
      <button type="button" onClick={onCancel}>
        cancel-email
      </button>
    </div>
  ),
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createTestQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  mockUseCurrentProfile.mockClear()
  mockUseJarvisFeedback.mockClear()
  mockUseJarvis.mockClear()
  mockUseJarvisConversationPersistence.mockClear()

  mockSubmitMessageFeedback.mockClear()
  mockChat.mockClear()
  mockClearChat.mockClear()
  mockConfirmToolCall.mockClear()
  mockRejectToolCall.mockClear()
  mockSetMessages.mockClear()

  mockSaveMessages.mockClear()
  mockLoadConversation.mockClear()
  mockCreateConversation.mockClear()

  JARVIS_STATE.pendingCount = 0
  JARVIS_STATE.messages = []
  JARVIS_STATE.isTyping = false
  JARVIS_STATE.isConfirming = false

  PERSIST_STATE.conversations = []
  PERSIST_STATE.currentConversationId = null

  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  cleanup()
})

describe('JarvisApplePanel', () => {
  it('affiche le chargement (isTyping) quand aucun message', async () => {
    JARVIS_STATE.isTyping = true

    renderWithClient(<JarvisApplePanel />)

    expect(screen.getByTestId('thinking').textContent).toBe('thinking')
    expect(screen.queryByTestId('welcome')).toBeNull()
    expect(screen.getByTestId('input-loading').textContent).toBe('yes')
  })

  it('succès: affiche le welcome avec le prénom et envoie un message via onSendMessage', async () => {
    JARVIS_STATE.isTyping = false
    JARVIS_STATE.messages = []

    renderWithClient(<JarvisApplePanel />)

    expect(screen.getByTestId('welcome')).toBeTruthy()
    expect(screen.getByTestId('welcome-name').textContent).toBe('Ada')

    await act(async () => {
      screen.getByText('send-welcome').click()
    })

    expect(mockChat).toHaveBeenCalledTimes(1)
    expect(mockChat).toHaveBeenCalledWith('hello from welcome')
  })

  it('erreur: submit (sans valeur) ne déclenche pas chat, puis submit avec valeur appelle chat', async () => {
    JARVIS_STATE.messages = []
    JARVIS_STATE.isTyping = false

    renderWithClient(<JarvisApplePanel />)

    await act(async () => {
      screen.getByText('submit').click()
    })
    expect(mockChat).toHaveBeenCalledTimes(0)

    await act(async () => {
      screen.getByText('change').click()
    })
    await act(async () => {
      screen.getByText('submit').click()
    })

    expect(mockChat).toHaveBeenCalledTimes(1)
    expect(mockChat).toHaveBeenCalledWith('Salut Jarvis')
  })

  it('affiche une liste de messages, envoie un feedback et régénère une réponse assistant', async () => {
    JARVIS_STATE.isTyping = false
    JARVIS_STATE.messages = [
      { id: 'm1', role: 'user', content: 'Question', timestamp: 't1' },
      { id: 'm2', role: 'assistant', content: 'Réponse', timestamp: 't2' },
    ]

    renderWithClient(<JarvisApplePanel />)

    const contents = screen.getAllByTestId('message-content').map((n) => n.textContent)
    expect(contents).toEqual(['Question', 'Réponse'])

    await act(async () => {
      screen.getAllByText('fb-up')[1].click()
    })
    expect(mockSubmitMessageFeedback).toHaveBeenCalledTimes(1)
    expect(mockSubmitMessageFeedback).toHaveBeenCalledWith('m2', 'up')

    await act(async () => {
      screen.getByText('regen').click()
    })
    expect(mockChat).toHaveBeenCalledTimes(1)
    expect(mockChat).toHaveBeenCalledWith('Question')
  })

  it('affiche un aperçu email et confirme/annule un tool call', async () => {
    JARVIS_STATE.isTyping = false
    JARVIS_STATE.isConfirming = true
    JARVIS_STATE.messages = [
      {
        id: 'm1',
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'tc1',
            name: 'send_email',
            status: 'requires_confirmation',
            arguments: { to: 'a@b.co', body: 'Bonjour' },
          },
        ],
      },
    ]

    renderWithClient(<JarvisApplePanel />)

    expect(screen.getByTestId('email-preview')).toBeTruthy()
    expect(screen.getByTestId('email-to').textContent).toBe('a@b.co')
    expect(screen.getByTestId('email-body').textContent).toBe('Bonjour')
    expect(screen.getByTestId('email-confirming').textContent).toBe('yes')

    await act(async () => {
      screen.getByText('confirm-email').click()
    })
    expect(mockConfirmToolCall).toHaveBeenCalledTimes(1)
    expect(mockConfirmToolCall).toHaveBeenCalledWith('tc1')

    await act(async () => {
      screen.getByText('cancel-email').click()
    })
    expect(mockRejectToolCall).toHaveBeenCalledTimes(1)
    expect(mockRejectToolCall).toHaveBeenCalledWith('tc1')
  })

  it('auto-charge la conversation la plus récente au mount (conversations[0]) et hydrate les messages', async () => {
    PERSIST_STATE.conversations = [{ id: 'c1' }]
    const loaded = [{ id: 'lm1', role: 'user' as const, content: 'Loaded' }]
    mockLoadConversation.mockResolvedValueOnce(loaded)

    renderWithClient(<JarvisApplePanel />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockLoadConversation).toHaveBeenCalledTimes(1)
    expect(mockLoadConversation).toHaveBeenCalledWith('c1')
    expect(mockSetMessages).toHaveBeenCalledTimes(1)
    expect(mockSetMessages).toHaveBeenCalledWith(loaded)
  })

  it('auto-save: crée une conversation si aucune, puis saveMessages après 1000ms', async () => {
    PERSIST_STATE.currentConversationId = null
    JARVIS_STATE.messages = [{ id: 'm1', role: 'user' as const, content: 'Hi' }]

    mockCreateConversation.mockResolvedValueOnce('c-created')

    renderWithClient(<JarvisApplePanel />)

    expect(mockSaveMessages).toHaveBeenCalledTimes(0)

    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(mockCreateConversation).toHaveBeenCalledTimes(1)
    expect(mockSaveMessages).toHaveBeenCalledTimes(1)
    expect(mockSaveMessages).toHaveBeenCalledWith(JARVIS_STATE.messages, 'c-created')
  })

  it('handleNewConversation: sauvegarde si conversation courante + messages, puis createConversation et clearChat', async () => {
    PERSIST_STATE.currentConversationId = 'c-existing'
    JARVIS_STATE.messages = [{ id: 'm1', role: 'user' as const, content: 'Persist' }]

    renderWithClient(<JarvisApplePanel />)

    await act(async () => {
      screen.getByText('new').click()
    })

    expect(mockSaveMessages).toHaveBeenCalledTimes(1)
    expect(mockSaveMessages).toHaveBeenCalledWith(JARVIS_STATE.messages, 'c-existing')
    expect(mockCreateConversation).toHaveBeenCalledTimes(1)
    expect(mockClearChat).toHaveBeenCalledTimes(1)
  })
})