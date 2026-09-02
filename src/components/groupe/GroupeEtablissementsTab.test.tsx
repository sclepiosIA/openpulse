import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { ETABS, onEditEtablissement } = vi.hoisted(() => ({
  ETABS: [
    {
      id: 'eg1',
      etablissement_id: 'e1',
      est_etablissement_principal: true,
      etablissement: {
        id: 'e1',
        nom: 'Alpha College',
        ville: 'Paris',
        region: 'Île-de-France',
        type: 'Collège',
        statut: 'Prospect',
        modules_proposes: ['M1', 'M2', 'M3'],
        progression: 40,
      },
    },
    {
      id: 'eg2',
      etablissement_id: 'e2',
      est_etablissement_principal: false,
      etablissement: {
        id: 'e2',
        nom: 'Beta Lycée',
        ville: 'Lyon',
        region: 'Auvergne-Rhône-Alpes',
        type: 'Lycée',
        statut: 'Production',
        modules_proposes: ['M2'],
        progression: 80,
      },
    },
  ],
  onEditEtablissement: vi.fn(),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    'aria-label': ariaLabel,
    type,
  }: {
    children?: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    'aria-label'?: string
    type?: 'button' | 'submit' | 'reset'
  }) => (
    <button type={type ?? 'button'} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="card-description" className={className}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children?: React.ReactNode
    variant?: string
    className?: string
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}))

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children?: React.ReactNode }) => <div data-testid="collapsible">{children}</div>,
  CollapsibleTrigger: ({
    children,
    onClick,
    className,
  }: {
    children?: React.ReactNode
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    className?: string
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  CollapsibleContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}))

vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({
    children,
  }: {
    children?: React.ReactNode
    value?: string
    onValueChange?: (v: string) => void
  }) => <div data-testid="tabs">{children}</div>,
  TabsList: ({ children }: { children?: React.ReactNode }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({
    children,
    value,
    onClick,
  }: {
    children?: React.ReactNode
    value: string
    onClick?: React.MouseEventHandler<HTMLButtonElement>
  }) => (
    <button type="button" data-testid={`tabs-trigger-${value}`} onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/select', () => {
  const SelectCtx = React.createContext<{
    value?: string
    onValueChange?: (v: string) => void
  } | null>(null)

  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children?: React.ReactNode
      value?: string
      onValueChange?: (v: string) => void
    }) => <SelectCtx.Provider value={{ value, onValueChange }}>{children}</SelectCtx.Provider>,
    SelectTrigger: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div data-testid="select-trigger" className={className}>
        {children}
      </div>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children, value }: { children?: React.ReactNode; value: string }) => {
      const ctx = React.useContext(SelectCtx)
      return (
        <button type="button" data-testid={`select-item-${value}`} onClick={() => ctx?.onValueChange?.(value)}>
          {children}
        </button>
      )
    },
  }
})

vi.mock('@/components/groupe/AddEtablissementToGroupeDialog', () => ({
  AddEtablissementToGroupeDialog: ({
    groupeId,
    existingEtablissementIds,
  }: {
    groupeId: string
    existingEtablissementIds: string[]
  }) => (
    <div
      data-testid="add-etab-dialog"
      data-groupeid={groupeId}
      data-existing={existingEtablissementIds.join(',')}
    />
  ),
}))

vi.mock('@/components/etablissement/EtablissementInfo', () => ({
  EtablissementInfo: ({ etablissement }: { etablissement: { id: string; nom: string } }) => (
    <div data-testid="etablissement-info">
      {etablissement.id}:{etablissement.nom}
    </div>
  ),
}))

