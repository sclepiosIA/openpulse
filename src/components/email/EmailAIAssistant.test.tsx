import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  PROFILE_ROW,
  AUTH_STATE,
  toastMock,
  sanitizeMock,
  mockFrom,
  builderState,
  invokeMock,
} = vi.hoisted(() => {
  const PROFILE_ROW = { prenom: 'Ada', nom: 'Lovelace', fonction: 'Ingénieure' }
  const AUTH_STATE = { user: { id: 'u1', email: 't@t.co' }, session: { user: { id: 'u1' } }, isLoading: false }

  const toastMock = vi.fn()
  const sanitizeMock = vi.fn((e: unknown) => {
    if (typeof e === 'object' && e && 'message' in e) return String((e as { message?: unknown }).message)
    return 'Erreur'
  })

  type BuilderState = {
    table: string | null
    selectArgs: string | null
    eqArgs: Array<[string, unknown]>
    result: { data: unknown; error: unknown }
  }

  const builderState: BuilderState = {
    table: null,
    selectArgs: null,
    eqArgs: [],
    result: { data: null, error: null },
  }

  const makeBuilder = () => {
    const builder: Record<string, unknown> = {}

    const chain = () => builder

    builder.select = (arg: string) => {
      builderState.selectArgs = arg
      return builder
    }
    builder.eq = (col: string, val: unknown) => {
      builderState.eqArgs.push([col, val])
      return builder
    }
    builder.gte = chain
    builder.lte = chain
    builder.in = chain
    builder.order = chain
    builder.limit = chain
    builder.insert = chain
    builder.update = chain
    builder.delete = chain

    builder.single = () => Promise.resolve(builderState.result)
    builder.maybeSingle = () => Promise.resolve(builderState.result)

    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(builderState.result).then(onFulfilled, onRejected)
    builder.catch = (onRejected?: (e: unknown) => unknown) => Promise.resolve(builderState.result).catch(onRejected)

    return builder
  }

  const mockFrom = vi.fn((table: string) => {
    builderState.table = table
    builderState.selectArgs = null
    builderState.eqArgs = []
    return makeBuilder()
  })

  const invokeMock = vi.fn(async () => ({ data: null, error: null }))

  return { PROFILE_ROW, AUTH_STATE, toastMock, sanitizeMock, mockFrom, builderState, invokeMock }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
    functions: {
      invoke: invokeMock,
    },
  },
}))

vi.mock('@/hooks/shared/useAuth', () => ({
  useAuth: () => AUTH_STATE,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock('@/lib/supabaseErrorSanitizer', () => ({
  sanitizeSupabaseError: (e: unknown) => sanitizeMock(e),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ 'data-testid': dataTestId }: { 'data-testid'?: string }) => <span data-testid={dataTestId || 'icon'} />
  return {
    Loader2: Icon,
    Languages: Icon,
    Lightbulb: Icon,
    CheckCheck: Icon,
    Video: Icon,
    Sparkles: Icon,
    PenLine: Icon,
    Wand2: Icon,
  }
})

vi.mock('@/components/ui/dropdown-menu', () => {
  const Ctx = React.createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null)

  const DropdownMenu = ({ children }: React.PropsWithChildren) => {
    const [open, setOpen] = React.useState(false)
    return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>
  }

  const DropdownMenuTrigger = ({ children }: React.PropsWithChildren<{ asChild?: boolean }>) => {
    const ctx = React.useContext(Ctx)
    if (!ctx) return <>{children}</>
    const child = React.Children.only(children) as React.ReactElement
    const prevOnClick = child.props.onClick as undefined | ((e: unknown) => void)
    return React.cloneElement(child, {
      onClick: (e: unknown) => {
        prevOnClick?.(e)
        ctx.setOpen(!ctx.open)
      },
    })
  }

  const DropdownMenuContent = ({ children }: React.PropsWithChildren) => {
    const ctx = React.useContext(Ctx)
    if (!ctx?.open) return null
    return <div>{children}</div>
  }

  const DropdownMenuItem = ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  )

  const DropdownMenuSeparator = () => <div data-testid="separator" />
  const DropdownMenuLabel = ({ children }: React.PropsWithChildren) => <div>{children}</div>
  const DropdownMenuGroup = ({ children }: React.PropsWithChildren) => <div>{children}</div>

  return {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuGroup,
  }
})

