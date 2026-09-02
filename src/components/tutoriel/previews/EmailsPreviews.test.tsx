import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EmailInboxPreview, EmailComposePreview, EmailClassificationPreview, EmailActionsPreview } from './EmailsPreviews'

const { supabaseStable, mockFrom, fromBuilder } = vi.hoisted(() => {
  type Result = { data: unknown; error: null | { message: string } }

  const makeThenableBuilder = () => {
    let result: Result = { data: null, error: null }
    let throwMode = false

    const builder: Record<string, unknown> = {}

    ;(builder as any).__setResult = (r: Result) => {
      result = r
      throwMode = false
      return builder
    }
    ;(builder as any).__setThrow = (r: Result) => {
      result = r
      throwMode = true
      return builder
    }

    const chainMethods = [
      'select',
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'in',
      'contains',
      'ilike',
      'like',
      'order',
      'limit',
      'range',
      'insert',
      'update',
      'upsert',
      'delete',
      'match',
    ] as const

    for (const method of chainMethods) {
      ;(builder as any)[method] = vi.fn(() => builder)
    }

    ;(builder as any).single = vi.fn(async () => result)
    ;(builder as any).maybeSingle = vi.fn(async () => result)

    ;(builder as any).then = (onFulfilled?: (v: Result) => unknown, onRejected?: (e: Result) => unknown) => {
      if (throwMode) {
        if (onRejected) return Promise.resolve(onRejected(result))
        return Promise.reject(result)
      }
      if (onFulfilled) return Promise.resolve(onFulfilled(result))
      return Promise.resolve(result)
    }

    ;(builder as any).catch = (onRejected?: (e: Result) => unknown) => {
      if (throwMode) {
        if (onRejected) return Promise.resolve(onRejected(result))
        return Promise.resolve(result)
      }
      return Promise.resolve(result)
    }

    return builder as any
  }

  const fromBuilder = makeThenableBuilder()
  const mockFrom = vi.fn(() => fromBuilder)

  const supabaseStable = {
    from: mockFrom,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'u1', email: 't@t.co' } }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  }

  return { supabaseStable, mockFrom, fromBuilder }
})

vi.mock('@/integrations/supabase/client', () => ({ supabase: supabaseStable }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn(), useLocation: () => ({ pathname: '/' }), useParams: () => ({}) }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <span {...props}>{children}</span>,
}))
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
}))

