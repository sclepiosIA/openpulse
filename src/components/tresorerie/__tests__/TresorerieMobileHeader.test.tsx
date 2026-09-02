import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TresorerieMobileHeader } from '../TresorerieMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('TresorerieMobileHeader', () => {
  const stats = { soldeQonto: '50 000€', revenusMois: '12 000€', depensesEnRetard: 3 };

  it('renders title', () => {
    render(<TresorerieMobileHeader stats={stats} />);
    expect(screen.getByText('Trésorerie')).toBeInTheDocument();
  });

  it('shows solde and revenus stats', () => {
    render(<TresorerieMobileHeader stats={stats} />);
    expect(screen.getByText(/50 000€/)).toBeInTheDocument();
    expect(screen.getByText(/12 000€/)).toBeInTheDocument();
  });

  it('shows depenses en retard when > 0', () => {
    render(<TresorerieMobileHeader stats={stats} />);
    expect(screen.getByText(/3 retard/)).toBeInTheDocument();
  });

  it('hides retard when 0', () => {
    render(<TresorerieMobileHeader stats={{ soldeQonto: '50k', revenusMois: '10k' }} />);
    expect(screen.queryByText(/retard/)).not.toBeInTheDocument();
  });

  it('renders toolbar when provided', () => {
    render(<TresorerieMobileHeader stats={stats} toolbar={<div data-testid="tb">T</div>} />);
    expect(screen.getByTestId('tb')).toBeInTheDocument();
  });

  it('hides hamburger when showGlobalNav false', () => {
    const { container } = render(<TresorerieMobileHeader stats={stats} showGlobalNav={false} />);
    expect(container.querySelectorAll('.lucide-menu').length).toBe(0);
  });
});
