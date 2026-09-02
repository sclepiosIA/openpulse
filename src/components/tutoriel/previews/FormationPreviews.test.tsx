import { ReactNode } from 'react'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  FormationSessionPreview,
  FormationEmargementPreview,
  FormationQRCodePreview,
  FormationSatisfactionPreview,
  FormationAnalyticsPreview,
  mockFormationSession,
  mockParticipants,
  mockSatisfactionResults,
  mockFormationStats,
} from './FormationPreviews'

const {
  mockTutorielPreviewWrapper,
  mockTutorielCountUpAnimation,
  mockTutorielProgressBar,
  mockCard,
  mockCardContent,
  mockCardHeader,
  mockCardTitle,
  mockBadge,
  mockCn,
} = vi.hoisted(() => {
  const mockTutorielPreviewWrapper = ({ children }: { children: ReactNode }) => (
    <div data-testid="tutoriel-wrapper">{children}</div>
  )
  const mockTutorielCountUpAnimation = ({
    value,
    suffix,
    decimals,
  }: {
    value: number
    suffix?: string
    decimals?: number
  }) => {
    const formatted =
      typeof decimals === 'number' ? value.toFixed(decimals) : String(value)
    return (
      <span data-testid="countup">{`${formatted}${suffix ?? ''}`}</span>
    )
  }
  const mockTutorielProgressBar = ({
    value,
    maxValue,
  }: {
    value: number
    maxValue: number
  }) => <div data-testid="progressbar">{`${value}/${maxValue}`}</div>
  const mockCard = ({
    children,
    className,
    style,
  }: {
    children: ReactNode
    className?: string
    style?: Record<string, unknown>
  }) => (
    <div data-testid="card" data-class={className} style={style}>
      {children}
    </div>
  )
  const mockCardContent = ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => (
    <div data-testid="card-content" data-class={className}>
      {children}
    </div>
  )
  const mockCardHeader = ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => (
    <div data-testid="card-header" data-class={className}>
      {children}
    </div>
  )
  const mockCardTitle = ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => (
    <h2 data-testid="card-title" data-class={className}>
      {children}
    </h2>
  )
  const mockBadge = ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => (
    <span data-testid="badge" data-class={className}>
      {children}
    </span>
  )
  const mockCn = (...values: Array<string | undefined | false>) =>
    values.filter(Boolean).join(' ')
  return {
    mockTutorielPreviewWrapper,
    mockTutorielCountUpAnimation,
    mockTutorielProgressBar,
    mockCard,
    mockCardContent,
    mockCardHeader,
    mockCardTitle,
    mockBadge,
    mockCn,
  }
})

vi.mock('../TutorielMockProviders', () => ({
  TutorielPreviewWrapper: mockTutorielPreviewWrapper,
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: mockTutorielCountUpAnimation,
  TutorielProgressBar: mockTutorielProgressBar,
}))

vi.mock('@/components/ui/card', () => ({
  Card: mockCard,
  CardContent: mockCardContent,
  CardHeader: mockCardHeader,
  CardTitle: mockCardTitle,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: mockBadge,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ 'data-name': dataName }: { 'data-name'?: string }) => (
    <span data-testid={dataName ?? 'icon'} />
  )
  return {
    GraduationCap: (props: unknown) => (
      <Icon {...(props as Record<string, unknown>)} data-name="GraduationCap" />
    ),
    Users: (props: unknown) => (
      <Icon {...(props as Record<string, unknown>)} data-name="Users" />
    ),
    Calendar: (props: unknown) => (
      <Icon {...(props as Record<string, unknown>)} data-name="Calendar" />
    ),
    CheckCircle2: (props: unknown) => (
      <Icon {...(props as Record<string, unknown>)} data-name="CheckCircle2" />
    ),
    QrCode: (props: unknown) => (
      <Icon {...(props as Record<string, unknown>)} data-name="QrCode" />
    ),
    Star: (props: unknown) => (
      <Icon {...(props as Record<string, unknown>)} data-name="Star" />
    ),
    ClipboardCheck: (props: unknown) => (
      <Icon
        {...(props as Record<string, unknown>)}
        data-name="ClipboardCheck"
      />
    ),
    BarChart3: (props: unknown) => (
      <Icon {...(props as Record<string, unknown>)} data-name="BarChart3" />
    ),
  }
})

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

