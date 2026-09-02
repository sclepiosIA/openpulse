import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders "Fait" for done status', () => {
    render(<StatusBadge status="done" />);
    expect(screen.getByText('Fait')).toBeInTheDocument();
  });

  it('renders "Planifié" for planned status', () => {
    render(<StatusBadge status="planned" />);
    expect(screen.getByText('Planifié')).toBeInTheDocument();
  });

  it('renders "En attente" for pending status', () => {
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('renders "Non réalisé" for skipped status', () => {
    render(<StatusBadge status="skipped" />);
    expect(screen.getByText('Non réalisé')).toBeInTheDocument();
  });

  it('renders "En cours de planification" for planning', () => {
    render(<StatusBadge status="planning" />);
    expect(screen.getByText('En cours de planification')).toBeInTheDocument();
  });

  it('renders fallback for empty status', () => {
    render(<StatusBadge status={'' as any} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge status="done" className="my-custom" />);
    expect(container.querySelector('.my-custom')).toBeInTheDocument();
  });

  it('applies correct color classes per status', () => {
    const { container } = render(<StatusBadge status="done" />);
    expect(container.querySelector('.bg-emerald-100')).toBeInTheDocument();
  });
});
