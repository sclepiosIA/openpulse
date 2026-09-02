// @vitest-environment jsdom
import React from 'react'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CsmContactsView } from './CsmContactsView'

const {
  ETABS,
  CONTACTS,
  EMPTY_CONTACTS,
  mockFrom,
  mockIn,
  mockOrder,
  mockLimit,
  mockHandleAdd,
  mockHandleDelete,
  mockHandleUpdate,
  productionState,
  queryResponse,
} = vi.hoisted(() => ({
  ETABS: [
    { id: 'etab-1', nom: 'Clinique Alpha' },
    { id: 'etab-2', nom: 'Centre Beta' },
  ],
  CONTACTS: [
    {
      id: 'c1',
      etablissement_id: 'etab-1',
      nom: 'Durand',
      prenom: 'Alice',
      email: 'alice@example.test',
      telephone: '0102030405',
      fonction: 'Directrice',
      influence: 'Fort',
      engagement: 'Moyen',
      est_contact_principal: false,
      interlocuteur_csm: true,
      niveau_contact: null,
      type_contact: null,
    },
    {
      id: 'c2',
      etablissement_id: 'etab-1',
      nom: 'Martin',
      prenom: 'Bob',
      email: 'bob@example.test',
      telephone: '0607080910',
      fonction: 'Responsable',
      influence: 'Faible',
      engagement: '',
      est_contact_principal: false,
      interlocuteur_csm: false,
      niveau_contact: null,
      type_contact: null,
    },
  ],
  EMPTY_CONTACTS: [],
  mockFrom: vi.fn(),
  mockIn: vi.fn(),
  mockOrder: vi.fn(),
  mockLimit: vi.fn(),
  mockHandleAdd: vi.fn(),
  mockHandleDelete: vi.fn(),
  mockHandleUpdate: vi.fn(),
  productionState: { data: [] as Array<{ id: string; nom: string }> | undefined },
  queryResponse: {
    data: [] as Array<{
      id: string
      etablissement_id: string
      nom: string
      prenom: string
      email: string
      telephone: string
      fonction: string
      influence: string
      engagement: string
      est_contact_principal: boolean
      interlocuteur_csm: boolean
      niveau_contact: null
      type_contact: null
    }> | null,
    error: null as { message: string } | null,
  },
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children, ...props }: { children: React.ReactNode }) => <tr {...props}>{children}</tr>,
  TableHead: ({ children, ...props }: { children: React.ReactNode }) => <th {...props}>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock('lucide-react', () => ({
  Plus: () => <span aria-hidden="true">+</span>,
  Trash2: () => <span aria-hidden="true">x</span>,
}))

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: ({
    value,
    placeholder,
    onSave,
  }: {
    value: string | null | undefined
    placeholder: string
    onSave: (value: string) => void
  }) => (
    <button data-testid={`editable-${placeholder}-${value ?? 'empty'}`} onClick={() => onSave(`saved:${placeholder}`)}>
      {value ?? placeholder}
    </button>
  ),
}))

vi.mock('@/components/csm/EditableSelectCell', () => ({
  EditableSelectCell: ({
    value,
    onSave,
  }: {
    value: string | null | undefined
    options: Array<{ value: string; label: string }>
    onSave: (value: string) => void
  }) => (
    <button data-testid={`select-${value ?? 'empty'}`} onClick={() => onSave('Fort')}>
      {value ?? '-'}
    </button>
  ),
}))

vi.mock('@/components/csm/EditableCheckboxCell', () => ({
  EditableCheckboxCell: ({
    value,
    onSave,
  }: {
    value: boolean
    onSave: (value: boolean) => void
  }) => (
    <button data-testid={`checkbox-${String(value)}`} onClick={() => onSave(!value)}>
      {String(value)}
    </button>
  ),
}))

vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: vi.fn(() => productionState),
}))

vi.mock('@/hooks/csm/useCsmContactsMutations', () => ({
  useCsmContactsMutations: vi.fn(() => ({
    handleUpdate: mockHandleUpdate,
    handleAdd: mockHandleAdd,
    handleDelete: mockHandleDelete,
  })),
}))