const Wrapper = ({ children }: { children: ReactNode }) => {
  const client = createQueryClient()
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('FormationSessionPreview', () => {
  it('affiche les informations de session après le montage (chargement puis succès)', () => {
    render(
      <Wrapper>
        <FormationSessionPreview />
      </Wrapper>,
    )

    expect(screen.getByTestId('card')).toBeInTheDocument()

    expect(screen.getByText(mockFormationSession.titre)).toBeInTheDocument()
    expect(screen.getByText(mockFormationSession.formateur)).toBeInTheDocument()
    expect(
      screen.getByText(
        `${mockFormationSession.date} • ${mockFormationSession.heureDebut} - ${mockFormationSession.heureFin}`,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        `${mockFormationSession.participantsPresents}/${mockFormationSession.participantsInscrits} participants présents`,
      ),
    ).toBeInTheDocument()

    const expectedPercentage =
      (mockFormationSession.participantsPresents /
        mockFormationSession.participantsInscrits) *
      100
    const countUp = screen
      .getAllByTestId('countup')
      .find((el) => el.textContent?.includes('%'))
    expect(countUp?.textContent).toBe(`${expectedPercentage}%`)

    const progress = screen.getByTestId('progressbar')
    expect(progress.textContent).toBe(
      `${mockFormationSession.participantsPresents}/${mockFormationSession.participantsInscrits}`,
    )
  })
})

describe('FormationEmargementPreview', () => {
  it('affiche la liste des participants avec leur statut initial puis un check-in simulé', () => {
    vi.useFakeTimers()
    render(
      <Wrapper>
        <FormationEmargementPreview />
      </Wrapper>,
    )

    mockParticipants.forEach((p) => {
      expect(screen.getByText(p.nom)).toBeInTheDocument()
      expect(screen.getByText(p.fonction)).toBeInTheDocument()
    })

    const emargeTexts = mockParticipants
      .filter((p) => p.emarge && p.heureEmargement)
      .map((p) => p.heureEmargement as string)

    emargeTexts.forEach((t) => {
      expect(screen.getByText(t)).toBeInTheDocument()
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const instantLabel = screen.getByText("À l'instant")
    expect(instantLabel).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('FormationQRCodePreview', () => {
  it('affiche les informations de QR code et détecte un scan (animation simulée)', () => {
    vi.useFakeTimers()
    render(
      <Wrapper>
        <FormationQRCodePreview />
      </Wrapper>,
    )

    expect(
      screen.getByText('Scannez pour émarger'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`Session: ${mockFormationSession.titre}`),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    const badge = screen.getByTestId('badge')
    expect(badge.textContent).toContain('Scan détecté')
    vi.useRealTimers()
  })
})

describe('FormationSatisfactionPreview', () => {
  it('affiche les résultats de satisfaction globaux et par catégorie', () => {
    render(
      <Wrapper>
        <FormationSatisfactionPreview />
      </Wrapper>,
    )

    const countups = screen.getAllByTestId('countup')

    const globalNoteElement = countups[0]
    expect(globalNoteElement.textContent).toBe(
      mockSatisfactionResults.noteGlobale.toFixed(1),
    )

    const tauxReponseElement = countups.find((el) =>
      el.textContent?.includes('%'),
    )
    expect(tauxReponseElement?.textContent).toBe(
      `${mockSatisfactionResults.tauxReponse}%`,
    )

    mockSatisfactionResults.categories.forEach((cat) => {
      expect(screen.getByText(cat.label)).toBeInTheDocument()
    })

    const progressBars = screen.getAllByTestId('progressbar')
    expect(progressBars.length).toBeGreaterThanOrEqual(
      mockSatisfactionResults.categories.length,
    )
    mockSatisfactionResults.categories.forEach((cat) => {
      const match = progressBars.find(
        (el) => el.textContent === `${cat.note}/5`,
      )
      expect(match).toBeDefined()
    })
  })
})

describe('FormationAnalyticsPreview', () => {
  it('affiche les statistiques principales de formation', () => {
    render(
      <Wrapper>
        <FormationAnalyticsPreview />
      </Wrapper>,
    )

    expect(screen.getByText('Sessions réalisées')).toBeInTheDocument()
    expect(screen.getByText('Participants formés')).toBeInTheDocument()
    expect(screen.getByText('Satisfaction moyenne')).toBeInTheDocument()
    expect(screen.getByText('Heures de formation')).toBeInTheDocument()

    const countups = screen.getAllByTestId('countup').map((el) => el.textContent)

    expect(countups).toContain(String(mockFormationStats.sessionsTotal))
    expect(countups).toContain(String(mockFormationStats.participantsFormes))
    expect(countups).toContain(
      `${mockFormationStats.tauxSatisfactionMoyen.toFixed(1)}/5`,
    )
    expect(countups).toContain(`${mockFormationStats.heuresFormation}h`)
  })
})