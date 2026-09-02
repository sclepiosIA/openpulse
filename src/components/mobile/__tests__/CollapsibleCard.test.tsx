import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CollapsibleCard } from '../CollapsibleCard';

describe('CollapsibleCard', () => {
  it('renders title', () => {
    render(<CollapsibleCard title="Ma section"><p>Contenu</p></CollapsibleCard>);
    expect(screen.getByText('Ma section')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <CollapsibleCard title="Avec icône" icon={<span data-testid="icon">★</span>}>
        <p>Contenu</p>
      </CollapsibleCard>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(
      <CollapsibleCard title="Avec badge" badge={<span>3</span>}>
        <p>Contenu</p>
      </CollapsibleCard>
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows preview when collapsed', () => {
    render(
      <CollapsibleCard title="Test" preview={<span>Aperçu</span>}>
        <p>Détail complet</p>
      </CollapsibleCard>
    );
    expect(screen.getByText('Aperçu')).toBeInTheDocument();
  });

  it('hides preview when open', () => {
    render(
      <CollapsibleCard title="Test" defaultOpen preview={<span>Aperçu</span>}>
        <p>Détail complet</p>
      </CollapsibleCard>
    );
    expect(screen.queryByText('Aperçu')).toBeNull();
    expect(screen.getByText('Détail complet')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CollapsibleCard title="Custom" className="my-custom">
        <p>C</p>
      </CollapsibleCard>
    );
    expect(container.querySelector('.my-custom')).toBeTruthy();
  });
});
