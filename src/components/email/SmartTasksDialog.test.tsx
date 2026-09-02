import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SmartTasksDialog } from './SmartTasksDialog'

const { SUGGESTIONS, mockInvoke, mockFrom, mockBuilder, mockToast, mockDebugError } = vi.hoisted(
  () => {
    const SUGGESTIONS = [
      {
        action_type: 'create_task',
        action_data: {
          title: 'Relancer le partenaire',
          description: 'Envoyer un email de relance',
          category: 'commercial',
          priority: 'high',
          deadline_days: 3,
        },
        confidence_score: 0.92,
        reason: 'Le contenu mentionne une relance nécessaire',
      },
      {
        action_type: 'update_task',
        action_data: {
          task_id: 't1',
          new_status: 'done',
        },
        confidence_score: 0.7,
        reason: 'La tâche semble terminée',
      },
    ]

    const mockBuilder: {
      select: ReturnType<typeof vi.fn>
      insert: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
      delete: ReturnType<typeof vi.fn>
      eq: ReturnType<typeof vi.fn>
      gte: ReturnType<typeof vi.fn>
      lte: ReturnType<typeof vi.fn>
      in: ReturnType<typeof vi.fn>
      order: ReturnType<typeof vi.fn>
      limit: ReturnType<typeof vi.fn>
      single: ReturnType<typeof vi.fn>
      maybeSingle: ReturnType<typeof vi.fn>
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise<unknown>
    } = {
      select: vi.fn(() => mockBuilder),
      insert: vi.fn(() => mockBuilder),
      update: vi.fn(() => mockBuilder),
      delete: vi.fn(() => mockBuilder),
      eq: vi.fn(() => mockBuilder),
      gte: vi.fn(() => mockBuilder),
      lte: vi.fn(() => mockBuilder),
      in: vi.fn(() => mockBuilder),
      order: vi.fn(() => mockBuilder),
      limit: vi.fn(() => mockBuilder),
      single: vi.fn(() => Promise.resolve({ data: { id: 'sugg-1' }, error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'sugg-1' }, error: null })),
      then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
    }

    return {
      SUGGESTIONS,
      mockBuilder,
      mockInvoke: vi.fn(),
      mockFrom: vi.fn(() => mockBuilder),
      mockToast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
      mockDebugError: vi.fn(),
    }
  }
)

vi.mock('@/lib/supabaseBrowser', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}))

vi.mock('sonner', () => ({
  toast: mockToast,
}))

vi.mock('@/lib/debug', () => ({
  debug: { error: mockDebugError, log: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: {
    children?: ReactNode
    onClick?: () => void
    disabled?: boolean
    'aria-label'?: string
  }) => (
    <button onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}))

function renderDialog(overrides: Partial<Parameters<typeof SmartTasksDialog>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  const onOpenChange = vi.fn()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SmartTasksDialog
        open={true}
        onOpenChange={onOpenChange}
        sourceType="email"
        sourceId="email-123"
        etablissementId="etab-1"
        partenaireId="part-1"
        {...overrides}
      />
    </QueryClientProvider>
  )
  return { ...utils, onOpenChange }
}

describe('SmartTasksDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue({ data: { suggestions: SUGGESTIONS }, error: null })
    mockFrom.mockImplementation(() => mockBuilder)
    mockBuilder.single.mockImplementation(() =>
      Promise.resolve({ data: { id: 'sugg-1' }, error: null })
    )
  })

  it('ne rend rien quand open=false', () => {
    renderDialog({ open: false })
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Tâches intelligentes')).not.toBeInTheDocument()
  })

  it('affiche le titre, la description et l\'état vide initial quand open=true', () => {
    renderDialog()
    expect(screen.getByText('Tâches intelligentes')).toBeInTheDocument()
    expect(
      screen.getByText('Analyse IA du contenu pour détecter les tâches à créer ou mettre à jour')
    ).toBeInTheDocument()
    expect(screen.getByText('Aucune suggestion de tâche détectée')).toBeInTheDocument()
    expect(screen.getByText('Réanalyser')).toBeInTheDocument()
  })

  it('lance l\'analyse au clic sur Réanalyser et affiche les suggestions', async () => {
    renderDialog()

    await act(async () => {
      fireEvent.click(screen.getByText('Réanalyser'))
    })

    expect(mockInvoke).toHaveBeenCalledWith('smart-tasks-from-content', {
      body: {
        source_type: 'email',
        source_id: 'email-123',
        etablissement_id: 'etab-1',
        partenaire_id: 'part-1',
        force_analysis: true,
      },
    })

    await waitFor(() => {
      expect(screen.getByText('Relancer le partenaire')).toBeInTheDocument()
    })
    expect(screen.getByText('Très haute')).toBeInTheDocument()
    expect(screen.getByText('Nouvelle tâche')).toBeInTheDocument()
    expect(screen.getByText('Mettre à jour: done')).toBeInTheDocument()
    expect(screen.getByText('2 suggestions en attente')).toBeInTheDocument()
    expect(screen.getByText('commercial')).toBeInTheDocument()
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('+3j')).toBeInTheDocument()
  })

  it('affiche l\'état d\'erreur et appelle toast.error si l\'analyse échoue', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('analyse impossible') })
    renderDialog()

    await act(async () => {
      fireEvent.click(screen.getByText('Réanalyser'))
    })

    await waitFor(() => {
      expect(screen.getByText('analyse impossible')).toBeInTheDocument()
    })
    expect(mockToast.error).toHaveBeenCalledWith("Erreur lors de l'analyse IA")
    expect(screen.getByText('Réessayer')).toBeInTheDocument()
  })

  it('applique une suggestion : insert en base, invoke apply-ai-suggestion et toast.success', async () => {
    renderDialog()

    await act(async () => {
      fireEvent.click(screen.getByText('Réanalyser'))
    })
    await waitFor(() => {
      expect(screen.getByText('Relancer le partenaire')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Valider')[0])
    })

    expect(mockFrom).toHaveBeenCalledWith('ai_suggested_actions')
    expect(mockBuilder.insert).toHaveBeenCalledWith({
      email_thread_id: 'email-123',
      etablissement_id: 'etab-1',
      partenaire_id: 'part-1',
      action_type: 'create_task',
      action_data: SUGGESTIONS[0].action_data,
      confidence_score: 0.92,
      reason: 'Le contenu mentionne une relance nécessaire',
      status: 'pending',
    })
    expect(mockInvoke).toHaveBeenCalledWith('apply-ai-suggestion', {
      body: { suggestion_id: 'sugg-1' },
    })
    expect(mockToast.success).toHaveBeenCalledWith('Tâche créée avec succès')
    await waitFor(() => {
      expect(screen.getByText('1 suggestion en attente')).toBeInTheDocument()
    })
  })

  it('ignore une suggestion au clic sur Fermer (rejet) et appelle toast.info', async () => {
    renderDialog()

    await act(async () => {
      fireEvent.click(screen.getByText('Réanalyser'))
    })
    await waitFor(() => {
      expect(screen.getByText('Relancer le partenaire')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Fermer')[0])
    })

    expect(mockToast.info).toHaveBeenCalledWith('Suggestion ignorée')
    expect(screen.getByText('1 suggestion en attente')).toBeInTheDocument()
  })

  it('appelle onOpenChange(false) au clic sur le bouton Fermer du pied de dialogue', () => {
    const { onOpenChange } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})