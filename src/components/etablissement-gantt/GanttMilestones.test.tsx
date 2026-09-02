/* @vitest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GanttMilestones } from './GanttMilestones'

const { tooltipState } = vi.hoisted(() => ({
  tooltipState: {
    contents: [] as React.ReactNode[],
  },
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => {
    tooltipState.contents.push(children)
    return <div data-testid="tooltip-content">{children}</div>
  },
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: Array<string | false | null | undefined>) => args.filter(Boolean).join(' '),
}))

describe('GanttMilestones', () => {
  beforeEach(() => {
    tooltipState.contents.length = 0
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rend les jalons haute priorité et de phase avec les bonnes infos métier', () => {
    const tasks = [
      {
        id: 't1',
        titre: 'Livrable critique',
        priorite: 'high',
        echeance: '2024-01-15T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 't2',
        titre: 'Préparation lot A',
        priorite: 'medium',
        echeance: '2024-01-15T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 't3',
        titre: 'Préparation lot B',
        priorite: 'low',
        echeance: '2024-01-16T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 't4',
        titre: 'Préparation lot C',
        priorite: 'medium',
        echeance: '2024-01-17T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 'done',
        titre: 'Tâche terminée',
        priorite: 'high',
        echeance: '2024-01-18T00:00:00.000Z',
        statut: 'Terminé',
      },
    ]

    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      totalDays: 31,
    }

    const { container } = render(<GanttMilestones tasks={tasks} timeline={timeline} height={120} />)

    const markers = container.querySelectorAll('.rotate-45')
    expect(markers).toHaveLength(2)

    const lines = container.querySelectorAll('.border-l-2')
    expect(lines).toHaveLength(2)

    expect(container.querySelector('.border-destructive')).toBeTruthy()
    expect(container.querySelector('.border-primary')).toBeTruthy()
    expect(container.querySelector('.bg-destructive')).toBeTruthy()
    expect(container.querySelector('.bg-primary')).toBeTruthy()

    const positionedContainers = Array.from(container.querySelectorAll('.pointer-events-auto')) as HTMLDivElement[]
    expect(positionedContainers).toHaveLength(2)
    expect(positionedContainers[0].style.left).toBe('45.16129032258064%')
    expect(positionedContainers[0].style.height).toBe('120px')
    expect(positionedContainers[1].style.left).toBe('45.16129032258064%')

    const allText = screen.getAllByTestId('tooltip-content').map((node) => node.textContent || '')
    expect(allText.some((text) => text.includes('Livrable critique'))).toBe(true)
    expect(allText.some((text) => text.includes('Jalon : 4 tâches'))).toBe(true)
    expect(allText.some((text) => text.includes('Tâches associées:'))).toBe(true)
    expect(allText.some((text) => text.includes('Préparation lot A'))).toBe(true)
    expect(allText.some((text) => text.includes('Préparation lot B'))).toBe(true)
    expect(allText.some((text) => text.includes('+1 autre'))).toBe(true)
    expect(allText.some((text) => text.includes('Dans 5 jours'))).toBe(true)
  })

  it('n affiche rien quand aucune tâche ne produit de jalon', () => {
    const tasks = [
      {
        id: 'a1',
        titre: 'Tâche normale',
        priorite: 'low',
        echeance: '2024-01-20T00:00:00.000Z',
        statut: 'Terminé',
      },
      {
        id: 'a2',
        titre: 'Sans échéance',
        priorite: 'high',
        statut: 'En cours',
      },
      {
        id: 'a3',
        titre: 'Seulement deux tâches groupées',
        priorite: 'medium',
        echeance: '2024-01-12T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 'a4',
        titre: 'Deuxième du groupe',
        priorite: 'medium',
        echeance: '2024-01-13T00:00:00.000Z',
        statut: 'En cours',
      },
    ]

    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      totalDays: 31,
    }

    const { container } = render(<GanttMilestones tasks={tasks} timeline={timeline} height={80} />)

    expect(container.querySelectorAll('.rotate-45')).toHaveLength(0)
    expect(screen.queryByTestId('tooltip-content')).toBeNull()
  })

  it('borne les positions dans la timeline pour des dates avant et après la période', () => {
    const tasks = [
      {
        id: 'before',
        titre: 'Très en avance',
        priorite: 'high',
        echeance: '2023-12-20T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 'after1',
        titre: 'Fin 1',
        priorite: 'medium',
        echeance: '2024-03-01T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 'after2',
        titre: 'Fin 2',
        priorite: 'medium',
        echeance: '2024-03-02T00:00:00.000Z',
        statut: 'En cours',
      },
      {
        id: 'after3',
        titre: 'Fin 3',
        priorite: 'medium',
        echeance: '2024-03-03T00:00:00.000Z',
        statut: 'En cours',
      },
    ]

    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      totalDays: 31,
    }

    const { container } = render(<GanttMilestones tasks={tasks} timeline={timeline} height={60} />)

    const positionedContainers = Array.from(container.querySelectorAll('.pointer-events-auto')) as HTMLDivElement[]
    expect(positionedContainers).toHaveLength(2)
    expect(positionedContainers[0].style.left).toBe('0%')
    expect(positionedContainers[1].style.left).toBe('100%')

    const text = screen.getAllByTestId('tooltip-content').map((node) => node.textContent || '').join(' | ')
    expect(text).toContain('Très en avance')
    expect(text).toContain('Jalon : 3 tâches')
    expect(text).toContain('Il y a 21 jours')
  })
})