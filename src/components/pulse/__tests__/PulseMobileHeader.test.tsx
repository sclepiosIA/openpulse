import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PulseMobileHeader } from '../PulseMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

vi.mock('../StatusSelectorHeader', () => ({
  StatusSelectorHeader: () => <div data-testid="status-selector" />,
}));

describe('PulseMobileHeader', () => {
  const props = { conversationsCount: 12, onlineCount: 3, onSearch: vi.fn(), onCreate: vi.fn() };

  it('renders title', () => {
    render(<PulseMobileHeader {...props} />);
    expect(screen.getByText('Pulse')).toBeInTheDocument();
  });

  it('shows conversations count and online count', () => {
    render(<PulseMobileHeader {...props} />);
    expect(screen.getByText(/12 conv.*3 en ligne/)).toBeInTheDocument();
  });

  it('hides online count when 0', () => {
    render(<PulseMobileHeader {...props} onlineCount={0} />);
    expect(screen.queryByText(/en ligne/)).not.toBeInTheDocument();
  });

  it('renders status selector', () => {
    render(<PulseMobileHeader {...props} />);
    expect(screen.getByTestId('status-selector')).toBeInTheDocument();
  });

  it('hides hamburger when showGlobalNav false', () => {
    render(<PulseMobileHeader {...props} showGlobalNav={false} />);
    expect(screen.queryByLabelText('Ouvrir le menu')).not.toBeInTheDocument();
  });
});
