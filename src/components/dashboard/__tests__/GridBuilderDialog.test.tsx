import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GridBuilderDialog } from '../GridBuilderDialog';
import type { WidgetConfig, WidgetId } from '@/hooks/dashboard/useDashboardLayout';

describe('GridBuilderDialog', () => {
  const allWidgets: WidgetConfig[] = [
    { id: 'recent_tasks' as WidgetId, visible: true, order: 0, size: 'medium' },
    { id: 'upcoming_events' as WidgetId, visible: false, order: 1, size: 'small' },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    allWidgets,
    onToggleVisibility: vi.fn(),
    onChangeSize: vi.fn(),
    onReorder: vi.fn(),
    onApplyTemplate: vi.fn(),
    onUpdateOrder: vi.fn(),
    onUpdateSize: vi.fn(),
  };

  it('renders dialog when open', () => {
    render(<GridBuilderDialog {...defaultProps} />);
    expect(screen.getByText('Personnalisation du Dashboard')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<GridBuilderDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Personnalisation du Dashboard')).not.toBeInTheDocument();
  });
});
