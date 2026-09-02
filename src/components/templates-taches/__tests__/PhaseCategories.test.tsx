import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhaseCategories } from '../PhaseCategories';

vi.mock('@/config/phases', () => ({
  PHASE_GROUPS: {
    commercial: { label: 'Commercial', categories: ['commercial'] },
    deploiement: { label: 'Déploiement', categories: ['Formation', 'Installation'] },
    production: { label: 'Production', categories: ['Support', 'Maintenance'] },
  },
}));

const mockCategories = [
  { id: 'c1', nom: 'Prise de contact', couleur: '#10b981', phase: 'commercial' },
  { id: 'c2', nom: 'Qualification', couleur: '#3b82f6', phase: 'commercial' },
];

describe('PhaseCategories', () => {
  it('shows loading state', () => {
    const { container } = render(
      <PhaseCategories phase="commercial" categories={[]} isLoading={true} />
    );
    // Loading renders Skeleton divs, not categories
    expect(screen.queryByText(/Aucune catégorie/)).toBeNull();
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('renders categories with badges', () => {
    render(<PhaseCategories phase="commercial" categories={mockCategories as any} isLoading={false} />);
    expect(screen.getByText('Prise de contact')).toBeInTheDocument();
    expect(screen.getByText('Qualification')).toBeInTheDocument();
  });

  it('shows phase label', () => {
    render(<PhaseCategories phase="commercial" categories={mockCategories as any} isLoading={false} />);
    expect(screen.getByText(/phase Commercial/)).toBeInTheDocument();
  });

  it('shows empty message when no categories', () => {
    render(<PhaseCategories phase="deploiement" categories={[]} isLoading={false} />);
    expect(screen.getByText(/Aucune catégorie configurée/)).toBeInTheDocument();
    expect(screen.getByText(/Formation, Installation/)).toBeInTheDocument();
  });
});
