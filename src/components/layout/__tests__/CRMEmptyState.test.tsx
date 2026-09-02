import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CRMEmptyState } from '../CRMEmptyState';
import { Search } from 'lucide-react';

describe('CRMEmptyState', () => {
  it('renders title and description', () => {
    render(<CRMEmptyState icon={Search} title="Aucun résultat" description="Essayez autre chose" />);
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument();
    expect(screen.getByText('Essayez autre chose')).toBeInTheDocument();
  });

  it('shows reset filters button when hasFilters', () => {
    const onReset = vi.fn();
    render(<CRMEmptyState icon={Search} title="T" description="D" hasFilters onResetFilters={onReset} />);
    const btn = screen.getByText('Réinitialiser les filtres');
    fireEvent.click(btn);
    expect(onReset).toHaveBeenCalled();
  });

  it('shows create button when no filters', () => {
    const onCreate = vi.fn();
    render(<CRMEmptyState icon={Search} title="T" description="D" onCreate={onCreate} createLabel="Ajouter" />);
    const btn = screen.getByText('Ajouter');
    fireEvent.click(btn);
    expect(onCreate).toHaveBeenCalled();
  });

  it('renders children instead of default buttons', () => {
    render(<CRMEmptyState icon={Search} title="T" description="D"><span>Custom</span></CRMEmptyState>);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.queryByText('Créer')).not.toBeInTheDocument();
  });

  it('supports compact variant', () => {
    const { container } = render(<CRMEmptyState icon={Search} title="T" description="D" variant="compact" />);
    expect(container.querySelector('.py-8')).toBeInTheDocument();
  });
});
