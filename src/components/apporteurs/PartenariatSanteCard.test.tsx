import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  PropsWithChildren,
  SVGProps,
  TextareaHTMLAttributes,
} from 'react'

type DivProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>
type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean
    variant?: string
    size?: string
  }
>
type SliderProps = {
  value?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
}
type PopoverProps = PropsWithChildren<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
}>
type PopoverTriggerProps = PropsWithChildren<{
  asChild?: boolean
}>
type PopoverContentProps = PropsWithChildren<{
  className?: string
  align?: string
}>

const {
  mockFrom,
  mockMonthsSince,
  mockCalcScoreCommercial,
  mockCalcScoreDependance,
  mockCalcScoreGlobal,
  mockScoreColor,
  PARTENARIAT_SANTE_CONFIG_STABLE,
} = vi.hoisted(() => {
  type SupabaseRow = { id: string }
  type SupabaseError = { message: string }
  type SupabaseResult = { data: SupabaseRow[]; error: SupabaseError | null }
  type SupabaseSingleResult = { data: SupabaseRow | null; error: SupabaseError | null }
  type QueryBuilder = {
    select: (columns?: string) => QueryBuilder
    eq: (column: string, value: unknown) => QueryBuilder
    neq: (column: string, value: unknown) => QueryBuilder
    gte: (column: string, value: unknown) => QueryBuilder
    lte: (column: string, value: unknown) => QueryBuilder
    gt: (column: string, value: unknown) => QueryBuilder
    lt: (column: string, value: unknown) => QueryBuilder
    in: (column: string, values: unknown[]) => QueryBuilder
    is: (column: string, value: unknown) => QueryBuilder
    not: (column: string, operator: string, value: unknown) => QueryBuilder
    or: (filters: string) => QueryBuilder
    match: (query: Record<string, unknown>) => QueryBuilder
    filter: (column: string, operator: string, value: unknown) => QueryBuilder
    contains: (column: string, value: unknown) => QueryBuilder
    order: (column: string, options?: Record<string, unknown>) => QueryBuilder
    limit: (count: number) => QueryBuilder
    range: (from: number, to: number) => QueryBuilder
    insert: (values: unknown) => QueryBuilder
    update: (values: unknown) => QueryBuilder
    upsert: (values: unknown) => QueryBuilder
    delete: () => QueryBuilder
    single: () => Promise<SupabaseSingleResult>
    maybeSingle: () => Promise<SupabaseSingleResult>
    then: Promise<SupabaseResult>['then']
    catch: Promise<SupabaseResult>['catch']
  }
  type CommercialInput = {
    prospectsCibles: number
    clientsSignes: number
    moisAnciennete: number
  }
  type DependanceInput = {
    prospectsCiblesPartenaire: number
    prospectsCiblesTousPartenaires: number
  }
  type GlobalInput = {
    commercial: number
    organisation: number
    relation: number
    dependance: number
  }

  const SUPABASE_ROW: SupabaseRow = { id: 'row-1' }
  const SUPABASE_ROWS: SupabaseRow[] = [SUPABASE_ROW]
  const SUPABASE_RESULT: SupabaseResult = { data: SUPABASE_ROWS, error: null }
  const SUPABASE_SINGLE_RESULT: SupabaseSingleResult = { data: SUPABASE_ROW, error: null }

  let builder: QueryBuilder
  builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    not: vi.fn(() => builder),
    or: vi.fn(() => builder),
    match: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(SUPABASE_SINGLE_RESULT)),
    maybeSingle: vi.fn(() => Promise.resolve(SUPABASE_SINGLE_RESULT)),
    then: ((onfulfilled, onrejected) =>
      Promise.resolve(SUPABASE_RESULT).then(
        onfulfilled,
        onrejected
      )) as Promise<SupabaseResult>['then'],
    catch: ((onrejected) =>
      Promise.resolve(SUPABASE_RESULT).catch(onrejected)) as Promise<SupabaseResult>['catch'],
  }

  const CONFIG = {
    objectifProspects: 12,
    seuilDependance: 0.35,
  }

  return {
    mockFrom: vi.fn(() => builder),
    PARTENARIAT_SANTE_CONFIG_STABLE: CONFIG,
    mockMonthsSince: vi.fn((_dateDebut: string) => 9),
    mockCalcScoreCommercial: vi.fn((_input: CommercialInput) => 84),
    mockCalcScoreDependance: vi.fn((_input: DependanceInput) => 92),
    mockCalcScoreGlobal: vi.fn(({ commercial, organisation, relation, dependance }: GlobalInput) =>
      Math.round((commercial + organisation + relation + dependance) / 4)
    ),
    mockScoreColor: vi.fn((score: number) => {
      if (score >= 80) return 'rgb(22, 163, 74)'
      if (score >= 60) return 'rgb(234, 179, 8)'
      return 'rgb(220, 38, 38)'
    }),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/config/partenariatSante', () => ({
  PARTENARIAT_SANTE_CONFIG: PARTENARIAT_SANTE_CONFIG_STABLE,
  monthsSince: mockMonthsSince,
  calcScoreCommercial: mockCalcScoreCommercial,
  calcScoreDependance: mockCalcScoreDependance,
  calcScoreGlobal: mockCalcScoreGlobal,
  scoreColor: mockScoreColor,
}))