vi.mock('@/lib/supabaseBrowser', () => {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: (...args: unknown[]) => mockIn(...args),
    order: (...args: unknown[]) => mockOrder(...args),
    limit: (...args: unknown[]) => mockLimit(...args),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(queryResponse)),
    maybeSingle: vi.fn(() => Promise.resolve(queryResponse)),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(queryResponse).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) => Promise.resolve(queryResponse).catch(onRejected),
  }

  mockIn.mockImplementation(() => builder)
  mockOrder.mockImplementation(() => builder)
  mockLimit.mockImplementation(() => Promise.resolve(queryResponse))
  mockFrom.mockImplementation(() => builder)

  return {
    supabase: {
      from: mockFrom,
    },
  }
})

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 0,
        gcTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}

function renderView() {
  const queryClient = createClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <CsmContactsView />
    </QueryClientProvider>,
  )
}

describe('CsmContactsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    productionState.data = ETABS
    queryResponse.data = CONTACTS
    queryResponse.error = null
  })

  it('affiche les groupes par établissement, les compteurs et les contacts chargés', async () => {
    renderView()

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('contacts')
    })

    expect(mockIn).toHaveBeenCalledWith('etablissement_id', ['etab-1', 'etab-2'])
    expect(mockOrder).toHaveBeenCalledWith('nom')
    expect(mockLimit).toHaveBeenCalledWith(500)

    expect(await screen.findByText('Clinique Alpha')).toBeInTheDocument()
    expect(screen.getByText('Centre Beta')).toBeInTheDocument()

    expect(screen.getByText('(2)')).toBeInTheDocument()
    expect(screen.getByText('(0)')).toBeInTheDocument()

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Durand')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Martin')).toBeInTheDocument()
    expect(screen.getByText('Directrice')).toBeInTheDocument()
    expect(screen.getByText('Responsable')).toBeInTheDocument()
    expect(screen.getByText('alice@example.test')).toBeInTheDocument()
    expect(screen.getByText('0102030405')).toBeInTheDocument()
  })

  it('déclenche les mutations add, update et delete avec les bonnes valeurs métier', async () => {
    renderView()

    await screen.findByText('Clinique Alpha')
    await screen.findByText('Alice')

    await act(async () => {
      fireEvent.click(screen.getAllByText('Ajouter')[0])
    })
    expect(mockHandleAdd).toHaveBeenCalledWith('etab-1')

    await act(async () => {
      fireEvent.click(screen.getByTestId('editable-Prénom-Alice'))
    })
    expect(mockHandleUpdate).toHaveBeenCalledWith('c1', 'prenom', 'saved:Prénom')

    await act(async () => {
      fireEvent.click(screen.getByTestId('checkbox-true'))
    })
    expect(mockHandleUpdate).toHaveBeenCalledWith('c1', 'interlocuteur_csm', false)

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('Supprimer')[0])
    })
    expect(mockHandleDelete).toHaveBeenCalledWith('c1')
  })

  it('affiche des groupes vides quand la requête renvoie zéro contact', async () => {
    queryResponse.data = EMPTY_CONTACTS

    renderView()

    expect(await screen.findByText('Clinique Alpha')).toBeInTheDocument()
    expect(screen.getByText('Centre Beta')).toBeInTheDocument()

    const zeroCounters = screen.getAllByText('(0)')
    expect(zeroCounters).toHaveLength(2)
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })

  it('ne lance pas la requête et ne rend rien si aucun établissement n’est disponible', async () => {
    productionState.data = undefined

    const { container } = renderView()

    await waitFor(() => {
      expect(mockFrom).not.toHaveBeenCalled()
    })

    expect(container.textContent).toBe('')
  })

  it('n affiche aucun contact et conserve les groupes quand la requête échoue', async () => {
    queryResponse.data = null
    queryResponse.error = { message: 'x' }

    renderView()

    expect(await screen.findByText('Clinique Alpha')).toBeInTheDocument()
    expect(screen.getByText('Centre Beta')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('(0)')).toHaveLength(2)
    })

    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    expect(screen.queryByText('Durand')).not.toBeInTheDocument()
  })
})