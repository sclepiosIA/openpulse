import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmailEtablissementBadge } from '../EmailEtablissementBadge';
import { MemoryRouter } from 'react-router-dom';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('EmailEtablissementBadge', () => {
  it('renders "Non classé" when no etablissement', () => {
    wrap(<EmailEtablissementBadge />);
    expect(screen.getByText('Non classé')).toBeInTheDocument();
  });

  it('renders etablissement name', () => {
    wrap(<EmailEtablissementBadge etablissementId="e1" etablissementNom="CHU Lyon" />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders ville when provided', () => {
    wrap(<EmailEtablissementBadge etablissementId="e1" etablissementNom="CHU Lyon" etablissementVille="Lyon" />);
    expect(screen.getByText('Lyon')).toBeInTheDocument();
  });

  it('calls onUnclassifiedClick when unclassified is clicked', () => {
    const onClick = vi.fn();
    wrap(<EmailEtablissementBadge onUnclassifiedClick={onClick} />);
    fireEvent.click(screen.getByText('Non classé'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders as button with link when showLink is true', () => {
    wrap(<EmailEtablissementBadge etablissementId="e1" etablissementNom="CHU" showLink />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies size sm class', () => {
    const { container } = wrap(<EmailEtablissementBadge size="sm" />);
    expect(container.querySelector('.text-xs')).toBeInTheDocument();
  });
});