const {
  mockUseApporteurManualScores,
  mockUpdateScoreMutate,
  setMockManualScores,
  resetMockManualScores,
} = vi.hoisted(() => {
  type MockManualScore = { value: number; comment: string; updatedAt: string }
  type MockManualScores = { organisation: MockManualScore; relation: MockManualScore }

  const DEFAULT_MOCK_SCORES: MockManualScores = {
    organisation: { value: 70, comment: 'À renseigner', updatedAt: new Date().toISOString() },
    relation: { value: 70, comment: 'À renseigner', updatedAt: new Date().toISOString() },
  }

  const scoresById: Record<string, MockManualScores> = {}
  let currentId: string | undefined

  const getScores = (id: string): MockManualScores => scoresById[id] ?? DEFAULT_MOCK_SCORES

  const mockUseApporteurManualScores = vi.fn((id: string) => {
    currentId = id
    return {
      scores: getScores(id),
      isLoading: false,
      updateScore: { mutate: mockUpdateScoreMutate },
    }
  })

  const mockUpdateScoreMutate = vi.fn(
    (payload: { key: 'organisation' | 'relation'; value: number; comment: string }) => {
      if (!currentId) return
      const current = getScores(currentId)
      const next: MockManualScores = {
        ...current,
        [payload.key]: {
          value: payload.value,
          comment: payload.comment,
          updatedAt: new Date().toISOString(),
        },
      }
      scoresById[currentId] = next
    }
  )

  const setMockManualScores = (id: string, scores: MockManualScores) => {
    scoresById[id] = scores
  }

  const resetMockManualScores = () => {
    Object.keys(scoresById).forEach((key) => delete scoresById[key])
  }

  return {
    mockUseApporteurManualScores,
    mockUpdateScoreMutate,
    setMockManualScores,
    resetMockManualScores,
  }
})

vi.mock('./useApporteurManualScores', () => ({
  useApporteurManualScores: mockUseApporteurManualScores,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: DivProps) => (
    <section data-testid="partenariat-card" {...props}>
      {children}
    </section>
  ),
  CardHeader: ({ children, ...props }: DivProps) => (
    <header data-testid="card-header" {...props}>
      {children}
    </header>
  ),
  CardContent: ({ children, ...props }: DivProps) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardFooter: ({ children, ...props }: DivProps) => <footer {...props}>{children}</footer>,
  CardTitle: ({ children, ...props }: DivProps) => <h3 {...props}>{children}</h3>,
  CardDescription: ({ children, ...props }: DivProps) => <p {...props}>{children}</p>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: DivProps) => <div {...props}>{children}</div>,
  badgeVariants: vi.fn(() => ''),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, variant, size, ...buttonProps }: ButtonProps) => {
    void asChild
    void variant
    void size
    return (
      <button type="button" {...buttonProps}>
        {children}
      </button>
    )
  },
  buttonVariants: vi.fn(() => ''),
}))

vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, min = 0, max = 100, step = 1, onValueChange }: SliderProps) => (
    <input
      aria-label="Score manuel"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value?.[0] ?? 0}
      onChange={(event) => onValueChange?.([Number(event.currentTarget.value)])}
    />
  ),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

