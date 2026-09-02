import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AIEntityLink } from '../AIEntityLink';

describe('AIEntityLink', () => {
  const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

  it('renders etablissement entity', () => {
    wrap(<AIEntityLink entity={{ type: 'etablissement', id: 'e1', name: 'CHU Lyon' }} />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('renders tache entity', () => {
    wrap(<AIEntityLink entity={{ type: 'tache', id: 't1', name: 'Installer module' }} />);
    expect(screen.getByText('Installer module')).toBeInTheDocument();
  });

  it('renders email entity', () => {
    wrap(<AIEntityLink entity={{ type: 'email', id: 'em1', name: 'RE: Contrat' }} />);
    expect(screen.getByText('RE: Contrat')).toBeInTheDocument();
  });

  it('renders contact entity', () => {
    wrap(<AIEntityLink entity={{ type: 'contact', id: 'c1', name: 'Dr Martin' }} />);
    expect(screen.getByText('Dr Martin')).toBeInTheDocument();
  });

  it('renders groupe entity', () => {
    wrap(<AIEntityLink entity={{ type: 'groupe', id: 'g1', name: 'GHT Nord' }} />);
    expect(screen.getByText('GHT Nord')).toBeInTheDocument();
  });

  it('renders partenaire entity', () => {
    wrap(<AIEntityLink entity={{ type: 'partenaire', id: 'p1', name: 'Softway' }} />);
    expect(screen.getByText('Softway')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = wrap(
      <AIEntityLink entity={{ type: 'etablissement', id: 'e1', name: 'Test' }} className="custom" />
    );
    expect(container.querySelector('.custom')).toBeInTheDocument();
  });
});
