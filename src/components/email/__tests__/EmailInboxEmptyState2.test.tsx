import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailInboxEmptyState } from '../EmailInboxEmptyState';

describe('EmailInboxEmptyState', () => {
  const defaultProps = {
    onCompose: vi.fn(),
    onSync: vi.fn(),
  };

  it('renders empty inbox message', () => {
    render(<EmailInboxEmptyState {...defaultProps} />);
    expect(screen.getByText('Votre boîte de réception est vide')).toBeInTheDocument();
  });

  it('renders compose and sync buttons', () => {
    render(<EmailInboxEmptyState {...defaultProps} />);
    expect(screen.getByText('Envoyer un email')).toBeInTheDocument();
    expect(screen.getByText('Synchroniser maintenant')).toBeInTheDocument();
  });

  it('calls onCompose when button clicked', () => {
    render(<EmailInboxEmptyState {...defaultProps} />);
    fireEvent.click(screen.getByText('Envoyer un email'));
    expect(defaultProps.onCompose).toHaveBeenCalledOnce();
  });

  it('renders filtered state', () => {
    render(<EmailInboxEmptyState {...defaultProps} isFiltered />);
    expect(screen.getByText('Aucun email trouvé')).toBeInTheDocument();
    // Should not show compose/sync buttons in filtered state
    expect(screen.queryByText('Envoyer un email')).not.toBeInTheDocument();
  });
});
