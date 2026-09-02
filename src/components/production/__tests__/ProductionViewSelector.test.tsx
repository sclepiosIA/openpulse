import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ProductionViewSelector } from '../ProductionViewSelector';

describe('ProductionViewSelector', () => {
  it('renders all view tabs', () => {
    render(<ProductionViewSelector currentView="grid" onViewChange={vi.fn()} />);
    expect(screen.getByText('Grille')).toBeInTheDocument();
    expect(screen.getByText('Liste')).toBeInTheDocument();
    expect(screen.getByText('Analytique')).toBeInTheDocument();
  });

  it('highlights active view', () => {
    const { container } = render(<ProductionViewSelector currentView="grid" onViewChange={vi.fn()} />);
    const activeTab = container.querySelector('[data-state="active"]');
    expect(activeTab).toBeInTheDocument();
  });
});
