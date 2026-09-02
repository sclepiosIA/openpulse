import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SupportMobileHeader } from '../SupportMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('SupportMobileHeader', () => {
  const defaultProps = {
    stats: { total: 25, open: 8, critical: 2 },
    onSearchClick: vi.fn(),
    onCreateTicket: vi.fn(),
    onToggleSettings: vi.fn(),
  };

  it('renders title', () => {
    render(<SupportMobileHeader {...defaultProps} />);
    expect(screen.getByText('Support')).toBeInTheDocument();
  });

  it('renders stats with critical count', () => {
    render(<SupportMobileHeader {...defaultProps} />);
    expect(screen.getByText(/25 tickets/)).toBeInTheDocument();
    expect(screen.getByText(/8 ouverts/)).toBeInTheDocument();
    expect(screen.getByText(/2 critiques/)).toBeInTheDocument();
  });

  it('hides critical count when zero', () => {
    render(<SupportMobileHeader {...defaultProps} stats={{ total: 10, open: 3, critical: 0 }} />);
    expect(screen.queryByText(/critiques/)).not.toBeInTheDocument();
  });

  it('renders action buttons (hamburger + search + settings + create)', () => {
    const { container } = render(<SupportMobileHeader {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(4); // hamburger + search + settings + create
  });

  it('hides hamburger when showGlobalNav is false', () => {
    const { container } = render(<SupportMobileHeader {...defaultProps} showGlobalNav={false} />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(3);
  });

  it('calls onCreateTicket', () => {
    const { container } = render(<SupportMobileHeader {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    // Last button is create
    fireEvent.click(buttons[buttons.length - 1]);
    expect(defaultProps.onCreateTicket).toHaveBeenCalled();
  });
});