vi.mock('./EmailVisioInviteDialog', () => ({
  EmailVisioInviteDialog: () => null,
}))

vi.mock('./TranslationPreviewDialog', () => ({
  TranslationPreviewDialog: () => null,
}))

import { EmailAIAssistant } from './EmailAIAssistant'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return function Wrapper({ children }: React.PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('EmailAIAssistant', () => {
  it('charge le profil expéditeur via supabase (loading -> succès)', async () => {
    builderState.result = { data: PROFILE_ROW, error: null }

    const onTextUpdate = vi.fn()
    const onAnimationStateChange = vi.fn()

    render(
      <EmailAIAssistant
        text="Bonjour"
        onTextUpdate={onTextUpdate}
        onAnimationStateChange={onAnimationStateChange}
        threadParticipants={[{ email: 'a@b.co' }]}
        threadSubject="Sujet"
        threadMessages={[{ from_address: 'x@y.co', sent_date: '2024-01-01T10:00:00Z', body_text: 'Hi' }]}
      />,
      { wrapper: createWrapper() }
    )

    expect(mockFrom).toHaveBeenCalledWith('profiles')

    await waitFor(() => {
      expect(builderState.selectArgs).toBe('prenom, nom, fonction')
      expect(builderState.eqArgs).toEqual([['user_id', AUTH_STATE.user.id]])
    })
  })

  it('déclenche une mutation (helpwrite) et appelle supabase.functions.invoke avec le bon body', async () => {
    builderState.result = { data: PROFILE_ROW, error: null }

    invokeMock.mockImplementationOnce(async () => ({
      data: { content: 'Contenu amélioré' },
      error: null,
    }))

    const onTextUpdate = vi.fn()
    const onAnimationStateChange = vi.fn()

    render(
      <EmailAIAssistant
        text="Mon brouillon"
        onTextUpdate={onTextUpdate}
        onAnimationStateChange={onAnimationStateChange}
        etablissementId="eta1"
        threadParticipants={[{ email: 'p1@ex.co' }, { email: 'p2@ex.co' }]}
        threadSubject="Objet"
        threadMessages={[{ from_address: 'src@ex.co', sent_date: '2024-01-01T10:00:00Z', body_text: 'Message' }]}
      />,
      { wrapper: createWrapper() }
    )

    await act(async () => {
      screen.getByRole('button', { name: /Rédiger avec l'IA/i }).click()
    })

    await act(async () => {
      screen.getByRole('button', { name: /Professionnaliser/i }).click()
    })

    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1))

    const [fnName, payload] = invokeMock.mock.calls[0] as [string, { body: Record<string, unknown> }]
    expect(fnName).toBe('help-me-write-email')
    expect(payload.body.action).toBe('professionalize')
    expect(payload.body.draft_body).toBe('Mon brouillon')
    expect(payload.body.etablissement_id).toBe('eta1')
    expect(payload.body.recipient_emails).toEqual(['p1@ex.co', 'p2@ex.co'])
    expect(payload.body.sender_name).toBe('Ada Lovelace')
    expect(payload.body.sender_fonction).toBe('Ingénieure')

    await waitFor(() => expect(onTextUpdate).toHaveBeenCalledWith('Contenu amélioré'))
  })

  it('gère une erreur de fonction supabase et affiche un toast destructif', async () => {
    builderState.result = { data: PROFILE_ROW, error: null }

    invokeMock.mockImplementationOnce(async () => ({
      data: null,
      error: { message: 'x' },
    }))

    const onTextUpdate = vi.fn()

    render(<EmailAIAssistant text="Texte" onTextUpdate={onTextUpdate} />, { wrapper: createWrapper() })

    await act(async () => {
      screen.getByRole('button', { name: /Rédiger avec l'IA/i }).click()
    })

    await act(async () => {
      screen.getByRole('button', { name: /Raccourcir/i }).click()
    })

    await waitFor(() => expect(sanitizeMock).toHaveBeenCalled())

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Erreur',
        description: 'x',
        variant: 'destructive',
      })
    )
    expect(onTextUpdate).not.toHaveBeenCalled()
  })
})