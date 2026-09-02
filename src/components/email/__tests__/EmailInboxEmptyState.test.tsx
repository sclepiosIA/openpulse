import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EmailInboxEmptyState } from '@/components/email/EmailInboxEmptyState';

describe('EmailInboxEmptyState', () => {
  const defaultProps = {
    onCompose: vi.fn(),
    onSync: vi.fn(),
  };

  it('should render empty inbox message', () => {
    render(React.createElement(EmailInboxEmptyState, defaultProps));
    expect(screen.getByText('Votre boîte de réception est vide')).toBeInTheDocument();
  });

  it('should call onCompose when compose button clicked', () => {
    render(React.createElement(EmailInboxEmptyState, defaultProps));
    fireEvent.click(screen.getByText('Envoyer un email'));
    expect(defaultProps.onCompose).toHaveBeenCalled();
  });

  it('should call onSync when sync button clicked', () => {
    render(React.createElement(EmailInboxEmptyState, defaultProps));
    fireEvent.click(screen.getByText('Synchroniser maintenant'));
    expect(defaultProps.onSync).toHaveBeenCalled();
  });

  it('should show filtered message when isFiltered is true', () => {
    render(React.createElement(EmailInboxEmptyState, { ...defaultProps, isFiltered: true }));
    expect(screen.getByText('Aucun email trouvé')).toBeInTheDocument();
    expect(screen.queryByText('Envoyer un email')).not.toBeInTheDocument();
  });
});
