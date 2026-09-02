import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProspectsMobileHeader } from '../ProspectsMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('ProspectsMobileHeader', () => {
  const defaultProps = {
    searchValue: '',
    onSearchChange: vi.fn(),
    onCreateClick: vi.fn(),
    stats: { displayed: 25, total: 40, hot: 8, pipeline: '1.2M€' },
  };

  it('renders title', () => {
    render(<ProspectsMobileHeader {...defaultProps} />);
    expect(screen.getByText('Prospects')).toBeInTheDocument();
  });

  it('shows stats', () => {
    render(<ProspectsMobileHeader {...defaultProps} />);
    expect(screen.getByText(/25 affich/)).toBeInTheDocument();
    expect(screen.getByText(/8 chauds/)).toBeInTheDocument();
    expect(screen.getByText(/1\.2M€/)).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<ProspectsMobileHeader {...defaultProps} />);
    expect(screen.getByPlaceholderText('Chercher...')).toBeInTheDocument();
  });

  it('calls onSearchChange', () => {
    render(<ProspectsMobileHeader {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Chercher...'), { target: { value: 'test' } });
    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it('renders toolbar when provided', () => {
    render(<ProspectsMobileHeader {...defaultProps} toolbar={<div data-testid="tb">T</div>} />);
    expect(screen.getByTestId('tb')).toBeInTheDocument();
  });

  it('hides hamburger when showGlobalNav false', () => {
    const { container } = render(<ProspectsMobileHeader {...defaultProps} showGlobalNav={false} />);
    expect(container.querySelectorAll('.lucide-menu').length).toBe(0);
  });
});
