import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeploymentMobileHeader } from '../DeploymentMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('DeploymentMobileHeader', () => {
  const defaultProps = {
    searchValue: '',
    onSearchChange: vi.fn(),
    stats: { displayed: 15, total: 20, healthy: 12, avgProgress: 72 },
  };

  it('renders title', () => {
    render(<DeploymentMobileHeader {...defaultProps} />);
    expect(screen.getByText('Déploiement')).toBeInTheDocument();
  });

  it('renders stats', () => {
    render(<DeploymentMobileHeader {...defaultProps} />);
    expect(screen.getByText(/15 affich/)).toBeInTheDocument();
    expect(screen.getByText(/12 OK/)).toBeInTheDocument();
    expect(screen.getByText(/72%/)).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<DeploymentMobileHeader {...defaultProps} />);
    expect(screen.getByPlaceholderText('Chercher...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    render(<DeploymentMobileHeader {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Chercher...'), { target: { value: 'test' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it('hides hamburger when showGlobalNav is false', () => {
    const { container } = render(<DeploymentMobileHeader {...defaultProps} showGlobalNav={false} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('renders toolbar when provided', () => {
    render(<DeploymentMobileHeader {...defaultProps} toolbar={<div data-testid="toolbar">Toolbar</div>} />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });
});
