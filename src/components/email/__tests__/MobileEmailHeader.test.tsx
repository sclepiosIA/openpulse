import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MobileEmailHeader } from '../MobileEmailHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

const defaultProps = {
  accountEmail: 'test@marque.com',
  unreadCount: 5,
  totalCount: 42,
  searchValue: '',
  onSearchChange: vi.fn(),
  emailAccounts: [
    { id: 'a1', email_address: 'test@marque.com', display_name: 'Test' },
    { id: 'a2', email_address: 'support@marque.com', display_name: 'Support' },
  ],
  currentAccountId: 'a1',
  onAccountChange: vi.fn(),
};

describe('MobileEmailHeader', () => {
  it('renders inbox icon', () => {
    const { container } = render(
      <MemoryRouter><MobileEmailHeader {...defaultProps} /></MemoryRouter>
    );
    expect(container.querySelector('.lucide-inbox')).toBeInTheDocument();
  });

  it('renders account email', () => {
    render(<MemoryRouter><MobileEmailHeader {...defaultProps} /></MemoryRouter>);
    expect(screen.getByText('test@marque.com')).toBeInTheDocument();
  });

  it('renders unread badge', () => {
    render(<MemoryRouter><MobileEmailHeader {...defaultProps} /></MemoryRouter>);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders search button', () => {
    const { container } = render(
      <MemoryRouter><MobileEmailHeader {...defaultProps} /></MemoryRouter>
    );
    expect(container.querySelector('.lucide-search')).toBeInTheDocument();
  });

  it('renders menu button when showGlobalNav', () => {
    render(<MemoryRouter><MobileEmailHeader {...defaultProps} showGlobalNav /></MemoryRouter>);
    expect(screen.getByLabelText('Ouvrir le menu')).toBeInTheDocument();
  });
});
