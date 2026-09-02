/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CsmComptesView } from './CsmComptesView'

const {
  ETABS,
  EMPTY_MAP,
  PROFILES_MAP,
  mockHandleUpdate,
  mockHandleAdd,
  mockHandleDelete,
  mockUseProduction,
  mockUseProfilesMap,
  editableCellProps,
  editableSelectCellProps,
  editableCheckboxCellProps,
} = vi.hoisted(() => {
  const ETABS = [
    {
      id: 'e1',
      nom: 'Clinique Alpha',
      region: 'Nord',
      statut: 'Production',
      date_signature: '2024-01-10',
      dpi: 'DPI-A',
      csm_id: 'c1',
      type_etablissement: 'Public',
      derniere_venue_site: '2024-02-01',
      contexte_csm: 'Contexte A',
      besoins_du_compte: 'Besoins A',
      prochaine_action_orga: [{ text: 'Former équipe', date: null }],
      date_action_orga: '2024-03-01',
      prochaine_action_csm: [{ text: 'Relancer', date: null }],
      date_action_csm: '2024-03-05',
      point_hebdo: 'Chaque lundi',
      modules_actifs: ['Planning', 'Dossier'],
    },
    {
      id: 'e2',
      nom: 'Hôpital Beta',
      region: 'Sud',
      statut: 'Prospect',
      date_signature: null,
      dpi: null,
      csm_id: 'c2',
      type_etablissement: 'Privé',
      derniere_venue_site: null,
      contexte_csm: null,
      besoins_du_compte: null,
      prochaine_action_orga: null,
      date_action_orga: null,
      prochaine_action_csm: null,
      date_action_csm: null,
      point_hebdo: null,
      modules_actifs: [],
    },
    {
      id: 'e3',
      nom: 'Centre Gamma',
      region: null,
      statut: 'Production',
      date_signature: '2024-02-15',
      dpi: 'DPI-G',
      csm_id: null,
      type_etablissement: 'Public',
      derniere_venue_site: '2024-02-20',
      contexte_csm: 'Contexte G',
      besoins_du_compte: 'Besoins G',
      prochaine_action_orga: [{ text: 'Audit', date: null }],
      date_action_orga: '2024-04-01',
      prochaine_action_csm: [{ text: 'Préparer comité', date: null }],
      date_action_csm: '2024-04-07',
      point_hebdo: 'Vendredi',
      modules_actifs: ['Facturation'],
    },
  ] as const

  const PROFILES_MAP = new Map([
    ['c1', { full_name: 'Charlotte Martin' }],
    ['c2', { full_name: 'Jean Dupont' }],
  ])

  const EMPTY_MAP = new Map()

  return {
    ETABS,
    EMPTY_MAP,
    PROFILES_MAP,
    mockHandleUpdate: vi.fn(),
    mockHandleAdd: vi.fn(),
    mockHandleDelete: vi.fn(),
    mockUseProduction: vi.fn(),
    mockUseProfilesMap: vi.fn(),
    editableCellProps: [] as Array<{ value: unknown; placeholder?: string; onSave: (v: string) => void }>,
    editableSelectCellProps: [] as Array<{ value: unknown; options: Array<{ value: string; label: string }>; onSave: (v: string) => void }>,
    editableCheckboxCellProps: [] as Array<{ value: boolean; onSave: (v: boolean) => void }>,
  }
})

vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: mockUseProduction,
}))

vi.mock('@/hooks/profile/useProfilesMap', () => ({
  useProfilesMap: mockUseProfilesMap,
}))

vi.mock('@/hooks/csm/useCsmComptesMutations', () => ({
  useCsmComptesMutations: () => ({
    handleUpdate: mockHandleUpdate,
    handleAdd: mockHandleAdd,
    handleDelete: mockHandleDelete,
  }),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children, className }: { children: React.ReactNode; className?: string }) => <tr className={className}>{children}</tr>,
  TableHead: ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={className}>{children}</th>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={className}>{children}</td>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: (props: {
    children: React.ReactNode
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button onClick={props.onClick} aria-label={props['aria-label']}>
      {props.children}
    </button>
  ),
}))

vi.mock('lucide-react', () => {
  const Icon = () => <svg aria-hidden="true" />
  return {
    Users: Icon,
    Building2: Icon,
    UserCheck: Icon,
    ClipboardList: Icon,
    Plus: Icon,
    Trash2: Icon,
  }
})

vi.mock('@/components/csm/EditableCell', () => ({
  EditableCell: (props: { value: unknown; placeholder?: string; onSave: (v: string) => void }) => {
    editableCellProps.push(props)
    return <span data-testid={`editable-cell-${String(props.placeholder ?? 'value')}`}>{String(props.value ?? '')}</span>
  },
}))

vi.mock('@/components/csm/EditableSelectCell', () => ({
  EditableSelectCell: (props: { value: unknown; options: Array<{ value: string; label: string }>; onSave: (v: string) => void }) => {
    editableSelectCellProps.push(props)
    return (
      <button data-testid="editable-select" onClick={() => props.onSave('Privé')}>
        {String(props.value ?? '')}
      </button>
    )
  },
}))

