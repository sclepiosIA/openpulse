import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Search } from 'lucide-react';
import { CRMEmptyState } from '../CRMEmptyState';

describe('CRMEmptyState', () => {
  it('renders title and description', () => {
    render(<CRMEmptyState icon={Search} title="Aucun résultat" description="Essayez d'autres filtres" />);
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
    expect(screen.getByText("Essayez d'autres filtres")).toBeInTheDocument();
  });

  it('renders create button when onCreate provided', () => {
    render(
      <CRMEmptyState
        icon={Search}
        title="Vide"
        description="Rien ici"
        onCreate={vi.fn()}
        createLabel="Ajouter"
      />
    );
    expect(screen.getByText('Ajouter')).toBeInTheDocument();
  });

  it('renders reset button when hasFilters', () => {
    render(
      <CRMEmptyState
        icon={Search}
        title="Vide"
        description="Rien"
        hasFilters
        onResetFilters={vi.fn()}
      />
    );
    expect(screen.getByText('Réinitialiser les filtres')).toBeInTheDocument();
  });

  it('calls onResetFilters on click', () => {
    const onReset = vi.fn();
    render(
      <CRMEmptyState icon={Search} title="V" description="D" hasFilters onResetFilters={onReset} />
    );
    fireEvent.click(screen.getByText('Réinitialiser les filtres'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('renders compact variant', () => {
    const { container } = render(
      <CRMEmptyState icon={Search} title="Vide" description="D" variant="compact" />
    );
    expect(container.querySelector('.py-8')).toBeInTheDocument();
  });
});
