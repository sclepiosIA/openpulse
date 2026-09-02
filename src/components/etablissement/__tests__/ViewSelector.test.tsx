import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewSelector } from '@/components/etablissement/ViewSelector';

describe('ViewSelector', () => {
  it('should render all 4 view options', () => {
    render(<ViewSelector currentView="grid" onViewChange={vi.fn()} />);
    expect(screen.getByText('Cartes')).toBeInTheDocument();
    expect(screen.getByText('Tableau')).toBeInTheDocument();
    expect(screen.getByText('Liste')).toBeInTheDocument();
    expect(screen.getByText('Kanban')).toBeInTheDocument();
  });

  it('should render 4 view triggers (radiogroup)', () => {
    const { container } = render(<ViewSelector currentView="grid" onViewChange={vi.fn()} />);
    // Cf. commentaire ViewSelector.tsx : passé de Radix Tabs → radiogroup
    // (les Tabs sans TabsContent généraient un aria-controls invalide).
    const triggers = container.querySelectorAll('[role="radio"]');
    expect(triggers.length).toBe(4);
  });
});
