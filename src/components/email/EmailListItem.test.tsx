const { mockFrom, mockUseIsMobile, mockClassifyThread, mockUpdateContactRole, THREAD } = vi.hoisted(
  () => {
    const NOW_ISO = new Date('2024-01-01T10:00:00Z').toISOString()
    const THREAD = {
      id: 'thread-1',
      subject: 'Réunion projet IA',
      ai_generated_title: null,
      unread_count: 2,
      message_count: 0,
      priority: null,
      category: null,
      tags: [],
      messages: [],
      participants: [],
      etablissement_id: null,
      partenaire_id: null,
      groupe_id: null,
      etablissement: null,
      partenaire: null,
      groupe: null,
      account: { email_address: 'moi@marque.fr' },
      last_message_at: NOW_ISO,
      last_message_date: NOW_ISO,
      last_message_received_at: NOW_ISO,
      latest_message_at: NOW_ISO,
      last_activity_at: NOW_ISO,
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
    }
    return {
      THREAD,
      mockFrom: vi.fn(),
      mockUseIsMobile: vi.fn(() => false),
      mockClassifyThread: vi.fn(),
      mockUpdateContactRole: vi.fn(),
    }
  }
)

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  for (const m of [
    'select',
    'eq',
    'gte',
    'lte',
    'in',
    'order',
    'limit',
    'insert',
    'update',
    'delete',
    'upsert',
    'is',
    'neq',
    'range',
  ]) {
    builder[m] = vi.fn(chain)
  }
  builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  builder.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(resolve)
  builder.catch = () => Promise.resolve({ data: [], error: null })
  mockFrom.mockImplementation(() => builder)
  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })),
      },
    },
  }
})

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: mockUseIsMobile,
}))

vi.mock('@/hooks/email/useQuickClassification', () => ({
  useQuickClassification: () => ({ classifyThread: mockClassifyThread }),
}))

vi.mock('@/hooks/crm/useContacts', () => ({
  useContacts: () => ({ updateContactRole: mockUpdateContactRole, contacts: [], isLoading: false }),
}))

vi.mock('./EmailAvatar', () => ({
  EmailAvatar: () => <div data-testid="email-avatar" />,
}))

vi.mock('./EmailEtablissementBadge', () => ({
  EmailEtablissementBadge: () => <div data-testid="etablissement-badge" />,
}))

vi.mock('./EmailThreadHoverCard', () => {
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    EmailThreadHoverCard: PassThrough,
    default: PassThrough,
  }
})

vi.mock('./SharedDomainBadge', () => ({
  SharedDomainBadge: () => <div data-testid="shared-domain-badge" />,
}))

vi.mock('./ImageLightbox', () => ({
  ImageLightbox: () => null,
}))

vi.mock('./QuickClassificationDialog', () => ({
  QuickClassificationDialog: () => null,
}))

vi.mock('./EmailListItemMobile', () => ({
  EmailListItemMobile: () => <div data-testid="email-list-item-mobile" />,
}))

vi.mock('@/components/contacts/ContactRoleBadge', () => ({
  ContactRoleBadge: () => <div data-testid="contact-role-badge" />,
}))

vi.mock('@/components/ui/partenaire-badge', () => ({
  PartenaireBadge: ({ nom }: { nom: string }) => <div data-testid="partenaire-badge">{nom}</div>,
}))

vi.mock('@/components/ui/groupe-badge', () => ({
  GroupeBadge: ({ nom }: { nom: string }) => <div data-testid="groupe-badge">{nom}</div>,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { EmailListItem } from './EmailListItem'
import type { EmailThread } from '@/types/email'

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

const baseThread = THREAD as unknown as EmailThread

describe('EmailListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseIsMobile.mockReturnValue(false)
  })

  it('rend le sujet du thread et un role article en desktop', () => {
    renderWithProviders(<EmailListItem thread={baseThread} />)
    const article = screen.getByRole('article')
    expect(article).toBeTruthy()
    expect(article.getAttribute('aria-label')).toContain('Réunion projet IA')
    expect(article.getAttribute('aria-label')).toContain('non lu')
    expect(screen.getAllByText('Réunion projet IA').length).toBeGreaterThan(0)
  })

  it('affiche le badge "Haute" quand la priorité est high et marque comme lu si unread_count=0', () => {
    const thread = { ...THREAD, priority: 'high', unread_count: 0 } as unknown as EmailThread
    renderWithProviders(<EmailListItem thread={thread} />)
    expect(screen.getByText('Haute')).toBeTruthy()
    expect(screen.getByRole('article').getAttribute('aria-label')).toContain(', lu')
  })

  it('affiche data-selected=true quand selected est vrai', () => {
    renderWithProviders(<EmailListItem thread={baseThread} selected />)
    expect(screen.getByRole('article').getAttribute('data-selected')).toBe('true')
  })

  it('appelle onClick au clic et à la touche Entrée', () => {
    const onClick = vi.fn()
    renderWithProviders(<EmailListItem thread={baseThread} onClick={onClick} />)
    const article = screen.getByRole('article')
    fireEvent.click(article)
    expect(onClick).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(article, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('affiche le badge catégorie quand category est défini', () => {
    const thread = { ...THREAD, category: 'Commercial' } as unknown as EmailThread
    renderWithProviders(<EmailListItem thread={thread} />)
    expect(screen.getByText('Commercial')).toBeTruthy()
  })

  it('affiche le PartenaireBadge quand le thread a un partenaire', () => {
    const thread = {
      ...THREAD,
      partenaire_id: 'p1',
      partenaire: { id: 'p1', nom: 'Partenaire X', ville: 'Paris', type_partenaire: 'industriel' },
    } as unknown as EmailThread
    renderWithProviders(<EmailListItem thread={thread} />)
    expect(screen.getByTestId('partenaire-badge').textContent).toBe('Partenaire X')
  })

  it('affiche les tags (max 2) puis un compteur +N', () => {
    const thread = {
      ...THREAD,
      tags: ['urgent', 'devis', 'relance', 'admin'],
    } as unknown as EmailThread
    renderWithProviders(<EmailListItem thread={thread} />)
    expect(screen.getByText('#urgent')).toBeTruthy()
    expect(screen.getByText('#devis')).toBeTruthy()
    expect(screen.queryByText('#relance')).toBeNull()
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('rend EmailListItemMobile sur mobile', () => {
    mockUseIsMobile.mockReturnValue(true)
    renderWithProviders(<EmailListItem thread={baseThread} />)
    expect(screen.getByTestId('email-list-item-mobile')).toBeTruthy()
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('toggle la priorité via supabase au clic sur l’étoile', async () => {
    const { container } = renderWithProviders(<EmailListItem thread={baseThread} />)
    const starButton = container.querySelector('button.hidden')
    expect(starButton).toBeTruthy()
    if (starButton) {
      await act(async () => {
        fireEvent.click(starButton)
      })
      expect(mockFrom).toHaveBeenCalledWith('email_threads')
    }
  })

  it('affiche le SharedDomainBadge quand le groupe a plusieurs établissements', () => {
    const enrichedData = {
      groupeInfo: {
        hasMultipleEtablissementsInGroupe: true,
        groupeNom: 'GHT Nord',
        groupeId: 'g1',
        etablissementNames: ['Hopital A', 'Hopital B'],
      },
      contact: null,
      internalRole: null,
      imageCount: 0,
    }
    renderWithProviders(<EmailListItem thread={baseThread} enrichedData={enrichedData as never} />)
    expect(screen.getByTestId('shared-domain-badge')).toBeTruthy()
    expect(screen.queryByTestId('etablissement-badge')).toBeNull()
  })
})
