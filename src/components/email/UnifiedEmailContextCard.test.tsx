// @vitest-environment jsdom

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { UnifiedEmailContextCard } from './UnifiedEmailContextCard'

const {
  AUTH_STATE,
  SENDER_LOGO,
  ETAB_TACHES,
  mockNavigate,
  mockToastSuccess,
  mockWriteText,
  mockFrom,
} = vi.hoisted(() => {
  const ETAB_TACHES = [
    { id: 't1', titre: 'Appeler', statut: 'A faire', echeance: '2026-06-12', priorite: 'Haute' },
    { id: 't2', titre: 'Relancer', statut: 'En cours', echeance: '2026-06-13', priorite: 'Moyenne' },
  ]

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
    single: vi.fn(async () => ({ data: null, error: null })),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    then: (onFulfilled: (value: { data: typeof ETAB_TACHES; error: null }) => unknown) =>
      Promise.resolve({ data: ETAB_TACHES, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: ETAB_TACHES, error: null }).catch(onRejected),
  }

  return {
    AUTH_STATE: {
      user: { id: 'u1', email: 'test@example.com' },
      session: { user: { id: 'u1' } },
      isLoading: false,
    },
    SENDER_LOGO: { logoUrl: 'https://logo.test/acme.png' },
    ETAB_TACHES,
    mockNavigate: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockWriteText: vi.fn(),
    mockFrom: vi.fn(() => builder),
  }
})

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
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
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
  }: {
    children: React.ReactNode
    className?: string
  }) => <span className={className}>{children}</span>,
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value }: { value?: number }) => <div data-testid="progress">{value}</div>,
}))

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/hooks/email/useEmailSenderLogo', () => ({
  useEmailSenderLogo: () => ({ data: SENDER_LOGO }),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | false | null>) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/lib/emailUtils', () => ({
  sanitizeEmailSubject: (value: string) => value.trim().replace(/^Re:\s*/i, ''),
  formatEmailAddress: (name?: string | null, email?: string | null) => name || email || 'Inconnu',
}))

vi.mock('@/config/emailStatusColors', () => ({
  getEtablissementStatusColor: () => 'status-etab',
  getPartenaireStatusColor: () => 'status-partenaire',
}))

vi.mock('./CollapsibleCCBanner', () => ({
  CollapsibleCCBanner: () => null,
}))

vi.mock('./EmailAvatar', () => ({
  EmailAvatar: () => null,
}))

vi.mock('./EmailThreadTags', () => ({
  EmailThreadTags: () => null,
}))

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
    error: vi.fn(),
  },
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />
  return {
    Sparkles: Icon,
    Lightbulb: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    TrendingUp: Icon,
    Target: Icon,
    Calendar: Icon,
    ExternalLink: Icon,
    AlertCircle: Icon,
    Link2: Icon,
    Handshake: Icon,
    Reply: Icon,
    ReplyAll: Icon,
    Forward: Icon,
    Copy: Icon,
  }
})

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => AUTH_STATE,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('UnifiedEmailContextCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
    })
  })

  it('rend le contexte établissement, charge les tâches et permet de naviguer vers la fiche', async () => {
    const wrapper = createWrapper()

    render(
      <UnifiedEmailContextCard
        thread={{
          ai_summary: 'Re: Résumé IA établissement',
          etablissement: {
            id: 'etab-1',
            nom: 'Lycée Horizon',
            ville: 'Lyon',
            statut: 'Actif',
            progression: 42,
            engagement_score: 75,
          },
        }}
        senderEmail="contact@horizon.fr"
      />,
      { wrapper }
    )

    expect(screen.getByText('Lycée Horizon')).toBeInTheDocument()
    expect(screen.getByText('Lyon')).toBeInTheDocument()
    expect(screen.getByText('Actif')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    expect(mockFrom).toHaveBeenCalledWith('taches')

    const ficheButton = screen.getByRole('button', { name: /fiche/i })
    fireEvent.click(ficheButton)

    expect(mockNavigate).toHaveBeenCalledWith('/etablissements/etab-1')
  })

  it('rend le placeholder d’association quand aucun établissement ni partenaire n’est lié', () => {
    const wrapper = createWrapper()
    const onAssign = vi.fn()

    render(
      <UnifiedEmailContextCard
        thread={{ ai_summary: 'Email à classer' }}
        onAssign={onAssign}
      />,
      { wrapper }
    )

    expect(screen.getByText('Aucun établissement associé')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /associer/i }))

    expect(onAssign).toHaveBeenCalledTimes(1)
  })

  it('copie l’adresse expéditeur et affiche un toast de succès', () => {
    const wrapper = createWrapper()

    render(
      <UnifiedEmailContextCard
        thread={{
          ai_summary: 'Résumé',
          etablissement: {
            id: 'etab-2',
            nom: 'Campus Atlas',
          },
        }}
        senderInfo={{
          from_name: 'Alice Martin',
          from_address: 'alice@atlas.fr',
          to_addresses: [{ name: 'Equipe', email: 'equipe@atlas.fr' }],
        }}
      />,
      { wrapper }
    )

    fireEvent.click(screen.getByRole('button', { name: 'Alice Martin' }))

    expect(mockWriteText).toHaveBeenCalledWith('alice@atlas.fr')
    expect(mockToastSuccess).toHaveBeenCalledWith('Adresse copiée !', {
      description: 'alice@atlas.fr',
      duration: 2000,
    })
  })
})