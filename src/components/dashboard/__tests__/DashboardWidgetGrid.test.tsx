import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardWidgetGrid } from '../DashboardWidgetGrid';

const baseLayout = {
  widgets: [],
  visibleWidgets: [],
  allWidgets: [],
  isEditMode: false,
  isSaving: false,
  startEdit: vi.fn(),
  cancelEdit: vi.fn(),
  saveLayout: vi.fn(),
  resetToDefault: vi.fn(),
  toggleWidget: vi.fn(),
  updateWidgetSize: vi.fn(),
  reorderWidgets: vi.fn(),
  openWidgetSelector: vi.fn(),
  applyTemplate: vi.fn(),
};

const mockLayout = vi.fn(() => baseLayout);

vi.mock('@/hooks/dashboard/useDashboardLayout', () => ({
  useDashboardLayout: () => mockLayout(),
  WIDGET_REGISTRY: {
    metrics: { allowedSizes: ['M', 'L'], configurable: false },
  },
  DASHBOARD_TEMPLATES: {},
}));

describe('DashboardWidgetGrid', () => {
  it('shows the empty state when no widget is visible', () => {
    mockLayout.mockReturnValue(baseLayout);
    render(<DashboardWidgetGrid team="direction" renderWidget={() => <div>X</div>} />);
    expect(screen.getByText(/Aucun widget visible/i)).toBeInTheDocument();
  });

  it('renders provided widgets and skips those returning null', () => {
    mockLayout.mockReturnValue({
      ...baseLayout,
      visibleWidgets: [
        { id: 'metrics', size: 'M', visible: true },
        { id: 'hidden', size: 'M', visible: true },
      ] as never,
    });
    const renderWidget = vi.fn((id: string) =>
      id === 'metrics' ? <div data-testid="w-metrics">Metrics</div> : null,
    );
    render(<DashboardWidgetGrid team="direction" renderWidget={renderWidget} />);

    expect(screen.getByTestId('w-metrics')).toBeInTheDocument();
    // Empty state should NOT appear when at least one widget rendered
    expect(screen.queryByText(/Aucun widget visible/i)).not.toBeInTheDocument();
    expect(renderWidget).toHaveBeenCalled();
  });
});
