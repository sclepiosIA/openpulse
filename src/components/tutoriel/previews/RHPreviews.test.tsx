import { render, screen, act } from '@testing-library/react'
import { RHOverviewPreview, RHTeamListPreview, RHSalairesPreview, RHBulletinParsingPreview, RHAbsencesPreview, mockRHKPIs, mockTeamMembers, mockSalaires, mockAbsences } from './RHPreviews'

const { mockTutorielPreviewWrapper, mockTutorielCountUpAnimation, mockTutorielFlowDiagram, mockCard, mockCardContent, mockCardHeader, mockCardTitle, mockBadge, mockAvatar, mockAvatarFallback, mockCn } = vi.hoisted(() => {
  const mockTutorielPreviewWrapper = ({ children }: { children: React.ReactNode }) => <div data-testid="tutoriel-wrapper">{children}</div>
  const mockTutorielCountUpAnimation = ({ value, suffix }: { value: number; suffix?: string }) => <span>{`${value}${suffix ?? ''}`}</span>
  const mockTutorielFlowDiagram = ({ steps }: { steps: Array<{ id: string; label: string; description: string }> }) => (
    <div data-testid="flow-diagram">
      {steps.map(step => (
        <span key={step.id}>{step.label}</span>
      ))}
    </div>
  )

  const mockCard = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  )
  const mockCardContent = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  )
  const mockCardHeader = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  )
  const mockCardTitle = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 data-testid="card-title" {...props}>
      {children}
    </h2>
  )

  const mockBadge = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="badge" {...props}>
      {children}
    </div>
  )

  const mockAvatar = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="avatar" {...props}>
      {children}
    </div>
  )
  const mockAvatarFallback = ({ children, ...props }: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="avatar-fallback" {...props}>
      {children}
    </div>
  )

  const mockCn = (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' ')

  return {
    mockTutorielPreviewWrapper,
    mockTutorielCountUpAnimation,
    mockTutorielFlowDiagram,
    mockCard,
    mockCardContent,
    mockCardHeader,
    mockCardTitle,
    mockBadge,
    mockAvatar,
    mockAvatarFallback,
    mockCn,
  }
})

vi.mock('../TutorielMockProviders', () => ({
  TutorielPreviewWrapper: mockTutorielPreviewWrapper,
}))

vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: mockTutorielCountUpAnimation,
}))

vi.mock('../TutorielFlowDiagram', () => ({
  TutorielFlowDiagram: mockTutorielFlowDiagram,
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

vi.mock('@/components/ui/avatar', () => ({
  Avatar: mockAvatar,
  AvatarFallback: mockAvatarFallback,
}))

vi.mock('lucide-react', () => ({
  Users: () => <svg data-testid="icon-users" />,
  Wallet: () => <svg data-testid="icon-wallet" />,
  Calendar: () => <svg data-testid="icon-calendar" />,
  Upload: () => <svg data-testid="icon-upload" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  CheckCircle2: () => <svg data-testid="icon-check" />,
  Briefcase: () => <svg data-testid="icon-briefcase" />,
}))

vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}))

describe('RHOverviewPreview', () => {
  it('affiche les KPIs avec les valeurs correctes', () => {
    render(<RHOverviewPreview />)

    expect(screen.getByText('Effectif total')).toBeInTheDocument()
    expect(screen.getByText(String(mockRHKPIs.effectifTotal))).toBeInTheDocument()

    expect(screen.getByText('Masse salariale nette')).toBeInTheDocument()
    expect(screen.getByText(`${mockRHKPIs.masseSalarialeNette} €`)).toBeInTheDocument()

    expect(screen.getByText('Coût employeur')).toBeInTheDocument()
    expect(screen.getByText(`${mockRHKPIs.coutEmployeur} €`)).toBeInTheDocument()

    expect(screen.getByText('Absences en cours')).toBeInTheDocument()
    expect(screen.getByText(String(mockRHKPIs.absencesEnCours))).toBeInTheDocument()
  })
})

