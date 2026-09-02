import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WidgetConfigDialog } from '../WidgetConfigDialog';

vi.mock('@/hooks/dashboard/useDashboardLayout', () => ({
  WIDGET_REGISTRY: {
    hero: { id: 'hero', label: 'Hero Metrics', description: 'KPIs principaux', category: 'metrics', defaultSize: 'full', icon: 'TrendingUp' },
  },
}));

describe('WidgetConfigDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    widgetId: 'hero' as any,
    currentSettings: {},
    onSave: vi.fn(),
  };

  it('renders dialog title with widget name', () => {
    const { container } = render(<WidgetConfigDialog {...defaultProps} />);
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Hero Metrics');
  });

  it('renders no-config message for simple widget', () => {
    render(<WidgetConfigDialog {...defaultProps} />);
    expect(screen.getByText(/pas d'options configurables/i)).toBeInTheDocument();
  });

  it('renders apply button', () => {
    render(<WidgetConfigDialog {...defaultProps} />);
    expect(screen.getByText('Appliquer')).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<WidgetConfigDialog {...defaultProps} />);
    expect(screen.getByText('Annuler')).toBeInTheDocument();
  });
});
