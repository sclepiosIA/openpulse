import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { vi } from 'vitest'

const {
  mockBadge,
  mockButton,
  mockCard,
  mockCardContent,
  mockTutorielCountUp,
  mockTutorielChartBar,
  icons,
} = vi.hoisted(() => {
  const mockBadge = (props: any) => {
    const { children, ...rest } = props
    return React.createElement('div', { 'data-testid': 'badge', ...rest }, children)
  }
  const mockButton = (props: any) => {
    const { children, ...rest } = props
    return React.createElement('button', { 'data-testid': 'button', type: 'button', ...rest }, children)
  }
  const mockCard = (props: any) => {
    const { children, ...rest } = props
    return React.createElement('div', { 'data-testid': 'card', ...rest }, children)
  }
  const mockCardContent = (props: any) => {
    const { children, ...rest } = props
    return React.createElement('div', { 'data-testid': 'card-content', ...rest }, children)
  }
  const mockTutorielCountUp = ({ value, suffix }: { value: number; suffix?: string }) =>
    React.createElement('span', { 'data-testid': 'tutoriel-countup' }, `${value}${suffix ?? ''}`)
  const mockTutorielChartBar = ({ value, label }: { value: number; label: string }) =>
    React.createElement('div', { 'data-testid': 'tutoriel-chart-bar', 'data-label': label, 'data-value': String(value) }, `${label}:${value}`)
  const makeIcon = (name: string) => (props: any) =>
    React.createElement('svg', { 'data-icon': name, ...props }, null)

  const iconNames = [
    'BarChart3',
    'TrendingUp',
    'Download',
    'FileText',
    'Calendar',
    'Filter',
    'RefreshCw',
    'CheckCircle2',
    'Clock',
    'Eye',
  ] as const

  const icons: Record<string, any> = {}
  for (const n of iconNames) {
    icons[n] = makeIcon(n)
  }

  return {
    mockBadge,
    mockButton,
    mockCard,
    mockCardContent,
    mockTutorielCountUp,
    mockTutorielChartBar,
    icons,
  }
})

// Mock framer-motion to just render children synchronously
vi.mock('framer-motion', () => {
  return {
    motion: {
      div: (props: any) => React.createElement('div', { ...props }, props.children),
    },
    AnimatePresence: (props: any) => React.createElement(React.Fragment, null, props.children),
  }
})

// Mock lucide-react icons with stable components
vi.mock('lucide-react', () => {
  return {
    BarChart3: icons.BarChart3,
    TrendingUp: icons.TrendingUp,
    Download: icons.Download,
    FileText: icons.FileText,
    Calendar: icons.Calendar,
    Filter: icons.Filter,
    RefreshCw: icons.RefreshCw,
    CheckCircle2: icons.CheckCircle2,
    Clock: icons.Clock,
    Eye: icons.Eye,
  }
})

// Mock UI components under @/components/ui/*
vi.mock('@/components/ui/badge', () => ({ Badge: mockBadge }))
vi.mock('@/components/ui/button', () => ({ Button: mockButton }))
vi.mock('@/components/ui/card', () => ({ Card: mockCard, CardContent: mockCardContent }))

// Mock TutorielCountUpAnimation relative import
vi.mock('../TutorielCountUpAnimation', () => ({
  TutorielCountUpAnimation: mockTutorielCountUp,
  TutorielChartBar: mockTutorielChartBar,
}))

// Ensure any other potential @/... imports are mocked as minimal placeholders to avoid accidental real imports
vi.mock('@/components/ui', () => ({}))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 't@t.co' }, isLoading: false }) }))

// Now import the module under test after mocks are set up
import {
  RapportDashboardPreview,
  RapportChartPreview,
  RapportExportPreview,
  RapportFiltersPreview,
} from './RapportsPreviews'

