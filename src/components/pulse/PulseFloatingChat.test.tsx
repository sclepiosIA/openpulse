// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PulseFloatingChat from './PulseFloatingChat'

const {
  LOCATION,
  mockNavigate,
  TOTAL_UNREAD,
  UNREAD_DATA,
  CONVERSATIONS,
  MESSAGES_DATA,
  notifierState,
  sendMessageState,
  mockFrom,
} = vi.hoisted(() => ({
  LOCATION: { pathname: '/' },
  mockNavigate: vi.fn(),
  TOTAL_UNREAD: 3,
  UNREAD_DATA: {
    byConversation: {
      c2: 2,
      c1: 0,
    },
  },
  CONVERSATIONS: [
    {
      id: 'c1',
      name: 'Alpha',
      updated_at: '2024-01-01T09:00:00.000Z',
      last_message: {
        created_at: '2024-01-01T09:00:00.000Z',
        content: 'Ancien message',
        user: { prenom: 'Alice' },
      },
    },
    {
      id: 'c2',
      name: 'Bravo',
      updated_at: '2024-01-01T08:00:00.000Z',
      last_message: {
        created_at: '2024-01-01T08:30:00.000Z',
        content: 'Nouveau non lu',
        user: { prenom: 'Bob' },
      },
    },
  ],
  MESSAGES_DATA: {
    pages: [
      {
        messages: [
          {
            id: 'm2',
            content: 'Plus récent',
            created_at: '2024-01-01T10:02:00.000Z',
            user: { prenom: 'Bob', nom: 'Martin' },
          },
          {
            id: 'm1',
            content: 'Plus ancien',
            created_at: '2024-01-01T10:01:00.000Z',
            user: { prenom: 'Alice', nom: 'Durand' },
          },
        ],
      },
    ],
  },
  notifierState: {
    hasNewMessage: true,
    clearPulse: vi.fn(),
  },
  sendMessageState: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  mockFrom: vi.fn(() => {
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
      single: vi.fn(async () => ({ data: null, error: null })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      then: (onFulfilled: (value: { data: null; error: null }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
      catch: (onRejected: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    }
    return builder
  }),
}))

vi.mock('react-router-dom', () => ({
  useLocation: () => LOCATION,
  useNavigate: () => mockNavigate,
}))

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: React.ComponentProps<'button'>) => (
      <button {...props}>{children}</button>
    ),
    div: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>()
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
  return {
    ...actual,
    MessageCircle: Icon,
    X: Icon,
    ArrowLeft: Icon,
    Maximize2: Icon,
    Send: Icon,
    Loader2: Icon,
  }
})

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { children?: React.ReactNode }) => (
    <span {...props}>{children}</span>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    (props, ref) => <input ref={ref} {...props} />
  ),
}))

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  AvatarFallback: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

vi.mock('@/hooks/pulse/usePulseUnreadCount', () => ({
  usePulseTotalUnread: () => TOTAL_UNREAD,
  usePulseUnreadCount: () => ({ data: UNREAD_DATA, isLoading: false, isError: false }),
}))

vi.mock('@/hooks/pulse/usePulseConversations', () => ({
  usePulseConversations: () => ({ data: CONVERSATIONS, isLoading: false, isError: false }),
}))

vi.mock('@/hooks/pulse/usePulseMessages', () => ({
  usePulseMessages: () => ({ data: MESSAGES_DATA, isLoading: false, isError: false }),
  usePulseMessagesRealtime: vi.fn(),
  useSendPulseMessage: () => sendMessageState,
}))

vi.mock('@/hooks/pulse/usePulseMessageReceipts', () => ({
  usePulseMessageReceipts: () => ({
    markAsRead: vi.fn(),
    getMessageReceiptStatus: () => ({ status: 'sent', readCount: 0, totalRecipients: 0 }),
    isGroupChat: false,
  }),
}))

vi.mock('@/hooks/profile/useProfiles', () => ({
  useCurrentProfile: () => ({ data: { id: 'me', prenom: 'Moi', nom: 'Test' } }),
}))

