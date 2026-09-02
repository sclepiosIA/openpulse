import { describe, it, expect } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeamMemberCard } from '../TeamMemberCard';

const render = (ui: React.ReactElement) =>
  rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

describe('TeamMemberCard', () => {
  const defaultProps = {
    prenom: 'Jean',
    nom: 'Dupont',
    email: 'jean@test.com',
    role: 'admin' as string | null,
  };

  it('renders member name', () => {
    render(<TeamMemberCard {...defaultProps} />);
    expect(screen.getByText(/Jean/)).toBeInTheDocument();
    expect(screen.getByText(/Dupont/)).toBeInTheDocument();
  });

  it('renders initials avatar', () => {
    render(<TeamMemberCard {...defaultProps} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders role badge for admin', () => {
    render(<TeamMemberCard {...defaultProps} />);
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
  });

  it('renders commercial role label', () => {
    render(<TeamMemberCard {...defaultProps} role="commercial" />);
    expect(screen.getByText('Commercial')).toBeInTheDocument();
  });

  it('renders non-assigned role for null', () => {
    render(<TeamMemberCard {...defaultProps} role={null} />);
    expect(screen.getByText('Non assigné')).toBeInTheDocument();
  });

  it('renders email', () => {
    render(<TeamMemberCard {...defaultProps} />);
    expect(screen.getByText('jean@test.com')).toBeInTheDocument();
  });

  it('renders fonction when provided', () => {
    render(<TeamMemberCard {...defaultProps} fonction="Directeur" />);
    expect(screen.getByText('Directeur')).toBeInTheDocument();
  });
});
