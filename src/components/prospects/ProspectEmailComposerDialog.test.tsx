import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react'
import { ProspectEmailComposerDialog } from './ProspectEmailComposerDialog'

const { ROWS, queryState, mockFrom, mockInvoke, mockToast, AUTH } = vi.hoisted(() => {
  const ROWS = [
    {
      id: 'c1',
      nom: 'Dupont',
      prenom: 'Jean',
      email: 'jean.dupont@exemple.fr',
      fonction: 'Directeur',
      est_contact_principal: false,
    },
    {
      id: 'c2',
      nom: 'Martin',
      prenom: 'Lea',
      email: 'lea.martin@exemple.fr',
      fonction: null,
      est_contact_principal: true,
    },
  ]

  const queryState: { result: { data: unknown; error: unknown } } = {
    result: { data: ROWS, error: null },
  }

  const builder: Record<string, unknown> = {}
  const chainMethods = [
    'select',
    'eq',
    'neq',
    'not',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
  ]
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(queryState.result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(queryState.result))
  builder.then = (
    onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(queryState.result).then(onFulfilled, onRejected)
  builder.catch = (onRejected: (reason: unknown) => unknown) =>
    Promise.resolve(queryState.result).catch(onRejected)

  const mockFrom = vi.fn(() => builder)
  const mockInvoke = vi.fn()
  const mockToast = vi.fn()

  const AUTH = {
    user: {
      id: 'u1',
      email: 'commercial@marque.fr',
      user_metadata: { full_name: 'Alice Commerciale' },
    },
    session: { user: { id: 'u1' } },
    isLoading: false,
  }

  return { ROWS, queryState, mockFrom, mockInvoke, mockToast, AUTH }
})

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
  getSupabaseClient: () => ({ from: mockFrom, functions: { invoke: mockInvoke } }),
}))

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH,
  useAuthSafe: () => AUTH,
  AuthProvider: ({ children }: { children?: React.ReactNode }) => children,
}))

vi.mock('@/hooks/shared/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
  toast: mockToast,
}))

vi.mock('@/components/email/EmailComposer', () => ({
  EmailComposer: () => null,
}))

vi.mock('@/components/ui/dialog', async () => {
  const React = await import('react')
  const passthrough = (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': testId }, children)
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: React.ReactNode }) =>
      open ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null,
    DialogContent: passthrough('dialog-content'),
    DialogHeader: passthrough('dialog-header'),
    DialogTitle: passthrough('dialog-title'),
    DialogDescription: passthrough('dialog-description'),
    DialogFooter: passthrough('dialog-footer'),
    DialogTrigger: passthrough('dialog-trigger'),
    DialogClose: passthrough('dialog-close'),
    DialogOverlay: passthrough('dialog-overlay'),
    DialogPortal: ({ children }: { children?: React.ReactNode }) => children,
  }
})

vi.mock('@/components/ui/button', async () => {
  const React = await import('react')
  return {
    Button: ({
      children,
      onClick,
      disabled,
      type,
    }: {
      children?: React.ReactNode
      onClick?: () => void
      disabled?: boolean
      type?: 'button' | 'submit' | 'reset'
    }) =>
      React.createElement('button', { onClick, disabled, type: type ?? 'button' }, children),
    buttonVariants: () => '',
  }
})

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  etablissementId: 'etab-1',
  etablissementName: 'Clinique des Lilas',
}

describe('ProspectEmailComposerDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryState.result = { data: ROWS, error: null }
    mockInvoke.mockResolvedValue({
      data: { result: 'Bonjour, voici notre proposition.', subject: 'Sujet IA' },
      error: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('ne rend rien quand open est false', () => {
    render(<ProspectEmailComposerDialog {...baseProps} open={false} />)
    expect(screen.queryByTestId('dialog-root')).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('charge les contacts et sélectionne le contact principal', async () => {
    render(<ProspectEmailComposerDialog {...baseProps} />)

    expect(
      await screen.findByText(/Envoyer un email — Clinique des Lilas/),
    ).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('lea.martin@exemple.fr')).toBeTruthy()
    })

    expect(mockFrom).toHaveBeenCalledWith('contacts')
    expect(screen.getByText(/Jean Dupont/)).toBeTruthy()
    expect(screen.getByText(/Lea Martin/)).toBeTruthy()
    expect(screen.getByText(/· Directeur/)).toBeTruthy()
  })

  it('permet de changer de destinataire en cliquant sur un contact', async () => {
    render(<ProspectEmailComposerDialog {...baseProps} />)

    await waitFor(() => {
      expect(screen.getByText('lea.martin@exemple.fr')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByText(/Jean Dupont/))
    })

    await waitFor(() => {
      expect(screen.getByText('jean.dupont@exemple.fr')).toBeTruthy()
    })
  })

  it("utilise le fallbackEmail quand aucun contact n'a d'email", async () => {
    queryState.result = { data: [], error: null }
    render(
      <ProspectEmailComposerDialog {...baseProps} fallbackEmail="fallback@exemple.fr" />,
    )

    await waitFor(() => {
      expect(screen.getByText('fallback@exemple.fr')).toBeTruthy()
    })
  })

  it("affiche le message d'absence d'email sans contact ni fallback", async () => {
    queryState.result = { data: [], error: null }
    render(<ProspectEmailComposerDialog {...baseProps} />)

    await waitFor(() => {
      expect(
        screen.getByText(/Aucun email de contact enregistré pour ce prospect/),
      ).toBeTruthy()
    })

    const aiButton = screen.getByText(/Rédiger avec l'IA/).closest('button')
    expect(aiButton?.disabled).toBe(true)
  })

  it("génère un brouillon IA via la fonction edge et affiche un toast de succès", async () => {
    render(<ProspectEmailComposerDialog {...baseProps} />)

    await waitFor(() => {
      expect(screen.getByText('lea.martin@exemple.fr')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByText(/Rédiger avec l'IA/))
    })

    expect(mockInvoke).toHaveBeenCalledWith(
      'help-me-write-email',
      expect.objectContaining({
        body: expect.objectContaining({
          action: 'generate_new',
          etablissement_id: 'etab-1',
          recipient_emails: ['lea.martin@exemple.fr'],
          sender_name: 'Alice Commerciale',
        }),
      }),
    )

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Brouillon IA généré' }),
      )
    })
  })

  it('affiche un toast destructif quand la génération IA échoue', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('quota dépassé') })
    render(<ProspectEmailComposerDialog {...baseProps} />)

    await waitFor(() => {
      expect(screen.getByText('lea.martin@exemple.fr')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByText(/Rédiger avec l'IA/))
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Génération IA impossible',
          description: 'quota dépassé',
          variant: 'destructive',
        }),
      )
    })
  })

  it("affiche un toast destructif quand la réponse IA est vide", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { result: '' }, error: null })
    render(<ProspectEmailComposerDialog {...baseProps} />)

    await waitFor(() => {
      expect(screen.getByText('lea.martin@exemple.fr')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByText(/Rédiger avec l'IA/))
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Génération IA impossible',
          description: 'Réponse IA vide',
          variant: 'destructive',
        }),
      )
    })
  })
})