describe('RHTeamListPreview', () => {
  it('affiche la liste des membres de l’équipe avec leur statut', () => {
    render(<RHTeamListPreview />)

    mockTeamMembers.forEach(member => {
      const fullName = `${member.prenom} ${member.nom}`
      expect(screen.getByText(fullName)).toBeInTheDocument()
      expect(screen.getByText(member.role)).toBeInTheDocument()
    })

    const actifs = screen.getAllByText('Actif')
    const absents = screen.getAllByText('Absent')
    expect(actifs.length).toBe(mockTeamMembers.filter(m => m.status === 'active').length)
    expect(absents.length).toBe(mockTeamMembers.filter(m => m.status === 'absence').length)
  })

  it('affiche les initiales dans AvatarFallback', () => {
    render(<RHTeamListPreview />)

    mockTeamMembers.forEach(member => {
      const initials = `${member.prenom[0]}${member.nom[0]}`
      expect(screen.getAllByText(initials).length).toBeGreaterThan(0)
    })
  })
})

describe('RHSalairesPreview', () => {
  it('affiche le tableau des salaires avec les montants corrects', () => {
    render(<RHSalairesPreview />)

    expect(screen.getByText('Salaires du mois')).toBeInTheDocument()
    expect(screen.getByText('Employé')).toBeInTheDocument()
    expect(screen.getByText('Net payé')).toBeInTheDocument()
    expect(screen.getByText('Brut')).toBeInTheDocument()
    expect(screen.getByText('Coût total')).toBeInTheDocument()

    mockSalaires.forEach(salaire => {
      expect(screen.getByText(salaire.employe)).toBeInTheDocument()
      expect(screen.getByText(`${salaire.netPaye} €`)).toBeInTheDocument()
      expect(screen.getByText(`${salaire.brut} €`)).toBeInTheDocument()
      expect(screen.getByText(`${salaire.coutEmployeur} €`)).toBeInTheDocument()
    })
  })
})

describe('RHBulletinParsingPreview', () => {
  beforeAll(() => {
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('rend le diagramme de flux et affiche les données extraites après progression des étapes', () => {
    render(<RHBulletinParsingPreview />)

    expect(screen.getByTestId('flow-diagram')).toBeInTheDocument()
    expect(screen.getByText('Upload PDF')).toBeInTheDocument()
    expect(screen.getByText('Analyse IA')).toBeInTheDocument()
    expect(screen.getByText('Extraction')).toBeInTheDocument()
    expect(screen.getByText('Validation')).toBeInTheDocument()
    expect(screen.getByText('Enregistrement')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.getByText('Données extraites')).toBeInTheDocument()
    expect(screen.getByText('Employé')).toBeInTheDocument()
    expect(screen.getByText('Sophie Bernard')).toBeInTheDocument()
    expect(screen.getByText('Période')).toBeInTheDocument()
    expect(screen.getByText('Janvier 2024')).toBeInTheDocument()
    expect(screen.getByText('Net payé')).toBeInTheDocument()
    expect(screen.getByText('3 200,00 €')).toBeInTheDocument()
    expect(screen.getByText('Brut')).toBeInTheDocument()
    expect(screen.getByText('4 100,00 €')).toBeInTheDocument()
  })
})

describe('RHAbsencesPreview', () => {
  it('affiche les absences en cours avec les informations correctes', () => {
    render(<RHAbsencesPreview />)

    expect(screen.getByText('Absences en cours')).toBeInTheDocument()

    mockAbsences.forEach(absence => {
      expect(screen.getByText(absence.employe)).toBeInTheDocument()
      expect(screen.getByText(absence.type)).toBeInTheDocument()
      const period = `${absence.debut} → ${absence.fin}`
      expect(screen.getByText(period)).toBeInTheDocument()
      const joursText = `${absence.jours} jour(s)`
      expect(screen.getByText(joursText)).toBeInTheDocument()
    })
  })
})