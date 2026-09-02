import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EmailListEmptyState } from '@/components/email/EmailListEmptyState';

describe('EmailListEmptyState', () => {
  it('should render no-results state with reset button', () => {
    const onReset = vi.fn();
    render(React.createElement(EmailListEmptyState, { type: 'no-results', onReset }));
    expect(screen.getByText('Aucun résultat trouvé')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Réinitialiser les filtres'));
    expect(onReset).toHaveBeenCalled();
  });

  it('should render empty-inbox state with sync button', () => {
    const onSync = vi.fn();
    render(React.createElement(EmailListEmptyState, { type: 'empty-inbox', onSync }));
    expect(screen.getByText('Votre boîte est vide')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Synchroniser maintenant'));
    expect(onSync).toHaveBeenCalled();
  });

  it('should render not-configured state with settings button', () => {
    const onSettings = vi.fn();
    render(React.createElement(EmailListEmptyState, { type: 'not-configured', onSettings }));
    expect(screen.getByText('Aucun compte configuré')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Configurer un compte'));
    expect(onSettings).toHaveBeenCalled();
  });

  it('should render empty-inbox without sync button when onSync not provided', () => {
    render(React.createElement(EmailListEmptyState, { type: 'empty-inbox' }));
    expect(screen.getByText('Votre boîte est vide')).toBeInTheDocument();
    expect(screen.queryByText('Synchroniser maintenant')).not.toBeInTheDocument();
  });

  it('should return null for unknown type', () => {
    const { container } = render(React.createElement(EmailListEmptyState, { type: 'unknown' as any }));
    expect(container.firstChild).toBeNull();
  });
});