vi.mock('@/components/ui/popover', async () => {
  const React = await import('react')

  type PopoverContextValue = {
    open: boolean
    setOpen: (open: boolean) => void
  }
  type ClickableChildProps = {
    onClick?: React.MouseEventHandler<HTMLElement>
  }

  const PopoverContext = React.createContext<PopoverContextValue>({
    open: false,
    setOpen: () => undefined,
  })

  return {
    Popover: ({ children, open, onOpenChange }: PopoverProps) => {
      const [internalOpen, setInternalOpen] = React.useState(open ?? false)

      React.useEffect(() => {
        if (open !== undefined) {
          setInternalOpen(open)
        }
      }, [open])

      const setOpen = (nextOpen: boolean) => {
        setInternalOpen(nextOpen)
        onOpenChange?.(nextOpen)
      }

      return (
        <PopoverContext.Provider value={{ open: internalOpen, setOpen }}>
          <div data-testid="popover-root">{children}</div>
        </PopoverContext.Provider>
      )
    },
    PopoverTrigger: ({ children, asChild }: PopoverTriggerProps) => {
      const { setOpen } = React.useContext(PopoverContext)

      if (asChild && React.isValidElement<ClickableChildProps>(children)) {
        return React.cloneElement(children, {
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            children.props.onClick?.(event)
            setOpen(true)
          },
        })
      }

      return (
        <button type="button" onClick={() => setOpen(true)}>
          {children}
        </button>
      )
    },
    PopoverContent: ({ children, className, align }: PopoverContentProps) => {
      const { open } = React.useContext(PopoverContext)
      void align

      if (!open) {
        return null
      }

      return (
        <div data-testid="popover-content" className={className}>
          {children}
        </div>
      )
    },
  }
})

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) => (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} aria-hidden="true" {...props} />
  )

  return {
    BarChart3: makeIcon('BarChart3'),
    Building2: makeIcon('Building2'),
    HeartHandshake: makeIcon('HeartHandshake'),
    Scale: makeIcon('Scale'),
    CalendarDays: makeIcon('CalendarDays'),
    Pencil: makeIcon('Pencil'),
  }
})

import { PartenariatSanteCard } from './PartenariatSanteCard'

const baseProps: ComponentProps<typeof PartenariatSanteCard> = {
  apporteurId: 'apporteur-1',
  dateDebut: '2024-01-15T12:00:00',
  dateFin: '2024-12-31T12:00:00',
  prospectsCibles: 8,
  clientsSignes: 2,
  prospectsCiblesTousPartenaires: 20,
}

function renderSubject(props: ComponentProps<typeof PartenariatSanteCard>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <PartenariatSanteCard {...props} />
    </QueryClientProvider>
  )
}

function seedScores(apporteurId: string) {
  setMockManualScores(apporteurId, {
    organisation: { value: 60, comment: 'Organisation stable', updatedAt: '2024-03-10T12:00:00' },
    relation: { value: 80, comment: 'Relation fluide', updatedAt: '2024-03-11T12:00:00' },
  })
}

function scoreNames() {
  return screen
    .getAllByRole('img')
    .map((element) => element.getAttribute('aria-label') ?? '')
    .filter((label) => label.startsWith('Score '))
}

