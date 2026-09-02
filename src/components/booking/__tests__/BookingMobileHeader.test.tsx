import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BookingMobileHeader } from '../BookingMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('BookingMobileHeader', () => {
  const defaultProps = {
    stats: { pending: 3, confirmed: 8, thisWeek: 5 },
    onSearchClick: vi.fn(),
    onCreatePage: vi.fn(),
  };

  it('renders title', () => {
    render(<BookingMobileHeader {...defaultProps} />);
    expect(screen.getByText('Prise de RDV')).toBeInTheDocument();
  });

  it('renders stats badges', () => {
    render(<BookingMobileHeader {...defaultProps} />);
    expect(screen.getByText('3 att.')).toBeInTheDocument();
    expect(screen.getByText('8 conf.')).toBeInTheDocument();
  });

  it('renders mobile stats', () => {
    render(<BookingMobileHeader {...defaultProps} />);
    expect(screen.getByText('3 en attente')).toBeInTheDocument();
    expect(screen.getByText('8 confirmés')).toBeInTheDocument();
    expect(screen.getByText('5 sem.')).toBeInTheDocument();
  });

  it('calls onSearchClick', () => {
    render(<BookingMobileHeader {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Search button
    const searchBtn = buttons.find(b => b.querySelector('.lucide-search'));
    if (searchBtn) fireEvent.click(searchBtn);
    expect(defaultProps.onSearchClick).toHaveBeenCalled();
  });

  it('calls onCreatePage', () => {
    render(<BookingMobileHeader {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const plusBtn = buttons.find(b => b.querySelector('.lucide-plus'));
    if (plusBtn) fireEvent.click(plusBtn);
    expect(defaultProps.onCreatePage).toHaveBeenCalled();
  });

  it('hides hamburger when showGlobalNav is false', () => {
    const { container } = render(<BookingMobileHeader {...defaultProps} showGlobalNav={false} />);
    const menuIcons = container.querySelectorAll('.lucide-menu');
    expect(menuIcons.length).toBe(0);
  });
});
