import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContratsMobileHeader } from '../ContratsMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('ContratsMobileHeader', () => {
  const stats = { actifs: 15, alertes: 3 };

  it('renders title', () => {
    render(<ContratsMobileHeader stats={stats} />);
    expect(screen.getByText('Contrats')).toBeInTheDocument();
  });

  it('shows actifs count', () => {
    render(<ContratsMobileHeader stats={stats} />);
    expect(screen.getByText(/15 actifs/)).toBeInTheDocument();
  });

  it('shows alertes count', () => {
    render(<ContratsMobileHeader stats={stats} />);
    expect(screen.getByText(/3 alertes/)).toBeInTheDocument();
  });

  it('hides alertes when 0', () => {
    render(<ContratsMobileHeader stats={{ actifs: 10 }} />);
    expect(screen.queryByText(/alertes/)).not.toBeInTheDocument();
  });

  it('renders toolbar when provided', () => {
    render(<ContratsMobileHeader stats={stats} toolbar={<div data-testid="tb">T</div>} />);
    expect(screen.getByTestId('tb')).toBeInTheDocument();
  });

  it('hides hamburger when showGlobalNav false', () => {
    const { container } = render(<ContratsMobileHeader stats={stats} showGlobalNav={false} />);
    expect(container.querySelectorAll('.lucide-menu').length).toBe(0);
  });
});
