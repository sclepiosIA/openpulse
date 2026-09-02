import React, { PropsWithChildren, useContext, createContext } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const { TASK_STATUSES_MOCK } = vi.hoisted(() => ({
  TASK_STATUSES_MOCK: {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    BLOCKED: 'BLOCKED',
    DONE: 'DONE',
  },
}))

vi.mock('@/constants/taskStatuses', () => ({
  TASK_STATUSES: TASK_STATUSES_MOCK,
}))

vi.mock('@/components/ui/badge', () => {
  const Badge = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => (
    <span data-ui="badge" {...props}>{children}</span>
  )
  return { Badge }
})

vi.mock('@/components/ui/button', () => {
  const Button = ({ children, onClick, ...props }: PropsWithChildren<{ onClick?: React.MouseEventHandler<HTMLButtonElement> } & Record<string, unknown>>) => (
    <button type="button" data-ui="button" onClick={onClick} {...props}>{children}</button>
  )
  return { Button }
})

vi.mock('lucide-react', () => {
  const Icon = (name: string) => (props: Record<string, unknown>) =>
    React.createElement('svg', { 'data-icon': name, ...props })
  return {
    CheckCircle: Icon('CheckCircle'),
    Clock: Icon('Clock'),
    AlertCircle: Icon('AlertCircle'),
    Circle: Icon('Circle'),
    ChevronUp: Icon('ChevronUp'),
    ChevronDown: Icon('ChevronDown'),
  }
})

vi.mock('@/components/ui/collapsible', () => {
  type Ctx = { open?: boolean; onOpenChange?: (open: boolean) => void }
  const CollapsibleContext = createContext<Ctx>({})
  const Collapsible = ({ open, onOpenChange, children }: PropsWithChildren<{ open?: boolean; onOpenChange?: (open: boolean) => void }>) => (
    <CollapsibleContext.Provider value={{ open, onOpenChange }}>{children}</CollapsibleContext.Provider>
  )

  const CollapsibleTrigger = ({ asChild, children }: PropsWithChildren<{ asChild?: boolean }>) => {
    const ctx = useContext(CollapsibleContext)
    const child = React.Children.only(children) as React.ReactElement<any>
    const handleClick: React.MouseEventHandler = (e) => {
      if (child.props && typeof child.props.onClick === 'function') child.props.onClick(e)
      if (ctx.onOpenChange) ctx.onOpenChange(!ctx.open)
    }
    return React.cloneElement(child, { ...child.props, onClick: handleClick, 'data-collapsible-trigger': 'true' })
  }

  const CollapsibleContent = ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => {
    const ctx = useContext(CollapsibleContext)
    if (!ctx.open) return null
    return React.createElement('div', { 'data-collapsible-content': 'true', ...props }, children)
  }

  return { Collapsible, CollapsibleTrigger, CollapsibleContent }
})

import { GanttLegend } from './GanttLegend'

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('GanttLegend', () => {
  it('affiche le total de tâches et le badge de retard lorsque des tâches sont en retard', () => {
    const tasks = [
      { statut: TASK_STATUSES_MOCK.TODO, echeance: '2999-01-01' },
      { statut: TASK_STATUSES_MOCK.IN_PROGRESS, echeance: '2000-01-01' }, // overdue
      { statut: TASK_STATUSES_MOCK.IN_PROGRESS, echeance: '2999-01-01' },
      { statut: TASK_STATUSES_MOCK.BLOCKED, echeance: null },
      { statut: TASK_STATUSES_MOCK.DONE, echeance: '2000-01-01' }, // done not overdue
    ]
    const { container } = renderWithClient(<GanttLegend tasks={tasks as any} />)

    expect(screen.getByText('5 tâches')).toBeInTheDocument()
    expect(screen.getByText('1 retard')).toBeInTheDocument()

    // Initialement fermé: ChevronUp visible, ChevronDown absent
    expect(container.querySelector('svg[data-icon="ChevronUp"]')).not.toBeNull()
    expect(container.querySelector('svg[data-icon="ChevronDown"]')).toBeNull()

    // Le contenu détaillé est masqué tant que fermé
    expect(screen.queryByText('À faire (1)')).toBeNull()
    expect(screen.queryByText('En cours (2)')).toBeNull()
    expect(screen.queryByText('Bloqué (1)')).toBeNull()
    expect(screen.queryByText('Terminé (1)')).toBeNull()
  })

  it('déplie/ replie le contenu via le trigger et met à jour l’icône', () => {
    const tasks = [
      { statut: TASK_STATUSES_MOCK.TODO, echeance: null },
      { statut: TASK_STATUSES_MOCK.IN_PROGRESS, echeance: '2999-01-01' },
      { statut: TASK_STATUSES_MOCK.DONE, echeance: '2000-01-01' },
      { statut: TASK_STATUSES_MOCK.BLOCKED, echeance: null },
    ]
    const { container } = renderWithClient(<GanttLegend tasks={tasks as any} />)

    const triggerButton = screen.getByRole('button')
    fireEvent.click(triggerButton)

    // Après ouverture
    expect(container.querySelector('svg[data-icon="ChevronUp"]')).toBeNull()
    expect(container.querySelector('svg[data-icon="ChevronDown"]')).not.toBeNull()

    // Contenu détaillé visible
    expect(screen.getByText('À faire (1)')).toBeInTheDocument()
    expect(screen.getByText('En cours (1)')).toBeInTheDocument()
    expect(screen.getByText('Bloqué (1)')).toBeInTheDocument()
    expect(screen.getByText('Terminé (1)')).toBeInTheDocument()

    // Légende des priorités
    expect(screen.getByText('Priorité :')).toBeInTheDocument()
    expect(screen.getByText('Haute')).toBeInTheDocument()
    expect(screen.getByText('Moyenne')).toBeInTheDocument()
    expect(screen.getByText('Basse')).toBeInTheDocument()

    // Replier
    fireEvent.click(triggerButton)
    expect(container.querySelector('svg[data-icon="ChevronUp"]')).not.toBeNull()
    expect(container.querySelector('svg[data-icon="ChevronDown"]')).toBeNull()
    expect(screen.queryByText('À faire (1)')).toBeNull()
  })

  it('n’affiche pas le badge de retard lorsque aucun retard', () => {
    const tasks = [
      { statut: TASK_STATUSES_MOCK.TODO, echeance: '2999-01-01' },
      { statut: TASK_STATUSES_MOCK.DONE, echeance: '2000-01-01' },
      { statut: TASK_STATUSES_MOCK.BLOCKED, echeance: null },
    ]
    renderWithClient(<GanttLegend tasks={tasks as any} />)

    expect(screen.getByText('3 tâches')).toBeInTheDocument()
    expect(screen.queryByText(/retard/)).toBeNull()
  })

  it('gère correctement le singulier/pluriel pour le total', () => {
    const single = [{ statut: TASK_STATUSES_MOCK.TODO, echeance: null }]
    renderWithClient(<GanttLegend tasks={single as any} />)
    expect(screen.getByText('1 tâche')).toBeInTheDocument()
  })
})