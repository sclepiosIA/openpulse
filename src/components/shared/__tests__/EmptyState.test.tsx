import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '@/components/shared/EmptyState';
import { AlertTriangle } from 'lucide-react';

describe('EmptyState', () => {
  it('should render default empty state', () => {
    render(<EmptyState />);
    expect(screen.getByText('Aucun élément')).toBeInTheDocument();
    expect(screen.getByText("Il n'y a rien à afficher pour le moment.")).toBeInTheDocument();
  });

  it('should render no-results type', () => {
    render(<EmptyState type="no-results" />);
    expect(screen.getByText('Aucun résultat trouvé')).toBeInTheDocument();
  });

  it('should render error type', () => {
    render(<EmptyState type="error" />);
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
  });

  it('should render not-configured type', () => {
    render(<EmptyState type="not-configured" />);
    expect(screen.getByText('Configuration requise')).toBeInTheDocument();
  });

  it('should render custom title and description', () => {
    render(<EmptyState title="Custom Title" description="Custom Desc" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Desc')).toBeInTheDocument();
  });

  it('should render custom icon', () => {
    render(<EmptyState icon={AlertTriangle} title="Warning" />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('should render action button and call onClick', () => {
    const onClick = vi.fn();
    render(<EmptyState action={{ label: 'Retry', onClick }} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should render secondary action button', () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <EmptyState
        action={{ label: 'Primary', onClick: onPrimary }}
        secondaryAction={{ label: 'Secondary', onClick: onSecondary }}
      />
    );
    fireEvent.click(screen.getByText('Secondary'));
    expect(onSecondary).toHaveBeenCalledOnce();
  });

  it('should render different sizes', () => {
    const { rerender } = render(<EmptyState size="sm" title="Small" />);
    expect(screen.getByText('Small')).toBeInTheDocument();
    rerender(<EmptyState size="lg" title="Large" />);
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('should have role="status" and aria-label', () => {
    render(<EmptyState title="Test" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Test');
  });
});
