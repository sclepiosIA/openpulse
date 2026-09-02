// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CanvasLegend } from './CanvasLegend';

vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => <svg data-testid="chevron-down" className={className} />,
  ChevronUp: ({ className }: { className?: string }) => <svg data-testid="chevron-up" className={className} />,
  Info: ({ className }: { className?: string }) => <svg data-testid="info-icon" className={className} />,
}));

describe('CanvasLegend', () => {
  it('affiche la légende ouverte par défaut avec toutes les lignes métier attendues', () => {
    const { container } = render(<CanvasLegend />);

    expect(screen.getByRole('button', { name: /légende/i })).toBeInTheDocument();
    expect(screen.getByTestId('info-icon')).toBeInTheDocument();
    expect(screen.getByTestId('chevron-up')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-down')).not.toBeInTheDocument();

    expect(screen.getByText('Succès')).toBeInTheDocument();
    expect(screen.getByText('Échec')).toBeInTheDocument();
    expect(screen.getByText('Simulé (test)')).toBeInTheDocument();
    expect(screen.getByText('Avertissement')).toBeInTheDocument();
    expect(screen.getByText('Non exécuté')).toBeInTheDocument();

    const successDot = screen.getByText('Succès').previousElementSibling;
    const failureDot = screen.getByText('Échec').previousElementSibling;
    const simulatedDot = screen.getByText('Simulé (test)').previousElementSibling;
    const warningDot = screen.getByText('Avertissement').previousElementSibling;
    const skippedDot = screen.getByText('Non exécuté').previousElementSibling;

    expect(successDot).toHaveClass('bg-emerald-500');
    expect(failureDot).toHaveClass('bg-destructive', 'animate-pulse');
    expect(simulatedDot).toHaveClass('bg-blue-500', 'ring-2', 'ring-dashed');
    expect(warningDot).toHaveClass('bg-amber-500');
    expect(skippedDot).toHaveClass('bg-muted-foreground/40');

    const root = container.firstElementChild;
    expect(root).toHaveClass('absolute', 'top-3', 'left-3', 'z-10');
  });

  it('replie le contenu au clic puis le réaffiche au clic suivant', () => {
    render(<CanvasLegend />);

    const toggleButton = screen.getByRole('button', { name: /légende/i });

    expect(screen.getByText('Succès')).toBeInTheDocument();
    expect(screen.getByTestId('chevron-up')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.queryByText('Succès')).not.toBeInTheDocument();
    expect(screen.queryByText('Échec')).not.toBeInTheDocument();
    expect(screen.queryByText('Simulé (test)')).not.toBeInTheDocument();
    expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-up')).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText('Succès')).toBeInTheDocument();
    expect(screen.getByText('Échec')).toBeInTheDocument();
    expect(screen.getByText('Simulé (test)')).toBeInTheDocument();
    expect(screen.getByText('Avertissement')).toBeInTheDocument();
    expect(screen.getByText('Non exécuté')).toBeInTheDocument();
    expect(screen.getByTestId('chevron-up')).toBeInTheDocument();
  });

  it('applique les styles structurels attendus sur le bouton et le conteneur de lignes', () => {
    render(<CanvasLegend />);

    const button = screen.getByRole('button', { name: /légende/i });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('flex', 'items-center', 'gap-1.5', 'px-2.5', 'py-1.5', 'w-full');

    const successRow = screen.getByText('Succès').parentElement;
    expect(successRow).toHaveClass('flex', 'items-center', 'gap-2');

    const content = successRow?.parentElement;
    expect(content).toHaveClass('px-3', 'pb-2.5', 'space-y-1.5', 'border-t');
  });
});