describe('RapportsPreviews components', () => {
  it('renders RapportDashboardPreview with KPIs and badge', () => {
    render(React.createElement(RapportDashboardPreview))

    // Header and badge presence
    expect(screen.getByText('Tableau de bord')).toBeDefined()
    const badges = screen.getAllByTestId('badge')
    // One badge for header month and 4 badges for trends -> at least 1 present
    expect(badges.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Janvier 2026')).toBeDefined()

    // KPI labels and values (using mocked TutorielCountUpAnimation output)
    expect(screen.getByText('Établissements actifs')).toBeDefined()
    expect(screen.getByText('47')).toBeDefined()

    expect(screen.getByText('CA mensuel')).toBeDefined()
    // value with suffix for CA should include the euro symbol from original component; our mock appends suffix
    expect(screen.getByText('125000 €')).toBeDefined()

    expect(screen.getByText('Tâches complétées')).toBeDefined()
    expect(screen.getByText('156')).toBeDefined()

    expect(screen.getByText('Score satisfaction')).toBeDefined()
    // percentage suffix present
    expect(screen.getByText('92%')).toBeDefined()
  })

  it('renders RapportChartPreview with 6 bars and trend text', () => {
    render(React.createElement(RapportChartPreview))

    // Header and control button
    expect(screen.getByText('Évolution CA (k€)')).toBeDefined()
    expect(screen.getByText('6 mois')).toBeDefined()

    // We mocked TutorielChartBar to render elements with data-testid 'tutoriel-chart-bar' and data-label
    const bars = screen.getAllByTestId('tutoriel-chart-bar')
    expect(bars.length).toBe(6)

    // Spot-check a couple of labels and values from the data array
    expect(screen.getByText('Jan:85')).toBeDefined()
    expect(screen.getByText('Juin:125')).toBeDefined()

    // Trend text shown at the bottom
    expect(screen.getByText('+47% sur la période')).toBeDefined()
  })

  it('handles export progression in RapportExportPreview (starting, progressing, finishing)', async () => {
    vi.useFakeTimers()
    try {
      render(React.createElement(RapportExportPreview))

      // Initially exporting is false, so progress UI should not be present
      expect(screen.queryByText('Génération en cours...')).toBeNull()
      expect(screen.queryByText('Export terminé !')).toBeNull()
      expect(screen.queryByText(/%$/)).toBeNull()

      // Advance to trigger exporting true (useEffect timeout 500ms)
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      // After exporting starts, initial progress should be 0%
      expect(screen.getByText('Génération en cours...')).toBeDefined()
      expect(screen.getByText('0%')).toBeDefined()

      // Advance enough time for progress to reach 100%:
      // interval increments every 200ms by +10 until >=100 -> 10 increments -> 2000ms
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Now should be finished
      expect(screen.getByText('Export terminé !')).toBeDefined()
      expect(screen.getByText('100%')).toBeDefined()

      // The success icon CheckCircle2 should be rendered (mocked svg with data-icon)
      expect(document.querySelector('[data-icon="CheckCircle2"]')).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders RapportFiltersPreview with applied filters and action buttons', () => {
    render(React.createElement(RapportFiltersPreview))

    // Header
    expect(screen.getByText('Filtres appliqués')).toBeDefined()

    // Check presence of filter labels and values inside badges
    expect(screen.getByText('Période:')).toBeDefined()
    expect(screen.getByText('Janvier 2026')).toBeDefined()

    expect(screen.getByText('Région:')).toBeDefined()
    expect(screen.getByText('Rhône-Alpes')).toBeDefined()

    expect(screen.getByText('Type:')).toBeDefined()
    expect(screen.getByText('Grand compte, Groupement')).toBeDefined()

    expect(screen.getByText('Statut:')).toBeDefined()
    expect(screen.getByText('Production')).toBeDefined()

    // Action buttons
    expect(screen.getByText('Réinitialiser')).toBeDefined()
    expect(screen.getByText('Appliquer')).toBeDefined()
  })
})