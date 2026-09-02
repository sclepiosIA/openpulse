import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentsMobileHeader } from '../DocumentsMobileHeader';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

describe('DocumentsMobileHeader', () => {
  const defaultProps = {
    totalDocs: 42,
    activeTab: 'etablissements',
    onTabChange: vi.fn(),
    tabCounts: {
      etablissements: 10,
      'mes-documents': 15,
      recents: 5,
      partages: 8,
      corbeille: 4,
    },
    onUpload: vi.fn(),
    onCreateFolder: vi.fn(),
    onSearch: vi.fn(),
  };

  it('renders title', () => {
    render(<DocumentsMobileHeader {...defaultProps} />);
    expect(screen.getByText('Documents')).toBeInTheDocument();
  });

  it('renders total docs count', () => {
    render(<DocumentsMobileHeader {...defaultProps} />);
    expect(screen.getByText('42 documents')).toBeInTheDocument();
  });

  it('renders all 5 tabs', () => {
    render(<DocumentsMobileHeader {...defaultProps} />);
    expect(screen.getByText('Étab.')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.getByText('Récents')).toBeInTheDocument();
    expect(screen.getByText('Partagés')).toBeInTheDocument();
    expect(screen.getByText('Corbeille')).toBeInTheDocument();
  });

  it('calls onTabChange when tab clicked', () => {
    const onTabChange = vi.fn();
    render(<DocumentsMobileHeader {...defaultProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText('Docs'));
    expect(onTabChange).toHaveBeenCalledWith('mes-documents');
  });

  it('renders tab counts as badges', () => {
    render(<DocumentsMobileHeader {...defaultProps} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('hides hamburger when showGlobalNav is false', () => {
    render(<DocumentsMobileHeader {...defaultProps} showGlobalNav={false} />);
    expect(screen.queryByLabelText('Menu principal')).not.toBeInTheDocument();
  });

  it('renders search button', () => {
    render(<DocumentsMobileHeader {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
