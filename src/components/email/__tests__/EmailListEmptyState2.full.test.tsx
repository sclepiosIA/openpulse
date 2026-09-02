import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailListEmptyState } from '../EmailListEmptyState';

describe('EmailListEmptyState', () => {
  it('renders no-results state', () => {
    render(<EmailListEmptyState type="no-results" />);
    expect(screen.getByText('Aucun résultat trouvé')).toBeInTheDocument();
  });

  it('renders reset button for no-results', () => {
    const onReset = vi.fn();
    render(<EmailListEmptyState type="no-results" onReset={onReset} />);
    fireEvent.click(screen.getByText('Réinitialiser les filtres'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('renders empty-inbox state', () => {
    render(<EmailListEmptyState type="empty-inbox" />);
    expect(screen.getByText('Votre boîte est vide')).toBeInTheDocument();
  });

  it('renders sync button for empty-inbox', () => {
    const onSync = vi.fn();
    render(<EmailListEmptyState type="empty-inbox" onSync={onSync} />);
    fireEvent.click(screen.getByText('Synchroniser maintenant'));
    expect(onSync).toHaveBeenCalledOnce();
  });

  it('renders not-configured state', () => {
    render(<EmailListEmptyState type="not-configured" />);
    expect(screen.getByText('Aucun compte configuré')).toBeInTheDocument();
  });

  it('renders settings button for not-configured', () => {
    const onSettings = vi.fn();
    render(<EmailListEmptyState type="not-configured" onSettings={onSettings} />);
    fireEvent.click(screen.getByText('Configurer un compte'));
    expect(onSettings).toHaveBeenCalledOnce();
  });

  it('hides buttons when handlers not provided', () => {
    render(<EmailListEmptyState type="no-results" />);
    expect(screen.queryByText('Réinitialiser les filtres')).not.toBeInTheDocument();
  });
});
