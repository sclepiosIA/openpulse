import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EtablissementsMobileHeader } from '../EtablissementsMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('EtablissementsMobileHeader', () => {
  const defaultProps = {
    searchValue: '',
    onSearchChange: vi.fn(),
    onCreateClick: vi.fn(),
    stats: { displayed: 25, total: 42 },
  };

  it('renders title', () => {
    render(<EtablissementsMobileHeader {...defaultProps} />);
    expect(screen.getByText('Établissements')).toBeInTheDocument();
  });

  it('renders stats text', () => {
    render(<EtablissementsMobileHeader {...defaultProps} />);
    expect(screen.getByText(/25 affich/)).toBeInTheDocument();
    expect(screen.getByText(/42 total/)).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<EtablissementsMobileHeader {...defaultProps} />);
    expect(screen.getByPlaceholderText('Chercher...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<EtablissementsMobileHeader {...defaultProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByPlaceholderText('Chercher...'), { target: { value: 'CHU' } });
    expect(onSearchChange).toHaveBeenCalledWith('CHU');
  });

  it('hides hamburger when showGlobalNav is false', () => {
    const { container } = render(<EtablissementsMobileHeader {...defaultProps} showGlobalNav={false} />);
    expect(container.querySelector('.lucide-menu')).not.toBeInTheDocument();
  });

  it('renders toolbar when provided', () => {
    render(<EtablissementsMobileHeader {...defaultProps} toolbar={<div data-testid="toolbar">T</div>} />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });
});
