// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { JarvisAlertCard } from './JarvisAlertCard';

const {
  COLORS,
  ANIMATIONS,
  ALERT_BASE,
} = vi.hoisted(() => ({
  COLORS: {
    urgent: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600' },
    risk: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600' },
    opportunity: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600' },
    reminder: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600' },
    insight: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600' },
    prediction: { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'text-cyan-600' },
  },
  ANIMATIONS: {
    fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 } },
    slideUp: { initial: { y: 8 }, animate: { y: 0 } },
  },
  ALERT_BASE: {
    type: 'prediction' as const,
    source: 'Jarvis',
    title: 'Réapprovisionner le stock',
    message: 'Le stock de café risque de passer sous le seuil demain matin.',
    actionLabel: 'Créer une tâche',
    actionCommand: 'create-restock-task',
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) => {
    return ({ className }: { className?: string }) => (
      <svg data-testid={`${name}-icon`} className={className} aria-hidden="true" />
    );
  };

  return {
    AlertTriangle: makeIcon('alert-triangle'),
    TrendingUp: makeIcon('trending-up'),
    Clock: makeIcon('clock'),
    Lightbulb: makeIcon('lightbulb'),
    Sparkles: makeIcon('sparkles'),
    ChevronRight: makeIcon('chevron-right'),
    X: makeIcon('x'),
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    className,
    onClick,
    type = 'button',
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} className={className} onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('@/contexts/JarvisUnifiedContext', () => ({
  JARVIS_COLORS: COLORS,
  JARVIS_ANIMATIONS: ANIMATIONS,
}));

describe('JarvisAlertCard', () => {
  it('rend la version complète avec les valeurs métier attendues pour une alerte prediction', () => {
    const { container } = render(<JarvisAlertCard alert={ALERT_BASE} className="custom-card" />);

    expect(screen.getByText('Suggestion')).toBeInTheDocument();
    expect(screen.getByText('Jarvis')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Réapprovisionner le stock' })).toBeInTheDocument();
    expect(
      screen.getByText('Le stock de café risque de passer sous le seuil demain matin.')
    ).toBeInTheDocument();

    const label = screen.getByText('Suggestion');
    expect(label.className).toContain('text-cyan-600');

    const rootCard = container.firstElementChild;
    expect(rootCard?.className).toContain('bg-cyan-50');
    expect(rootCard?.className).toContain('border-cyan-200');
    expect(rootCard?.className).toContain('custom-card');

    expect(screen.queryByRole('button', { name: 'Créer une tâche' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ignorer' })).not.toBeInTheDocument();

    const sparklesIcons = screen.getAllByTestId('sparkles-icon');
    expect(sparklesIcons).toHaveLength(1);
    expect(sparklesIcons[0].className.baseVal).toContain('text-cyan-600');
  });

  it('déclenche onAction avec la commande exacte sur la version complète', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();

    render(
      <JarvisAlertCard
        alert={ALERT_BASE}
        onAction={onAction}
        onDismiss={onDismiss}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Créer une tâche' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('create-restock-task');

    fireEvent.click(screen.getByRole('button', { name: 'Ignorer' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
  });

  it('ne déclenche pas onAction si actionCommand est absent', () => {
    const onAction = vi.fn();
    const alertWithoutCommand = {
      ...ALERT_BASE,
      actionCommand: undefined,
    };

    render(<JarvisAlertCard alert={alertWithoutCommand} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Créer une tâche' }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('rend la version compacte et utilise les couleurs et actions attendues pour une alerte urgent', () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const urgentAlert = {
      ...ALERT_BASE,
      type: 'urgent' as const,
      message: 'Une intervention immédiate est nécessaire.',
    };

    const { container } = render(
      <JarvisAlertCard
        alert={urgentAlert}
        compact
        onAction={onAction}
        onDismiss={onDismiss}
        className="compact-class"
      />
    );

    expect(screen.getByText('Une intervention immédiate est nécessaire.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer une tâche' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fermer cette alerte' })).toBeInTheDocument();

    const compactCard = container.firstElementChild;
    expect(compactCard?.className).toContain('bg-red-50');
    expect(compactCard?.className).toContain('border-red-200');
    expect(compactCard?.className).toContain('compact-class');

    const alertTriangleIcons = screen.getAllByTestId('alert-triangle-icon');
    expect(alertTriangleIcons).toHaveLength(1);
    expect(alertTriangleIcons[0].className.baseVal).toContain('text-red-600');

    fireEvent.click(screen.getByRole('button', { name: 'Créer une tâche' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('create-restock-task');

    fireEvent.click(screen.getByRole('button', { name: 'Fermer cette alerte' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('n affiche aucun bouton d action si onAction est absent même avec actionLabel', () => {
    render(<JarvisAlertCard alert={ALERT_BASE} compact />);

    expect(screen.queryByRole('button', { name: 'Créer une tâche' })).not.toBeInTheDocument();
  });

  it('associe correctement chaque type à son libellé, son icône et sa couleur principaux', () => {
    const cases = [
      { type: 'risk' as const, expectedLabel: 'Risque', iconTestId: 'alert-triangle-icon', color: 'text-orange-600' },
      { type: 'opportunity' as const, expectedLabel: 'Opportunité', iconTestId: 'trending-up-icon', color: 'text-green-600' },
      { type: 'reminder' as const, expectedLabel: 'Rappel', iconTestId: 'clock-icon', color: 'text-blue-600' },
      { type: 'insight' as const, expectedLabel: 'Insight', iconTestId: 'lightbulb-icon', color: 'text-purple-600' },
    ];

    for (const testCase of cases) {
      const { unmount } = render(
        <JarvisAlertCard
          alert={{
            ...ALERT_BASE,
            type: testCase.type,
            title: `Titre ${testCase.type}`,
          }}
        />
      );

      const label = screen.getByText(testCase.expectedLabel);
      expect(label).toBeInTheDocument();
      expect(label.className).toContain(testCase.color);

      const icons = screen.getAllByTestId(testCase.iconTestId);
      expect(icons).toHaveLength(1);
      expect(icons[0].className.baseVal).toContain(testCase.color);

      unmount();
    }
  });
});