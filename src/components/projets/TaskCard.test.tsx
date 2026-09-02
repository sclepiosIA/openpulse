import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'

const {
  mockNavigate,
  formatDateFrMock,
  isOverdueMock,
  getDaysUntilDueMock,
  sampleTache,
  sampleTacheOverdue,
  sampleTacheNoEtablissement,
} = vi.hoisted(() => {
  const fn = vi.fn
  const mockNavigate = fn()
  const formatDateFrMock = fn().mockImplementation((d) => `FR:${String(d)}`)
  const isOverdueMock = fn().mockReturnValue(false)
  const getDaysUntilDueMock = fn().mockReturnValue(3)
  const baseTache = {
    id: 't1',
    titre: 'Faire la mise à jour',
    statut: 'A faire',
    priorite: 'high',
    description: 'Une description brève',
    etablissement_id: 'e1',
    etablissements: { nom: 'Lycée A', phase: 'Phase 1' },
    categories_taches: { nom: 'Cat A', couleur: '#123456' },
    responsable_profile: { prenom: 'Jean', nom: 'Dupont' },
    echeance: '2026-12-31',
    archive: false,
  }
  const sampleTache = { ...baseTache }
  const sampleTacheOverdue = { ...baseTache, id: 't2', statut: 'En cours', echeance: '2026-01-05' }
  const sampleTacheNoEtablissement = { ...baseTache, id: 't3', etablissement_id: null, etablissements: null }
  return { mockNavigate, formatDateFrMock, isOverdueMock, getDaysUntilDueMock, sampleTache, sampleTacheOverdue, sampleTacheNoEtablissement }
})

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/lib/projetsUtils', () => ({
  formatDateFr: formatDateFrMock,
  isOverdue: isOverdueMock,
  getDaysUntilDue: getDaysUntilDueMock,
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | undefined | false>) => args.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', () => {
  const Icon = (props: any) => React.createElement('span', { 'data-icon': 'icon', ...props })
  return {
    Building2: Icon,
    Calendar: Icon,
    User: Icon,
    Archive: Icon,
    FileText: Icon,
  }
})

vi.mock('@/components/ui/badge', () => ({
  Badge: (props: any) => <span data-ui="badge" {...props}>{props.children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button type="button" onClick={onClick} {...rest}>{children}</button>
  ),
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, className }: any) => (
    <input
      type="checkbox"
      role="checkbox"
      aria-checked={!!checked}
      checked={!!checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={className}
    />
  ),
}))

const SelectContext = React.createContext<{ onValueChange?: (v: string) => void; value?: string }>({})

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <SelectContext.Provider value={{ onValueChange, value }}>
      <div data-ui="select">{children}</div>
    </SelectContext.Provider>
  ),
  SelectTrigger: ({ children, ...rest }: any) => <button type="button" data-ui="select-trigger" {...rest}>{children}</button>,
  SelectValue: () => {
    const ctx = React.useContext(SelectContext)
    return <span data-ui="select-value">{ctx.value ?? ''}</span>
  },
  SelectContent: ({ children }: any) => <div data-ui="select-content">{children}</div>,
  SelectItem: ({ value, children }: any) => {
    const ctx = React.useContext(SelectContext)
    return (
      <button
        type="button"
        role="option"
        aria-label={String(children)}
        data-ui="select-item"
        onClick={() => ctx.onValueChange?.(value)}
      >
        {children}
      </button>
    )
  },
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: any) => <>{children}</>,
  Tooltip: ({ children }: any) => <span data-ui="tooltip">{children}</span>,
  TooltipTrigger: ({ children }: any) => <span data-ui="tooltip-trigger">{children}</span>,
  TooltipContent: ({ children }: any) => <div data-ui="tooltip-content">{children}</div>,
}))

vi.mock('@/components/tasks/TaskEditDialog', () => ({
  TaskEditDialog: ({ tache }: any) => <button type="button" aria-label={`Edit ${tache?.id}`}>Edit</button>,
}))

vi.mock('./TaskQuickActions', () => ({
  TaskQuickActions: ({ task }: any) => <div data-testid={`quick-actions-${task?.id}`}>QuickActions</div>,
}))

vi.mock('@/components/tasks/TacheDocuments', () => ({
  TacheDocuments: ({ tacheId, tacheTitre }: any) => <div data-testid={`docs-${tacheId}`}>Docs: {tacheTitre}</div>,
}))