vi.mock('@/components/csm/EditableCheckboxCell', () => ({
  EditableCheckboxCell: (props: { value: boolean; onSave: (v: boolean) => void }) => {
    editableCheckboxCellProps.push(props)
    return (
      <button data-testid="editable-checkbox" onClick={() => props.onSave(!props.value)}>
        {String(props.value)}
      </button>
    )
  },
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

describe('CsmComptesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editableCellProps.length = 0
    editableSelectCellProps.length = 0
    editableCheckboxCellProps.length = 0
    mockUseProduction.mockReturnValue({ data: ETABS })
    mockUseProfilesMap.mockReturnValue({ map: PROFILES_MAP })
  })

  it('affiche les statistiques métier et les données du tableau', () => {
    render(<CsmComptesView />, { wrapper: createWrapper() })

    expect(screen.getByText('Total comptes')).toBeInTheDocument()
    expect(screen.getByText('Clients actifs')).toBeInTheDocument()
    expect(screen.getByText('Propriétaire Charlotte')).toBeInTheDocument()
    expect(screen.getByText('Actions en attente')).toBeInTheDocument()

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)
    expect(cards[0]).toHaveTextContent('3')
    expect(cards[0]).toHaveTextContent('Total comptes')
    expect(cards[1]).toHaveTextContent('2')
    expect(cards[1]).toHaveTextContent('Clients actifs')
    expect(cards[2]).toHaveTextContent('1')
    expect(cards[2]).toHaveTextContent('Propriétaire Charlotte')
    expect(cards[3]).toHaveTextContent('2')
    expect(cards[3]).toHaveTextContent('Actions en attente')

    expect(screen.getByText('Clinique Alpha')).toBeInTheDocument()
    expect(screen.getByText('Hôpital Beta')).toBeInTheDocument()
    expect(screen.getByText('Centre Gamma')).toBeInTheDocument()
    expect(screen.getByText('Charlotte Martin')).toBeInTheDocument()
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument()
    expect(screen.getAllByText('-').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /ajouter un compte/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /supprimer/i })).toHaveLength(3)
  })

  it('déclenche handleAdd, handleDelete et les mises à jour avec les bonnes valeurs transformées', () => {
    render(<CsmComptesView />, { wrapper: createWrapper() })

    fireEvent.click(screen.getByRole('button', { name: /ajouter un compte/i }))
    expect(mockHandleAdd).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getAllByRole('button', { name: /supprimer/i })[0])
    expect(mockHandleDelete).toHaveBeenCalledWith('e1', 'Clinique Alpha')

    fireEvent.click(screen.getAllByTestId('editable-select')[0])
    expect(mockHandleUpdate).toHaveBeenCalledWith('e1', 'type_etablissement', 'Privé')

    fireEvent.click(screen.getAllByTestId('editable-checkbox')[0])
    expect(mockHandleUpdate).toHaveBeenCalledWith('e1', 'statut', 'Prospect')

    const actionOrgaCell = editableCellProps.find((p) => p.placeholder === 'Action orga...')
    expect(actionOrgaCell).toBeDefined()
    if (actionOrgaCell) {
      actionOrgaCell.onSave('Appeler, Envoyer compte-rendu')
    }
    expect(mockHandleUpdate).toHaveBeenCalledWith('e1', 'prochaine_action_orga', [
      { text: 'Appeler', date: null },
      { text: 'Envoyer compte-rendu', date: null },
    ])

    const actionCsmCell = editableCellProps.find((p) => p.placeholder === 'Action CSM...')
    expect(actionCsmCell).toBeDefined()
    if (actionCsmCell) {
      actionCsmCell.onSave('')
    }
    expect(mockHandleUpdate).toHaveBeenCalledWith('e1', 'prochaine_action_csm', null)

    const modulesCell = editableCellProps.find((p) => p.placeholder === 'Modules...')
    expect(modulesCell).toBeDefined()
    if (modulesCell) {
      modulesCell.onSave('Module A, Module B')
    }
    expect(mockHandleUpdate).toHaveBeenCalledWith('e1', 'modules_actifs', ['Module A', 'Module B'])
  })

  it('gère les données absentes sans planter et affiche des compteurs à zéro', () => {
    mockUseProduction.mockReturnValue({ data: undefined })
    mockUseProfilesMap.mockReturnValue({ map: EMPTY_MAP })

    render(<CsmComptesView />, { wrapper: createWrapper() })

    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)
    expect(cards[0]).toHaveTextContent('0')
    expect(cards[1]).toHaveTextContent('0')
    expect(cards[2]).toHaveTextContent('0')
    expect(cards[3]).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: /ajouter un compte/i })).toBeInTheDocument()
    expect(screen.queryByText('Clinique Alpha')).not.toBeInTheDocument()
  })
})