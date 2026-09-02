import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductionMobileHeader } from '../ProductionMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

const stats = { totalClients: 42, mrr: '15k', healthScore: '85' };

describe('ProductionMobileHeader', () => {
  it('renders title', () => {
    render(<ProductionMobileHeader stats={stats} showKPIs={false} onToggleKPIs={vi.fn()} onSearchClick={vi.fn()} />);
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('shows stats subtitle', () => {
    render(<ProductionMobileHeader stats={stats} showKPIs={false} onToggleKPIs={vi.fn()} onSearchClick={vi.fn()} />);
    expect(screen.getByText(/42 clients/)).toBeInTheDocument();
    expect(screen.getByText(/15k MRR/)).toBeInTheDocument();
  });

  it('calls onSearchClick', () => {
    const onSearch = vi.fn();
    render(<ProductionMobileHeader stats={stats} showKPIs={false} onToggleKPIs={vi.fn()} onSearchClick={onSearch} />);
    // Search button is the one with Search icon
    const buttons = screen.getAllByRole('button');
    const searchBtn = buttons.find(b => b.querySelector('.lucide-search'));
    searchBtn?.click();
    expect(onSearch).toHaveBeenCalled();
  });

  it('renders toolbar when provided', () => {
    render(<ProductionMobileHeader stats={stats} showKPIs={false} onToggleKPIs={vi.fn()} onSearchClick={vi.fn()} toolbar={<div data-testid="tb">TB</div>} />);
    expect(screen.getByTestId('tb')).toBeInTheDocument();
  });

  it('hides hamburger when showGlobalNav false', () => {
    const { container } = render(<ProductionMobileHeader stats={stats} showKPIs={false} onToggleKPIs={vi.fn()} onSearchClick={vi.fn()} showGlobalNav={false} />);
    expect(container.querySelectorAll('.lucide-menu').length).toBe(0);
  });
});