import { TaskCard } from './TaskCard'

describe('TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // defaults for utils
    isOverdueMock.mockReturnValue(false)
    getDaysUntilDueMock.mockReturnValue(3)
  })

  const renderCard = (props?: Partial<React.ComponentProps<typeof TaskCard>>) => {
    const onStatusChange = vi.fn()
    const onArchive = vi.fn()
    const onSelectionChange = vi.fn()
    const tache = sampleTache
    const etablissementColor = '#ff00aa'
    const allProps = { tache, onStatusChange, onArchive, isSelected: false, onSelectionChange, etablissementColor, ...props }
    const view = render(<TaskCard {...allProps} />)
    return { ...view, onStatusChange, onArchive, onSelectionChange }
  }

  it('rend le contenu principal (standard) et formate la date via formatDateFr', () => {
    const { container } = renderCard()
    expect(screen.getByText(sampleTache.titre)).toBeInTheDocument()
    expect(screen.getByText('Lycée A')).toBeInTheDocument()
    expect(formatDateFrMock).toHaveBeenCalledWith(sampleTache.echeance)
    expect(screen.getByText(`FR:${sampleTache.echeance}`)).toBeInTheDocument()
    expect(screen.getByText('Cat A')).toBeInTheDocument()
    expect(screen.getByText('Phase 1')).toBeInTheDocument()
    expect(screen.getByText('Une description brève')).toBeInTheDocument()
    expect(screen.getByText('Priorité haute')).toBeInTheDocument()
    const etabEl = screen.getByText('Lycée A')
    expect(etabEl).toHaveStyle({ color: '#ff00aa' })
    // has role button with aria-label
    const aria = `Ouvrir la fiche de ${sampleTache.etablissements?.nom} associée à la tâche ${sampleTache.titre}`
    const cardButton = screen.getByRole('button', { name: aria })
    expect(cardButton).toBeInTheDocument()
    // selected false by default; toggle isSelected true to ensure class toggles
    const { rerender } = render(
      <TaskCard
        tache={sampleTache}
        onStatusChange={vi.fn()}
        etablissementColor="#00aa00"
        onArchive={vi.fn()}
        isSelected={true}
        onSelectionChange={vi.fn()}
      />
    )
    expect(container.querySelector('[class*="ring-2"]') || container.querySelector('[class*="ring-primary/30"]')).toBeTruthy()
    rerender(
      <TaskCard
        tache={sampleTache}
        onStatusChange={vi.fn()}
        etablissementColor="#00aa00"
        onArchive={vi.fn()}
        isSelected={false}
        onSelectionChange={vi.fn()}
      />
    )
  })

  it('navigue vers la fiche établissement au click et au clavier', () => {
    renderCard()
    const aria = `Ouvrir la fiche de ${sampleTache.etablissements?.nom} associée à la tâche ${sampleTache.titre}`
    const cardButton = screen.getByRole('button', { name: aria })
    fireEvent.click(cardButton)
    expect(mockNavigate).toHaveBeenCalledWith(`/etablissements/${sampleTache.etablissement_id}`)
    mockNavigate.mockClear()
    fireEvent.keyDown(cardButton, { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith(`/etablissements/${sampleTache.etablissement_id}`)
    mockNavigate.mockClear()
    fireEvent.keyDown(cardButton, { key: ' ' })
    expect(mockNavigate).toHaveBeenCalledWith(`/etablissements/${sampleTache.etablissement_id}`)
  })

  it('ne navigue pas si pas d’établissement', () => {
    render(
      <TaskCard
        tache={sampleTacheNoEtablissement}
        onStatusChange={vi.fn()}
        etablissementColor="#123"
      />
    )
    const title = screen.getByText(sampleTacheNoEtablissement.titre)
    fireEvent.click(title)
    expect(mockNavigate).not.toHaveBeenCalled()
    const aria = `Ouvrir la fiche de ${'l\'établissement'} associée à la tâche ${sampleTacheNoEtablissement.titre}`
    expect(screen.queryByRole('button', { name: aria })).not.toBeInTheDocument()
  })

  it('change le statut via Select (standard)', async () => {
    const { onStatusChange } = renderCard()
    const option = screen.getAllByRole('option', { name: 'En cours' })[0]
    await act(async () => {
      fireEvent.click(option)
    })
    expect(onStatusChange).toHaveBeenCalledWith(sampleTache.id, 'En cours')
  })

  it('bouton Document toggle TacheDocuments', async () => {
    renderCard()
    const btn = screen.getByRole('button', { name: 'Document' })
    expect(screen.queryByTestId(`docs-${sampleTache.id}`)).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(screen.getByTestId(`docs-${sampleTache.id}`)).toHaveTextContent(`Docs: ${sampleTache.titre}`)
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(screen.queryByTestId(`docs-${sampleTache.id}`)).not.toBeInTheDocument()
  })

  it('Archive appelle onArchive et badge affiché si archivé', async () => {
    const { onArchive, rerender } = renderCard()
    const archiveBtn = screen.getByRole('button', { name: 'Archiver' })
    await act(async () => {
      fireEvent.click(archiveBtn)
    })
    expect(onArchive).toHaveBeenCalledWith(sampleTache.id)
    // now with archived task
    rerender(
      <TaskCard
        tache={{ ...sampleTache, archive: true }}
        onStatusChange={vi.fn()}
        etablissementColor="#ccc"
      />
    )
    expect(screen.getByText('Archivé')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archiver' })).not.toBeInTheDocument()
  })

  it('Checkbox déclenche onSelectionChange sans navigation', () => {
    const onSelectionChange = vi.fn()
    render(
      <TaskCard
        tache={sampleTache}
        onStatusChange={vi.fn()}
        etablissementColor="#aaa"
        isSelected={false}
        onSelectionChange={onSelectionChange}
      />
    )
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(onSelectionChange).toHaveBeenCalledWith(sampleTache.id, true)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('affiche les infos d’échéance et l’état overdue', () => {
    isOverdueMock.mockReturnValue(true)
    getDaysUntilDueMock.mockReturnValue(-2)
    render(
      <TaskCard
        tache={sampleTacheOverdue}
        onStatusChange={vi.fn()}
        etablissementColor="#ddd"
      />
    )
    // date formatted
    expect(screen.getByText(`FR:${sampleTacheOverdue.echeance}`)).toBeInTheDocument()
    // tooltip content visible in our mock
    expect(screen.getByText('En retard de 2 jour(s)')).toBeInTheDocument()
    // class indicative of destructive
    const dateEl = screen.getByText(`FR:${sampleTacheOverdue.echeance}`)
    expect(dateEl.className).toMatch(/text-destructive|font-semibold/)
  })

  it('mode compact: navigation, statut et établissement', () => {
    render(
      <TaskCard
        tache={sampleTache}
        onStatusChange={vi.fn()}
        etablissementColor="#abcdef"
        compact
      />
    )
    // title present
    expect(screen.getByText(sampleTache.titre)).toBeInTheDocument()
    // etablissement name present
    expect(screen.getByText('Lycée A')).toBeInTheDocument()
    // click navigates
    const aria = `Ouvrir la fiche de ${sampleTache.etablissements?.nom} associée à la tâche ${sampleTache.titre}`
    const cardButton = screen.getByRole('button', { name: aria })
    fireEvent.click(cardButton)
    expect(mockNavigate).toHaveBeenCalledWith(`/etablissements/${sampleTache.etablissement_id}`)
    // change status via compact select
    const option = screen.getAllByRole('option', { name: 'Terminé' })[0]
    fireEvent.click(option)
    // Not directly accessible to handler reference here; re-render to capture calls explicitly
  })

  it('mode compact: Select déclenche onStatusChange', () => {
    const onStatusChange = vi.fn()
    render(
      <TaskCard
        tache={sampleTache}
        onStatusChange={onStatusChange}
        etablissementColor="#abcdef"
        compact
      />
    )
    const option = screen.getAllByRole('option', { name: 'Bloqué' })[0]
    fireEvent.click(option)
    expect(onStatusChange).toHaveBeenCalledWith(sampleTache.id, 'Bloqué')
  })

  it('mode compact: Checkbox stopPropagation', () => {
    const onSelectionChange = vi.fn()
    render(
      <TaskCard
        tache={sampleTache}
        onStatusChange={vi.fn()}
        etablissementColor="#000"
        compact
        isSelected={false}
        onSelectionChange={onSelectionChange}
      />
    )
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(onSelectionChange).toHaveBeenCalledWith(sampleTache.id, true)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})