describe('PartenariatSanteCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    resetMockManualScores()
  })

  afterEach(() => {
    cleanup()
  })

  it('affiche les dates, critères, commentaires métier et scores issus du stockage local', () => {
    seedScores('apporteur-1')

    renderSubject(baseProps)

    expect(screen.getByTestId('partenariat-card')).toBeTruthy()
    expect(screen.getByTestId('card-header')).toBeTruthy()
    expect(screen.getByTestId('card-content')).toBeTruthy()
    expect(screen.getByText('Durée du contrat')).toBeTruthy()
    expect(screen.getByText(/Début : 15\/01\/2024/)).toBeTruthy()
    expect(screen.getByText(/Fin : 31\/12\/2024/)).toBeTruthy()
    expect(screen.getByText('Santé du')).toBeTruthy()
    expect(screen.getByText('partenariat :')).toBeTruthy()

    expect(scoreNames()).toEqual(
      expect.arrayContaining([
        'Score 79 sur 100',
        'Score 84 sur 100',
        'Score 60 sur 100',
        'Score 80 sur 100',
        'Score 92 sur 100',
      ])
    )

    expect(screen.getByText('Commercial')).toBeTruthy()
    expect(
      screen.getByText(
        '8 prospects ciblés sur objectif 12 · 2 convertis (25%) · ancienneté 9 mois.'
      )
    ).toBeTruthy()

    expect(screen.getByText('Organisation')).toBeTruthy()
    expect(screen.getByText('Organisation stable')).toBeTruthy()
    expect(screen.getByText('Mis à jour le 10/03/2024')).toBeTruthy()

    expect(screen.getByText('Relation')).toBeTruthy()
    expect(screen.getByText('Relation fluide')).toBeTruthy()
    expect(screen.getByText('Mis à jour le 11/03/2024')).toBeTruthy()

    expect(screen.getByText('Dépendance')).toBeTruthy()
    expect(
      screen.getByText(
        'Part de 40% du volume total, au-dessus du seuil 35% : dépendance à surveiller.'
      )
    ).toBeTruthy()

    expect(mockMonthsSince).toHaveBeenCalledWith('2024-01-15T12:00:00')
    expect(mockCalcScoreCommercial).toHaveBeenCalledWith({
      prospectsCibles: 8,
      clientsSignes: 2,
      moisAnciennete: 9,
    })
    expect(mockCalcScoreDependance).toHaveBeenCalledWith({
      prospectsCiblesPartenaire: 8,
      prospectsCiblesTousPartenaires: 20,
    })
    expect(mockCalcScoreGlobal).toHaveBeenCalledWith({
      commercial: 84,
      organisation: 60,
      relation: 80,
      dependance: 92,
    })
  })

  it('retombe sur les scores par défaut si aucune donnée en base et gère les dates absentes', () => {
    renderSubject({
      ...baseProps,
      apporteurId: 'apporteur-defaut',
      dateDebut: 'date-invalide',
      dateFin: null,
      prospectsCibles: 1,
      clientsSignes: 1,
      prospectsCiblesTousPartenaires: 100,
    })

    expect(screen.getByText(/Début : —/)).toBeTruthy()
    expect(screen.getByText(/Fin : —/)).toBeTruthy()
    expect(screen.getAllByText('À renseigner')).toHaveLength(2)
    expect(scoreNames()).toEqual(
      expect.arrayContaining([
        'Score 79 sur 100',
        'Score 70 sur 100',
        'Score 84 sur 100',
        'Score 92 sur 100',
      ])
    )
    expect(
      screen.getByText('1 prospect ciblé sur objectif 12 · 1 converti (100%) · ancienneté 9 mois.')
    ).toBeTruthy()
    expect(
      screen.getByText('Part de 1% du volume total (seuil 35%) : pas de dépendance excessive.')
    ).toBeTruthy()
    expect(mockCalcScoreGlobal).toHaveBeenCalledWith({
      commercial: 84,
      organisation: 70,
      relation: 70,
      dependance: 92,
    })
  })

  it('enregistre la modification du score organisation et recalcule la santé globale', async () => {
    seedScores('apporteur-1')

    const { rerender } = renderSubject(baseProps)

    fireEvent.click(screen.getByRole('button', { name: 'Modifier le score organisation' }))

    await waitFor(() => {
      expect(screen.getByTestId('popover-content')).toBeTruthy()
    })

    fireEvent.change(screen.getByRole('slider', { name: 'Score manuel' }), {
      target: { value: '45' },
    })
    fireEvent.change(screen.getByDisplayValue('Organisation stable'), {
      target: { value: 'Organisation ajustée' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: 0, gcTime: 0 },
              mutations: { retry: 0 },
            },
          })
        }
      >
        <PartenariatSanteCard {...baseProps} />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Organisation ajustée')).toBeTruthy()
      expect(scoreNames()).toEqual(expect.arrayContaining(['Score 45 sur 100', 'Score 75 sur 100']))
    })

    expect(mockUpdateScoreMutate).toHaveBeenCalledWith({
      key: 'organisation',
      value: 45,
      comment: 'Organisation ajustée',
    })
    expect(mockCalcScoreGlobal).toHaveBeenLastCalledWith({
      commercial: 84,
      organisation: 45,
      relation: 80,
      dependance: 92,
    })
  })
})
