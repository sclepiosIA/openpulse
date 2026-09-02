import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { GanttRecurringTaskRow } from './GanttRecurringTaskRow'

const { ROLE_COLOR, getRoleColorMock, getRoleLabelMock } = vi.hoisted(() => ({
  ROLE_COLOR: { hex: '#12ab34' },
  getRoleColorMock: vi.fn(() => ({ hex: '#12ab34' })),
  getRoleLabelMock: vi.fn(() => 'Responsable')
}))

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode; side?: string; className?: string }) => (
    <div>{children}</div>
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className
  }: {
    children: React.ReactNode
    variant?: string
    className?: string
  }) => (
    <div data-variant={variant} className={className}>
      {children}
    </div>
  )
}))

vi.mock('lucide-react', () => ({
  Repeat: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="repeat-icon" {...props} />,
  CheckCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="check-icon" {...props} />,
  Clock: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="clock-icon" {...props} />,
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="alert-icon" {...props} />,
  Circle: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="circle-icon" {...props} />
}))

vi.mock('@/lib/roleColors', () => ({
  getRoleColor: getRoleColorMock,
  getRoleLabel: getRoleLabelMock
}))

describe('GanttRecurringTaskRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRoleColorMock.mockReturnValue(ROLE_COLOR)
    getRoleLabelMock.mockReturnValue('Responsable')
  })

  it('render les occurrences, les labels, le résumé et appelle onTaskClick avec la bonne occurrence', () => {
    const onTaskClick = vi.fn()

    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      pixelsPerDay: 50
    }

    const parentTask = {
      titre: 'Tâche récurrente ménage'
    }

    const occurrences = [
      {
        id: 'occ-1',
        date_debut: '2024-01-02T00:00:00.000Z',
        echeance: '2024-01-05T00:00:00.000Z',
        statut: 'Terminé',
        created_at: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'occ-2',
        date_debut: '2024-01-10T00:00:00.000Z',
        echeance: '2024-01-11T00:00:00.000Z',
        statut: 'En cours',
        created_at: '2024-01-09T00:00:00.000Z'
      }
    ]

    const { container } = render(
      <GanttRecurringTaskRow
        parentTask={parentTask}
        occurrences={occurrences}
        timeline={timeline}
        onTaskClick={onTaskClick}
        categoryColor="#ff00aa"
        responsableRole="manager"
      />
    )

    expect(getRoleColorMock).toHaveBeenCalledWith('manager')
    expect(getRoleLabelMock).toHaveBeenCalledWith('manager')

    expect(screen.getAllByText('Tâche récurrente ménage')).toHaveLength(2)
    expect(screen.getByText('Occurrence 1/2')).toBeInTheDocument()
    expect(screen.getByText('Occurrence 2/2')).toBeInTheDocument()
    expect(screen.getByText('Statut : Terminé')).toBeInTheDocument()
    expect(screen.getByText('Statut : En cours')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()

    expect(screen.getByText('02/01')).toBeInTheDocument()

    const clickableBars = Array.from(container.querySelectorAll('div')).filter((el) => {
      const style = el.getAttribute('style') || ''
      return style.includes('border-left-color: rgb(255, 0, 170)') || style.includes('border-left-color: #ff00aa')
    })

    expect(clickableBars).toHaveLength(2)
    expect(clickableBars[0].getAttribute('style')).toContain('left: 50px')
    expect(clickableBars[0].getAttribute('style')).toContain('width: 150px')
    expect(clickableBars[0].getAttribute('style')).toContain('border-left-width: 3px')
    expect(clickableBars[1].getAttribute('style')).toContain('left: 450px')
    expect(clickableBars[1].getAttribute('style')).toContain('width: 50px')

    const roleBars = Array.from(container.querySelectorAll('div')).filter((el) => {
      const style = el.getAttribute('style') || ''
      return style.includes('background-color: rgb(18, 171, 52)') || style.includes('background-color: #12ab34')
    })

    expect(roleBars).toHaveLength(2)
    expect(roleBars[0]).toHaveAttribute('title', 'Responsable')

    fireEvent.click(clickableBars[1])
    expect(onTaskClick).toHaveBeenCalledTimes(1)
    expect(onTaskClick).toHaveBeenCalledWith(occurrences[1])
  })

  it('affiche une icône pour les petites barres, applique le style hover et le badge de retard', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-20T00:00:00.000Z'))

    const onTaskClick = vi.fn()

    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      pixelsPerDay: 20
    }

    const parentTask = {
      titre: 'Suivi quotidien'
    }

    const occurrences = [
      {
        id: 'occ-a',
        date_debut: '2024-01-03T00:00:00.000Z',
        echeance: '2024-01-04T00:00:00.000Z',
        statut: 'A faire',
        created_at: '2024-01-03T00:00:00.000Z'
      },
      {
        id: 'occ-b',
        date_debut: '2024-01-05T00:00:00.000Z',
        echeance: '2024-01-06T00:00:00.000Z',
        statut: 'Bloqué',
        created_at: '2024-01-05T00:00:00.000Z'
      }
    ]

    const { container } = render(
      <GanttRecurringTaskRow
        parentTask={parentTask}
        occurrences={occurrences}
        timeline={timeline}
        onTaskClick={onTaskClick}
        responsableRole={null}
      />
    )

    expect(screen.queryByText('03/01')).not.toBeInTheDocument()
    expect(screen.getByText('2 retard')).toBeInTheDocument()
    expect(screen.getByText('0/2')).toBeInTheDocument()
    expect(screen.getByTestId('circle-icon')).toBeInTheDocument()
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()

    const clickableBars = Array.from(container.querySelectorAll('div')).filter((el) => {
      const className = el.getAttribute('class') || ''
      return className.includes('cursor-pointer')
    })

    expect(clickableBars).toHaveLength(2)
    expect(clickableBars[0].className).toContain('ring-1')
    expect(clickableBars[0].className).toContain('ring-destructive/50')
    expect(clickableBars[1].className).toContain('ring-1')
    expect(clickableBars[1].className).toContain('ring-destructive/50')

    fireEvent.mouseEnter(clickableBars[0])
    expect(clickableBars[0].className).toContain('scale-110')
    expect(clickableBars[0].className).toContain('shadow-lg')
    expect(clickableBars[0].className).toContain('z-20')

    fireEvent.mouseLeave(clickableBars[0])
    expect(clickableBars[0].className).not.toContain('scale-110')

    vi.useRealTimers()
  })

  it('ne rend pas le résumé si une seule occurrence et calcule la largeur minimale à 20px', () => {
    const onTaskClick = vi.fn()

    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      pixelsPerDay: 5
    }

    const parentTask = {
      titre: 'Inspection'
    }

    const occurrences = [
      {
        id: 'single-1',
        date_debut: '2024-01-02T00:00:00.000Z',
        echeance: '2024-01-03T00:00:00.000Z',
        statut: 'En cours',
        created_at: '2024-01-02T00:00:00.000Z'
      }
    ]

    const { container } = render(
      <GanttRecurringTaskRow
        parentTask={parentTask}
        occurrences={occurrences}
        timeline={timeline}
        onTaskClick={onTaskClick}
      />
    )

    expect(screen.queryByText('0/1')).not.toBeInTheDocument()
    expect(screen.queryByText(/retard/)).not.toBeInTheDocument()
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument()

    const clickableBar = Array.from(container.querySelectorAll('div')).find((el) => {
      const className = el.getAttribute('class') || ''
      return className.includes('cursor-pointer')
    })

    expect(clickableBar).toBeTruthy()
    expect(clickableBar?.getAttribute('style')).toContain('width: 20px')
    expect(clickableBar?.getAttribute('style')).toContain('left: 5px')
  })
})