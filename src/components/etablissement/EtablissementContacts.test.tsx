import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EtablissementContacts } from './EtablissementContacts'

const {
  CONTACTS,
  mockUseContacts,
  mockStartCall,
  mockNavigate,
  mockAddContact,
  mockUpdateContact,
  mockDeleteContact,
  mockAssignToGroup,
} = vi.hoisted(() => {
  const mockAddContact = vi.fn()
  const mockUpdateContact = vi.fn()
  const mockDeleteContact = vi.fn()
  const mockAssignToGroup = vi.fn()
  const CONTACTS = [
    {
      id: 'c1',
      nom: 'Dupont',
      prenom: 'Jean',
      fonction: 'Directeur',
      email: 'jean.dupont@example.fr',
      telephone: '0102030405',
      type_contact: 'administration',
      created_source: 'manual',
      latest_source: null,
      latest_update: null,
      etablissement_id: 'etab-1',
    },
    {
      id: 'c2',
      nom: 'Martin',
      prenom: 'Claire',
      fonction: 'Médecin DIM',
      email: null,
      telephone: null,
      type_contact: 'dim',
      created_source: 'email_ai',
      latest_source: null,
      latest_update: null,
      etablissement_id: 'etab-1',
    },
  ]
  return {
    CONTACTS,
    mockAddContact,
    mockUpdateContact,
    mockDeleteContact,
    mockAssignToGroup,
    mockStartCall: vi.fn(),
    mockNavigate: vi.fn(),
    mockUseContacts: vi.fn(() => ({
      contacts: CONTACTS,
      isLoading: false,
      error: null,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
      assignToGroup: mockAssignToGroup,
    })),
  }
})

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/hooks/crm/useContacts', () => ({
  useContacts: mockUseContacts,
}))

vi.mock('@/contexts/CallContext', () => ({
  useCallContext: () => ({ startCall: mockStartCall }),
}))

vi.mock('@/components/cti/CallButton', () => ({
  CallButton: () => null,
  default: () => null,
}))

vi.mock('@/components/forms/ContactForm', () => ({
  ContactForm: () => null,
  default: () => null,
}))

vi.mock('@/components/contacts/ContactFieldBadge', () => ({
  ContactFieldBadge: () => null,
  default: () => null,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function renderComponent(etablissementId = 'etab-1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0 }, mutations: { retry: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EtablissementContacts etablissementId={etablissementId} />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('EtablissementContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseContacts.mockReturnValue({
      contacts: CONTACTS,
      isLoading: false,
      error: null,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
      assignToGroup: mockAssignToGroup,
    })
  })

  it('affiche le titre Contacts et le compteur avec la liste des contacts', () => {
    renderComponent()

    expect(screen.getAllByText('Contacts').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2 contacts enregistrés').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Liste des contacts').length).toBeGreaterThanOrEqual(1)
    // Les contacts sont rendus en double (table desktop + cards mobile)
    expect(screen.getAllByText('Jean Dupont').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Claire Martin').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche les badges de type de contact et la fonction', () => {
    renderComponent()

    expect(screen.getAllByText('Administration').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('DIM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Directeur').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('jean.dupont@example.fr').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche le badge IA pour les contacts créés via email_ai', () => {
    renderComponent()

    expect(screen.getAllByText('IA').length).toBeGreaterThanOrEqual(1)
  })

  it('affiche un loader pendant le chargement', () => {
    mockUseContacts.mockReturnValue({
      contacts: [],
      isLoading: true,
      error: null,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
      assignToGroup: mockAssignToGroup,
    })

    const { container } = renderComponent()

    expect(container.querySelector('.animate-spin')).toBeTruthy()
    expect(screen.queryByText('Liste des contacts')).toBeNull()
  })

  it("affiche une alerte d'erreur quand le chargement échoue", () => {
    mockUseContacts.mockReturnValue({
      contacts: [],
      isLoading: false,
      error: new Error('boom'),
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
      assignToGroup: mockAssignToGroup,
    })

    renderComponent()

    expect(
      screen.getByText(
        'Impossible de charger les contacts. Vérifiez vos permissions ou contactez un administrateur.'
      )
    ).toBeTruthy()
    expect(screen.queryByText('Liste des contacts')).toBeNull()
  })

  it("affiche l'état vide quand il n'y a aucun contact", () => {
    mockUseContacts.mockReturnValue({
      contacts: [],
      isLoading: false,
      error: null,
      addContact: mockAddContact,
      updateContact: mockUpdateContact,
      deleteContact: mockDeleteContact,
      assignToGroup: mockAssignToGroup,
    })

    renderComponent()

    expect(screen.getByText('Aucun contact')).toBeTruthy()
    expect(screen.getByText('Ajouter le premier contact')).toBeTruthy()
    expect(screen.getByText('0 contact enregistré')).toBeTruthy()
  })

  it("appelle useContacts avec l'id d'établissement fourni", () => {
    renderComponent('etab-42')

    expect(mockUseContacts).toHaveBeenCalledWith('etab-42')
  })
})