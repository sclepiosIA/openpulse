// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { GanttCategorySummaryBar } from './GanttCategorySummaryBar'

const { cnMock } = vi.hoisted(() => ({
  cnMock: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')
}))

vi.mock('@/lib/utils', () => ({
  cn: cnMock
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  )
}))

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="tooltip-content" className={className}>
      {children}
    </div>
  )
}))

vi.mock('lucide-react', () => ({
  CheckCircle: ({ className }: { className?: string }) => <svg data-testid="icon-check" className={className} />,
  Clock: ({ className }: { className?: string }) => <svg data-testid="icon-clock" className={className} />,
  AlertCircle: ({ className }: { className?: string }) => <svg data-testid="icon-alert" className={className} />,
  Circle: ({ className }: { className?: string }) => <svg data-testid="icon-circle" className={className} />
}))

describe('GanttCategorySummaryBar', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('rend les informations de synthèse, calcule la position et déclenche onClick', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T12:00:00.000Z'))

    const onClick = vi.fn()
    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      pixelsPerDay: 10
    }

    const category = {
      id: 'cat-1',
      nom: 'Développement',
      couleur: '#ff0000',
      tasks: [
        {
          id: 't1',
          titre: 'Préparer la maquette',
          statut: 'A faire',
          priorite: 'high',
          date_debut: '2024-01-03T00:00:00.000Z',
          echeance: '2024-01-05T00:00:00.000Z',
          created_at: '2024-01-02T00:00:00.000Z'
        },
        {
          id: 't2',
          titre: 'Implémenter',
          statut: 'En cours',
          priorite: 'medium',
          date_debut: '2024-01-04T00:00:00.000Z',
          echeance: '2024-01-12T00:00:00.000Z',
          created_at: '2024-01-04T00:00:00.000Z'
        },
        {
          id: 't3',
          titre: 'Corriger bug',
          statut: 'Bloqué',
          priorite: 'high',
          created_at: '2024-01-06T00:00:00.000Z',
          echeance: '2024-01-08T00:00:00.000Z'
        },
        {
          id: 't4',
          titre: 'Livrer',
          statut: 'Terminé',
          priorite: 'low',
          date_debut: '2024-01-02T00:00:00.000Z',
          echeance: '2024-01-07T00:00:00.000Z',
          created_at: '2024-01-02T00:00:00.000Z'
        }
      ]
    }

    const { container } = render(
      <div style={{ position: 'relative' }}>
        <GanttCategorySummaryBar category={category} timeline={timeline} onClick={onClick} />
      </div>
    )

    const tooltip = screen.getByTestId('tooltip-content')

    expect(screen.getAllByText('Développement')).toHaveLength(2)
    expect(within(tooltip).getByText('📅 Début : 02 janv. 2024')).toBeInTheDocument()
    expect(within(tooltip).getByText('📅 Fin : 12 janv. 2024')).toBeInTheDocument()
    expect(within(tooltip).getByText('⏱️ Durée : 10 jours')).toBeInTheDocument()

    expect(within(tooltip).getByText('À faire : 1')).toBeInTheDocument()
    expect(within(tooltip).getByText('En cours : 1')).toBeInTheDocument()
    expect(within(tooltip).getByText('Bloqué : 1')).toBeInTheDocument()
    expect(within(tooltip).getByText('Terminé : 1')).toBeInTheDocument()

    expect(within(tooltip).getByText('Tâches (4) :')).toBeInTheDocument()
    expect(within(tooltip).getByText('Préparer la maquette')).toBeInTheDocument()
    expect(within(tooltip).getByText('Implémenter')).toBeInTheDocument()
    expect(within(tooltip).getByText('Corriger bug')).toBeInTheDocument()
    expect(within(tooltip).getByText('Livrer')).toBeInTheDocument()

    const badges = screen.getAllByTestId('badge')
    expect(badges).toHaveLength(3)
    expect(badges[0]).toHaveTextContent('4')
    expect(badges[1]).toHaveTextContent('⚠️ 2')
    expect(badges[2]).toHaveTextContent('🔴 2')

    expect(screen.getByText('✓1')).toBeInTheDocument()
    expect(screen.getByText('⏱1')).toBeInTheDocument()
    expect(screen.getByText('⚠1')).toBeInTheDocument()

    const clickableBar = container.querySelector('.absolute')
    expect(clickableBar).toBeInstanceOf(HTMLDivElement)
    const bar = clickableBar as HTMLDivElement
    expect(bar.style.left).toBe('10px')
    expect(bar.style.width).toBe('100px')
    expect(bar.style.borderLeftColor).toBe('rgb(255, 0, 0)')
    expect(bar.className).toContain('ring-2')

    fireEvent.click(bar)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('utilise created_at, applique la durée par défaut de 7 jours et masque les badges optionnels', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-10T12:00:00.000Z'))

    const timeline = {
      start: new Date('2024-01-01T00:00:00.000Z'),
      pixelsPerDay: 10
    }

    const category = {
      id: 'cat-2',
      nom: 'Support',
      tasks: [
        {
          id: 't10',
          titre: 'Ticket unique',
          statut: 'A faire',
          priorite: 'low',
          created_at: '2024-01-09T00:00:00.000Z'
        }
      ]
    }

    const { container } = render(
      <div style={{ position: 'relative' }}>
        <GanttCategorySummaryBar category={category} timeline={timeline} onClick={() => {}} />
      </div>
    )

    const tooltip = screen.getByTestId('tooltip-content')

    expect(screen.getAllByText('Support')).toHaveLength(2)
    expect(within(tooltip).getByText('📅 Début : 09 janv. 2024')).toBeInTheDocument()
    expect(within(tooltip).getByText('📅 Fin : 16 janv. 2024')).toBeInTheDocument()
    expect(within(tooltip).getByText('⏱️ Durée : 7 jours')).toBeInTheDocument()
    expect(within(tooltip).getByText('Tâches (1) :')).toBeInTheDocument()
    expect(within(tooltip).getByText('Ticket unique')).toBeInTheDocument()
    expect(within(tooltip).getByText('À faire : 1')).toBeInTheDocument()
    expect(within(tooltip).getByText('En cours : 0')).toBeInTheDocument()
    expect(within(tooltip).getByText('Bloqué : 0')).toBeInTheDocument()
    expect(within(tooltip).getByText('Terminé : 0')).toBeInTheDocument()

    const badges = screen.getAllByTestId('badge')
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveTextContent('1')

    expect(screen.queryByText('✓1')).not.toBeInTheDocument()
    expect(screen.queryByText('⏱1')).not.toBeInTheDocument()
    expect(screen.queryByText('⚠1')).not.toBeInTheDocument()
    expect(screen.queryByText('⚠️ 1')).not.toBeInTheDocument()
    expect(screen.queryByText('🔴 1')).not.toBeInTheDocument()

    const clickableBar = container.querySelector('.absolute')
    expect(clickableBar).toBeInstanceOf(HTMLDivElement)
    const bar = clickableBar as HTMLDivElement
    expect(bar.style.left).toBe('80px')
    expect(bar.style.width).toBe('70px')
    expect(bar.style.borderLeftColor).toBe('rgb(136, 136, 136)')
    expect(bar.className).not.toContain('ring-2')
  })
})