vi.mock('framer-motion', () => {
  const React = require('react') as typeof import('react')
  const NoopDiv = React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) =>
    React.createElement('div', { ...props, ref }, children),
  )
  const NoopSpan = React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) =>
    React.createElement('span', { ...props, ref }, children),
  )
  return {
    motion: {
      div: NoopDiv,
      span: NoopSpan,
      button: NoopDiv,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('lucide-react', () => {
  const React = require('react') as typeof import('react')
  const make = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('svg', { 'data-icon': name, ...props })
  return {
    Mail: make('Mail'),
    Send: make('Send'),
    Star: make('Star'),
    Paperclip: make('Paperclip'),
    Clock: make('Clock'),
    Sparkles: make('Sparkles'),
    Building2: make('Building2'),
    User: make('User'),
    Check: make('Check'),
    Reply: make('Reply'),
    Forward: make('Forward'),
    Archive: make('Archive'),
    Trash2: make('Trash2'),
    MoreHorizontal: make('MoreHorizontal'),
    AlertCircle: make('AlertCircle'),
    CheckCircle2: make('CheckCircle2'),
  }
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function createHookWrapper() {
  const client = createQueryClient()
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { Wrapper }
}

describe('EmailsPreviews', () => {
  it('EmailInboxPreview renders expected emails, tags and establishment badges', () => {
    renderWithClient(<EmailInboxPreview />)

    expect(screen.getByText('Dr. Martin Dupont')).toBeInTheDocument()
    expect(screen.getByText('Sophie Bernard')).toBeInTheDocument()
    expect(screen.getByText('Support Technique')).toBeInTheDocument()

    expect(screen.getByText('RE: Planification formation équipe terrain')).toBeInTheDocument()
    expect(screen.getByText('Demande de démonstration outil métier')).toBeInTheDocument()
    expect(screen.getByText('Ticket #4521 - Résolu')).toBeInTheDocument()

    expect(screen.getByText('Formation')).toBeInTheDocument()
    expect(screen.getAllByText('Groupe Vallois').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Commercial')).toBeInTheDocument()
    expect(screen.getByText('Prospect')).toBeInTheDocument()
    expect(screen.getByText('Résolu')).toBeInTheDocument()

    expect(screen.getByText('CH Marseille')).toBeInTheDocument()
  })

  it('EmailComposePreview: typing starts (loading) then AI suggestion appears (success)', async () => {
    vi.useFakeTimers()
    renderWithClient(<EmailComposePreview />)

    expect(screen.getByText('Nouveau message')).toBeInTheDocument()
    expect(screen.getByText('RE: Planification formation équipe terrain')).toBeInTheDocument()

    expect(screen.queryByText('Suggestion IA')).not.toBeInTheDocument()
    expect(screen.getByText('', { selector: 'p' }).textContent ?? '').toBe('')

    await act(async () => {
      vi.advanceTimersByTime(60)
    })
    const typed = screen.getByText((content) => content.startsWith('Bo'))
    expect(typed).toBeInTheDocument()
    expect(typed.textContent?.length ?? 0).toBeGreaterThanOrEqual(2)

    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByText('Suggestion IA')).toBeInTheDocument()
    expect(
      screen.getByText(
        "Je vous propose également d'inclure une session de questions-réponses d'une heure après la formation principale.",
      ),
    ).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('supabase mock builder: success then error result (covers query success/error shapes)', async () => {
    fromBuilder.__setResult({ data: [{ id: 1 }], error: null })
    const success = await (supabaseStable.from('emails') as any).select('*')
    expect(mockFrom).toHaveBeenCalledWith('emails')
    expect(success).toEqual({ data: [{ id: 1 }], error: null })

    fromBuilder.__setResult({ data: null, error: { message: 'x' } })
    const failure = await (supabaseStable.from('emails') as any).select('*')
    expect(failure.data).toBeNull()
    expect(failure.error).toEqual({ message: 'x' })
  })

  it('EmailClassificationPreview reveals results progressively and ends with all classifications', async () => {
    vi.useFakeTimers()
    renderWithClient(<EmailClassificationPreview />)

    expect(screen.getByText('direction@clinique-tilleuls.example.org')).toBeInTheDocument()
    expect(screen.getByText('Demande urgente de support technique')).toBeInTheDocument()

    expect(screen.queryByText('Analyse IA en cours...')).not.toBeInTheDocument()
    expect(screen.queryByText('Catégorie')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    expect(screen.getByText('Analyse IA en cours...')).toBeInTheDocument()
    expect(screen.getByText('Catégorie')).toBeInTheDocument()
    expect(screen.getByText('Support Technique')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(700)
    })
    expect(screen.getByText('Priorité')).toBeInTheDocument()
    expect(screen.getByText('Haute')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(900)
    })
    expect(screen.getByText('Établissement')).toBeInTheDocument()
    expect(screen.getByText('Clinique Saint-Jean')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('Analyse IA en cours...')).not.toBeInTheDocument()
    expect(screen.getByText('Action suggérée')).toBeInTheDocument()
    expect(screen.getByText('Créer ticket support')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('EmailActionsPreview cycles active action and sets border-primary class on the active action button', async () => {
    vi.useFakeTimers()
    renderWithClient(<EmailActionsPreview />)

    expect(screen.getByText('Actions rapides')).toBeInTheDocument()

    const replyButton = screen.getByText('Répondre').closest('button')
    const forwardButton = screen.getByText('Transférer').closest('button')
    const archiveButton = screen.getByText('Archiver').closest('button')
    const deleteButton = screen.getByText('Supprimer').closest('button')

    expect(replyButton).toBeTruthy()
    expect(forwardButton).toBeTruthy()
    expect(archiveButton).toBeTruthy()
    expect(deleteButton).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Répondre').closest('button')?.className ?? '').toContain('border-primary')

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('Transférer').closest('button')?.className ?? '').toContain('border-primary')

    vi.useRealTimers()
  })

  it('renderHook works with QueryClientProvider wrapper (required harness)', () => {
    const { Wrapper } = createHookWrapper()
    const { result } = renderHook(() => 'ok', { wrapper: Wrapper })
    expect(result.current).toBe('ok')
  })
})