import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParametresMobileHeader } from '../ParametresMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('ParametresMobileHeader', () => {
  const defaultProps = {
    isAdmin: true,
    onSearchClick: vi.fn(),
    onLogsClick: vi.fn(),
  };

  it('renders title', () => {
    render(<ParametresMobileHeader {...defaultProps} />);
    expect(screen.getByText('Paramètres')).toBeInTheDocument();
  });

  it('shows admin label when isAdmin', () => {
    render(<ParametresMobileHeader {...defaultProps} />);
    expect(screen.getByText(/Admin/)).toBeInTheDocument();
  });

  it('hides admin label when not admin', () => {
    render(<ParametresMobileHeader {...defaultProps} isAdmin={false} />);
    expect(screen.queryByText(/Admin/)).not.toBeInTheDocument();
  });

  it('renders toolbar when provided', () => {
    render(<ParametresMobileHeader {...defaultProps} toolbar={<div data-testid="toolbar">T</div>} />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('hides hamburger when showGlobalNav is false', () => {
    const { container } = render(<ParametresMobileHeader {...defaultProps} showGlobalNav={false} />);
    expect(container.querySelectorAll('.lucide-menu').length).toBe(0);
  });
});
