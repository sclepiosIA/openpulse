import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeStatusBadge, getNodeRingClass } from './NodeStatusBadge';

vi.mock('lucide-react', () => {
  const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;
  return {
    CheckCircle2: Icon,
    XCircle: Icon,
    FlaskConical: Icon,
    AlertTriangle: Icon,
    Clock: Icon,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/popover', () => {
  function Popover({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  function PopoverTrigger({
    children,
    asChild,
  }: {
    children: React.ReactElement;
    asChild?: boolean;
  }) {
    if (asChild && React.isValidElement(children)) {
      return children;
    }
    return <button type="button">{children}</button>;
  }

  function PopoverContent({
    children,
    className,
    side,
  }: {
    children: React.ReactNode;
    className?: string;
    side?: string;
  }) {
    return (
      <div data-testid="popover-content" data-side={side} className={className}>
        {children}
      </div>
    );
  }

  return { Popover, PopoverTrigger, PopoverContent };
});

describe('NodeStatusBadge', () => {
  it('affiche le badge de succès avec le style emerald', () => {
    const { container } = render(<NodeStatusBadge execution={{ status: 'success' } as never} />);

    const badge = container.querySelector('span');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('bg-emerald-500');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Voir l'erreur" })).not.toBeInTheDocument();
  });

  it('affiche le badge simulated avec un title explicite', () => {
    const { container } = render(<NodeStatusBadge execution={{ status: 'simulated' } as never} />);

    const badge = container.querySelector('span[title="Simulé (mode test)"]');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('bg-blue-500');
  });

  it('affiche le badge scheduled avec le style amber', () => {
    const { container } = render(<NodeStatusBadge execution={{ status: 'scheduled' } as never} />);

    const badge = container.querySelector('span');
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('bg-amber-500');
  });

  it("affiche l'erreur d'exécution et le message détaillé pour un statut failed", async () => {
    const user = userEvent.setup();
    render(<NodeStatusBadge execution={{ status: 'failed', error: 'Connexion impossible' } as never} />);

    const trigger = screen.getByRole('button', { name: "Voir l'erreur" });
    expect(trigger.className).toContain('bg-destructive');
    expect(trigger.className).toContain('animate-pulse');

    await user.click(trigger);

    const content = screen.getByTestId('popover-content');
    expect(content).toHaveClass('w-80');
    expect(within(content).getByText("Erreur d'exécution")).toBeInTheDocument();
    expect(within(content).getByText('Connexion impossible')).toBeInTheDocument();
  });

  it("affiche 'Erreur inconnue' si le statut failed n'a pas de message", () => {
    render(<NodeStatusBadge execution={{ status: 'failed' } as never} />);

    const content = screen.getByTestId('popover-content');
    expect(within(content).getByText('Erreur inconnue')).toBeInTheDocument();
  });

  it('affiche les issues de validation avec priorité visuelle erreur et liste tous les messages', async () => {
    const user = userEvent.setup();
    render(
      <NodeStatusBadge
        issues={[
          { severity: 'warning', message: 'Champ optionnel manquant' } as never,
          { severity: 'error', message: 'Condition invalide' } as never,
          { severity: 'warning', message: 'Risque de doublon' } as never,
        ]}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Voir les avertissements' });
    expect(trigger.className).toContain('bg-destructive');

    await user.click(trigger);

    const content = screen.getByTestId('popover-content');
    expect(within(content).getByText('• Condition invalide')).toBeInTheDocument();
    expect(within(content).getByText('• Champ optionnel manquant')).toBeInTheDocument();
    expect(within(content).getByText('• Risque de doublon')).toBeInTheDocument();
  });

  it("affiche les warnings seuls avec le style amber quand il n'y a pas d'erreur", () => {
    render(
      <NodeStatusBadge
        issues={[
          { severity: 'warning', message: 'Validation partielle' } as never,
        ]}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Voir les avertissements' });
    expect(trigger.className).toContain('bg-amber-500');
    expect(screen.getByText('• Validation partielle')).toBeInTheDocument();
  });

  it("n'affiche rien en absence d'exécution et d'issues", () => {
    const { container } = render(<NodeStatusBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("privilégie l'état d'exécution sur les issues de validation", () => {
    const { container } = render(
      <NodeStatusBadge
        execution={{ status: 'success' } as never}
        issues={[{ severity: 'error', message: 'Ne devrait pas être affiché' } as never]}
      />
    );

    const span = container.querySelector('span');
    expect(span?.className).toContain('bg-emerald-500');
    expect(screen.queryByRole('button', { name: 'Voir les avertissements' })).not.toBeInTheDocument();
    expect(screen.queryByText('• Ne devrait pas être affiché')).not.toBeInTheDocument();
  });
});

describe('getNodeRingClass', () => {
  it('retourne la classe du ring pour success', () => {
    expect(getNodeRingClass({ status: 'success' } as never)).toBe('ring-2 ring-emerald-500/60');
  });

  it('retourne la classe du ring pour failed', () => {
    expect(getNodeRingClass({ status: 'failed' } as never)).toBe('ring-2 ring-destructive animate-pulse');
  });

  it('retourne la classe du ring pour simulated', () => {
    expect(getNodeRingClass({ status: 'simulated' } as never)).toBe('ring-2 ring-blue-500/70 ring-dashed');
  });

  it('retourne la classe du ring pour scheduled', () => {
    expect(getNodeRingClass({ status: 'scheduled' } as never)).toBe('ring-2 ring-amber-500/60');
  });

  it("retourne le ring d'erreur pour des issues error sans exécution", () => {
    expect(
      getNodeRingClass(undefined, [{ severity: 'error', message: 'Blocage' } as never])
    ).toBe('ring-2 ring-destructive/60');
  });

  it('retourne le ring warning pour des issues warning sans erreur', () => {
    expect(
      getNodeRingClass(undefined, [{ severity: 'warning', message: 'Attention' } as never])
    ).toBe('ring-2 ring-amber-500/50');
  });

  it("retourne une chaîne vide en absence d'état et d'issues", () => {
    expect(getNodeRingClass()).toBe('');
  });

  it("privilégie l'état d'exécution sur les issues", () => {
    expect(
      getNodeRingClass(
        { status: 'failed' } as never,
        [{ severity: 'warning', message: 'Secondaire' } as never]
      )
    ).toBe('ring-2 ring-destructive animate-pulse');
  });
});