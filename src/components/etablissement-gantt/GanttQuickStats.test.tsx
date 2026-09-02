import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Task } from '@/types/gantt'

const { MockBadge, mockCn, MockIcon } = vi.hoisted(() => ({
  MockBadge: ({
    children,
    onClick,
    className,
    variant
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
    variant?: string
  }) => React.createElement('button', { onClick, className, type: 'button', 'data-variant': variant }, children),
  mockCn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
  MockIcon: (props: Record<string, unknown>) => React.createElement('svg', { 'data-mock-icon': true, ...props })
}))

vi.mock('@/components/ui/badge', () => ({ Badge: MockBadge }))
vi.mock('@/lib/utils', () => ({ cn: mockCn }))
vi.mock('lucide-react', () => {
  const Icon = MockIcon
  return {
    BarChart3: Icon,
    AlertTriangle: Icon,
    Zap: Icon,
    Clock: Icon,
    Users: Icon
  }
})

import { GanttQuickStats } from './GanttQuickStats'

describe('GanttQuickStats', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2024-01-15T00:00:00.000Z'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanup()
  })

  it('calcule et affiche correctement les statistiques et gère les clics', () => {
    const onStatClick = vi.fn()
    const tasks = [
      { id: 't1', statut: 'Terminé', echeance: '2024-01-10T00:00:00.000Z', responsable_id: 'u3' },
      { id: 't2', statut: 'En cours', echeance: '2024-01-14T00:00:00.000Z', responsable_id: 'u1' },
      { id: 't3', statut: 'En cours', echeance: '2024-01-15T00:00:00.000Z', responsable_id: 'u2' },
      { id: 't4', statut: 'En cours', echeance: '2024-01-16T00:00:00.000Z', responsable_id: 'u1' },
      { id: 't5', statut: 'Bloqué', echeance: '2024-01-18T00:00:00.000Z', responsable_id: null },
      { id: 't6', statut: 'Terminé', echeance: null, responsable_id: null }
    ]

    render(<GanttQuickStats tasks={tasks as unknown as Task[]} onStatClick={onStatClick} />)

    expect(screen.getByText('33% complété')).toBeTruthy()
    expect(screen.getByText('1 en retard')).toBeTruthy()
    expect(screen.getByText('3 en cours')).toBeTruthy()
    expect(screen.getByText("Aujourd'hui")).toBeTruthy()
    expect(screen.getByText('3 personnes')).toBeTruthy()
    expect(screen.getByText('6 tâches au total')).toBeTruthy()

    fireEvent.click(screen.getByText('33% complété'))
    fireEvent.click(screen.getByText('1 en retard'))
    fireEvent.click(screen.getByText('3 en cours'))
    fireEvent.click(screen.getByText("Aujourd'hui"))

    expect(onStatClick).toHaveBeenNthCalledWith(1, 'completed')
    expect(onStatClick).toHaveBeenNthCalledWith(2, 'overdue')
    expect(onStatClick).toHaveBeenNthCalledWith(3, 'in_progress')
    expect(onStatClick).toHaveBeenNthCalledWith(4, 'upcoming')
  })

  it('n’affiche pas les badges optionnels quand leurs valeurs sont nulles et applique le style succès à ≥75%', () => {
    const tasks = [
      { id: 't1', statut: 'Terminé', echeance: '2024-01-10T00:00:00.000Z', responsable_id: null },
      { id: 't2', statut: 'Terminé', echeance: '2024-01-12T00:00:00.000Z', responsable_id: null }
    ]

    render(<GanttQuickStats tasks={tasks as unknown as Task[]} />)

    const completedBtn = screen.getByText('100% complété').closest('button')
    expect(completedBtn).toBeTruthy()
    expect((completedBtn?.getAttribute('class') || '')).toContain('border-success/50')

    expect(screen.queryByText(/en retard/)).toBeNull()
    expect(screen.queryByText(/en cours/)).toBeNull()
    expect(screen.queryByText("Aujourd'hui")).toBeNull()
    expect(screen.queryByText('Demain')).toBeNull()
    expect(screen.queryByText(/j restants/)).toBeNull()
    expect(screen.queryByText(/personne/)).toBeNull()
    expect(screen.getByText('2 tâches au total')).toBeTruthy()
  })

  it('affiche "Demain" pour la prochaine deadline à J+1 et "1 personne" au singulier', () => {
    const tasks = [
      { id: 't1', statut: 'En cours', echeance: '2024-01-16T00:00:00.000Z', responsable_id: 'u1' },
      { id: 't2', statut: 'Terminé', echeance: '2024-01-12T00:00:00.000Z', responsable_id: 'u1' }
    ]
    render(<GanttQuickStats tasks={tasks as unknown as Task[]} />)

    expect(screen.getByText('Demain')).toBeTruthy()
    expect(screen.getByText('1 personne')).toBeTruthy()
    expect(screen.getByText('2 tâches au total')).toBeTruthy()
  })

  it('affiche "3j restants" pour une deadline à J+3 et gère le singulier "1 tâche au total"', () => {
    const tasks = [
      { id: 't1', statut: 'En cours', echeance: '2024-01-18T00:00:00.000Z', responsable_id: null }
    ]
    render(<GanttQuickStats tasks={tasks as unknown as Task[]} />)

    expect(screen.getByText('3j restants')).toBeTruthy()
    expect(screen.getByText('1 tâche au total')).toBeTruthy()
  })
})