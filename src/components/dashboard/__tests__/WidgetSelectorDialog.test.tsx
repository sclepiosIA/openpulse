import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WidgetSelectorDialog } from '../WidgetSelectorDialog'
import type { WidgetConfig } from '@/hooks/dashboard/useDashboardLayout'

vi.mock('@/hooks/dashboard/useDashboardLayout', () => ({
  WIDGET_REGISTRY: {
    hero_metrics: {
      id: 'hero_metrics',
      label: 'Hero Metrics',
      description: 'KPIs principaux',
      category: 'metrics',
      defaultSize: 'full',
      icon: 'TrendingUp',
      allowedSizes: ['full', 'large'],
    },
    pipeline: {
      id: 'pipeline',
      label: 'Pipeline',
      description: 'Pipeline de ventes',
      category: 'crm',
      defaultSize: 'large',
      icon: 'Target',
      allowedSizes: ['large', 'medium'],
    },
  },
  DASHBOARD_TEMPLATES: {
    compact: {
      id: 'compact',
      name: 'Compact',
      description: 'Vue compacte',
      widgets: ['hero_metrics'],
    },
    complete: {
      id: 'complete',
      name: 'Complet',
      description: 'Tous les widgets',
      widgets: ['hero_metrics', 'pipeline'],
    },
  },
}))

const widgets: WidgetConfig[] = [
  { id: 'hero_metrics', visible: true, size: 'full', order: 0, settings: {} },
  { id: 'pipeline', visible: false, size: 'large', order: 1, settings: {} },
]

describe('WidgetSelectorDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    allWidgets: widgets,
    onToggleVisibility: vi.fn(),
    onApplyTemplate: vi.fn(),
  }

  it('renders dialog title', () => {
    render(<WidgetSelectorDialog {...defaultProps} />)
    expect(screen.getByText('Personnalisation du Dashboard')).toBeInTheDocument()
  })

  it('renders widget names', () => {
    render(<WidgetSelectorDialog {...defaultProps} />)
    expect(screen.getByText('Hero Metrics')).toBeInTheDocument()
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
  })

  it('renders tabs', () => {
    render(<WidgetSelectorDialog {...defaultProps} />)
    expect(screen.getByText('Widgets')).toBeInTheDocument()
    expect(screen.getByText('Templates')).toBeInTheDocument()
  })

  it('shows templates tab on click', async () => {
    render(<WidgetSelectorDialog {...defaultProps} />)
    await userEvent.click(screen.getByText('Templates'))
    expect(screen.getByText('Compact')).toBeInTheDocument()
    expect(screen.getByText('Complet')).toBeInTheDocument()
  })
})