vi.mock('./MessageEditor', () => ({
  MessageEditor: ({ conversationId }: { conversationId: string }) => {
    const [value, setValue] = React.useState('')
    const send = async () => {
      const content = value.trim()
      if (!content) return
      setValue('')
      try {
        await sendMessageState.mutateAsync({ conversation_id: conversationId, content })
      } catch {
        setValue(content)
      }
    }
    return (
      <div>
        <input
          placeholder="Écrire un message..."
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" aria-label="Chargement" disabled={!value.trim()} onClick={send}>
          Envoyer
        </button>
      </div>
    )
  },
}))

vi.mock('@/hooks/pulse/usePulseNewMessageNotifier', () => ({
  usePulseNewMessageNotifier: () => notifierState,
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('PulseFloatingChat', () => {
  beforeEach(() => {
    LOCATION.pathname = '/'
    mockNavigate.mockReset()
    notifierState.clearPulse.mockReset()
    notifierState.hasNewMessage = true
    sendMessageState.isPending = false
    sendMessageState.mutateAsync.mockReset()
  })

  it('n’affiche rien sur une page Pulse', () => {
    LOCATION.pathname = '/pulse'

    const { container } = render(<PulseFloatingChat />, { wrapper: createWrapper() })

    expect(container).toBeEmptyDOMElement()
  })

  it('affiche la bulle avec le nombre total non lu, ouvre la liste triée et efface le notifier à l’ouverture', async () => {
    render(<PulseFloatingChat />, { wrapper: createWrapper() })

    expect(screen.getByLabelText('Ouvrir Pulse (3 non lus)')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Ouvrir Pulse (3 non lus)'))

    expect(notifierState.clearPulse).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Pulse')).toBeInTheDocument()

    const convoButtons = screen
      .getAllByRole('button')
      .filter(
        (button) => button.textContent?.includes('Alpha') || button.textContent?.includes('Bravo')
      )

    expect(convoButtons).toHaveLength(2)
    expect(convoButtons[0].textContent).toContain('Bravo')
    expect(convoButtons[0].textContent).toContain('Bob :')
    expect(convoButtons[0].textContent).toContain('Nouveau non lu')
    expect(convoButtons[0].textContent).toContain('2')
    expect(convoButtons[1].textContent).toContain('Alpha')
  })

  it('ouvre une conversation, affiche les messages du plus ancien au plus récent, envoie un message puis navigue en plein écran', async () => {
    sendMessageState.mutateAsync.mockResolvedValue({ data: null, error: null })

    render(<PulseFloatingChat />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByLabelText('Ouvrir Pulse (3 non lus)'))
    fireEvent.click(screen.getByRole('button', { name: /bravo/i }))

    expect(screen.getByText('Bravo')).toBeInTheDocument()

    const messageTexts = screen.getAllByText(/Plus /).map((node) => node.textContent)
    expect(messageTexts).toEqual(['Plus ancien', 'Plus récent'])

    const input = screen.getByPlaceholderText('Écrire un message...')
    fireEvent.change(input, { target: { value: '  Bonjour Pulse  ' } })

    const sendButton = screen.getByRole('button', { name: 'Chargement' })
    expect(sendButton).not.toBeDisabled()

    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(sendMessageState.mutateAsync).toHaveBeenCalledWith({
        conversation_id: 'c2',
        content: 'Bonjour Pulse',
      })
    })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('')
    })

    fireEvent.click(screen.getByLabelText('Agrandir'))
    expect(mockNavigate).toHaveBeenCalledWith('/pulse?conversation=c2')
  })

  it('restaure le message dans le champ si l’envoi échoue', async () => {
    sendMessageState.mutateAsync.mockRejectedValue(new Error('x'))

    render(<PulseFloatingChat />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByLabelText('Ouvrir Pulse (3 non lus)'))
    fireEvent.click(screen.getByRole('button', { name: /bravo/i }))

    const input = screen.getByPlaceholderText('Écrire un message...')
    fireEvent.change(input, { target: { value: 'Message en erreur' } })
    fireEvent.click(screen.getByRole('button', { name: 'Chargement' }))

    await waitFor(() => {
      expect(sendMessageState.mutateAsync).toHaveBeenCalledWith({
        conversation_id: 'c2',
        content: 'Message en erreur',
      })
    })

    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('Message en erreur')
    })
  })
})
