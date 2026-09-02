import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentSortMenuCompact } from '../DeploymentSortMenuCompact';

const sortOptions = [
  { value: 'nom_asc', label: 'Nom (A-Z)' },
  { value: 'nom_desc', label: 'Nom (Z-A)' },
  { value: 'progression_desc', label: 'Progression ↓' },
];

describe('DeploymentSortMenuCompact', () => {
  it('renders sort trigger button', () => {
    render(
      <DeploymentSortMenuCompact
        sortValue="nom_asc"
        onSortChange={vi.fn()}
        sortOptions={sortOptions}
      />
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
  });

  it('has dropdown menu trigger', () => {
    render(
      <DeploymentSortMenuCompact
        sortValue="nom_asc"
        onSortChange={vi.fn()}
        sortOptions={sortOptions}
      />
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'menu');
  });
});