vi.mock('lucide-react', () => ({
  Search: (props: { className?: string }) => <svg data-testid="icon-search" className={props.className} />,
  ChevronDown: (props: { className?: string }) => <svg data-testid="icon-chevron" className={props.className} />,
  Pencil: (props: { className?: string }) => <svg data-testid="icon-pencil" className={props.className} />,
  Building2: (props: { className?: string }) => <svg data-testid="icon-building" className={props.className} />,
  LayoutGrid: (props: { className?: string }) => <svg data-testid="icon-grid" className={props.className} />,
  List: (props: { className?: string }) => <svg data-testid="icon-list" className={props.className} />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    Link: ({
      to,
      children,
      onClick,
      className,
    }: {
      to: string
      children?: React.ReactNode
      onClick?: (e: unknown) => void
      className?: string
    }) => (
      <a
        href={to}
        onClick={onClick as unknown as React.MouseEventHandler<HTMLAnchorElement>}
        className={className}
      >
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
  }
})

const { GroupeEtablissementsTab } = await import('./GroupeEtablissementsTab')

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

function renderWithClient(ui: React.ReactElement) {
  const client = createQueryClient()
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function getRenderedEtablissementOrderFromLinks() {
  const anchors = screen.getAllByRole('link')
  const names = anchors
    .map((a) => a.textContent ?? '')
    .filter((t) => t.includes('Alpha College') || t.includes('Beta Lycée'))
  return names
}

describe('GroupeEtablissementsTab', () => {
  it('affiche le skeleton de chargement quand isLoading=true', () => {
    const { container } = renderWithClient(
      <GroupeEtablissementsTab
        groupeId="g1"
        etablissements={ETABS}
        onEditEtablissement={onEditEtablissement}
        isLoading={true}
      />,
    )

    expect(screen.queryByText('Total établissements')).toBeNull()
    const pulse = container.querySelector('.animate-pulse')
    expect(pulse).not.toBeNull()
  })

  it('affiche les statistiques, la liste et permet filtrage/recherche/tri + action édition', () => {
    renderWithClient(
      <GroupeEtablissementsTab
        groupeId="g1"
        etablissements={ETABS}
        onEditEtablissement={onEditEtablissement}
        isLoading={false}
      />,
    )

    expect(screen.getByText('Total établissements')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()

    expect(screen.getByText('Progression moyenne')).toBeTruthy()
    expect(screen.getByText('60.0%')).toBeTruthy()

    expect(screen.getByText('Modules uniques')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()

    expect(screen.getByText('Alpha College')).toBeTruthy()
    expect(screen.getByText('Beta Lycée')).toBeTruthy()

    expect(screen.getAllByText('Principal').length).toBe(1)

    const addDialog = screen.getByTestId('add-etab-dialog')
    expect(addDialog.getAttribute('data-groupeid')).toBe('g1')
    expect(addDialog.getAttribute('data-existing')).toBe('e1,e2')

    fireEvent.change(screen.getByLabelText('Rechercher un établissement'), { target: { value: 'lyon' } })
    expect(screen.queryByText('Alpha College')).toBeNull()
    expect(screen.getByText('Beta Lycée')).toBeTruthy()

    fireEvent.click(screen.getByTestId('select-item-Prospect'))
    expect(screen.getByText('Aucun établissement trouvé')).toBeTruthy()

    fireEvent.click(screen.getByTestId('select-item-all'))
    expect(screen.getByText('Beta Lycée')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Rechercher un établissement'), { target: { value: '' } })
    expect(screen.getByText('Alpha College')).toBeTruthy()
    expect(screen.getByText('Beta Lycée')).toBeTruthy()

    fireEvent.click(screen.getByTestId('select-item-progression'))
    const order = getRenderedEtablissementOrderFromLinks()
    const idxBeta = order.indexOf('Beta Lycée')
    const idxAlpha = order.indexOf('Alpha College')
    expect(idxBeta).toBe(0)
    expect(idxAlpha).toBe(1)

    fireEvent.click(screen.getByLabelText("Modifier l'établissement Beta Lycée"))
    expect(onEditEtablissement).toHaveBeenCalledTimes(1)
    expect(onEditEtablissement).toHaveBeenCalledWith(ETABS[1].etablissement)

    const cards = screen.getAllByTestId('card')
    const firstCard = cards.find((c) => within(c).queryByText('Beta Lycée'))
    expect(firstCard).toBeTruthy()
    if (firstCard) {
      expect(within(firstCard).getByText('80%')).toBeTruthy()
      expect(within(firstCard).getByText('Production')).toBeTruthy()
    }
  })

  it("affiche l'état vide 'Aucun établissement' quand la liste est vide", () => {
    renderWithClient(
      <GroupeEtablissementsTab
        groupeId="g1"
        etablissements={[]}
        onEditEtablissement={onEditEtablissement}
        isLoading={false}
      />,
    )

    expect(screen.getByText('Aucun établissement')).toBeTruthy()
    expect(screen.getByText("Ce groupe ne contient pas encore d'établissement")).toBeTruthy()
  })
})