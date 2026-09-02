import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScoringMovementSection } from './ScoringMovementSection';

const { STABLE_ITEMS, EMPTY_ITEMS } = vi.hoisted(() => ({
  STABLE_ITEMS: [
    {
      id: 'p1',
      nom: 'Alice Martin',
      statut: 'Nouveau',
      velocity: 2.5,
      score: 87,
      last_engagement_at: '2024-01-10T12:00:00.000Z',
    },
    {
      id: 'p2',
      nom: 'Bob Durand',
      statut: 'Relancé',
      velocity: -1.2,
      score: 42,
      last_engagement_at: null,
    },
    {
      id: 'p3',
      nom: 'Claire Petit',
      statut: 'Qualifié',
      velocity: 0,
      score: 65,
      last_engagement_at: '2024-01-11T12:00:00.000Z',
    },
  ],
  EMPTY_ITEMS: [],
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <section data-testid="card">{children}</section>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <header data-testid="card-header">{children}</header>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <span data-testid={`badge-${variant ?? 'default'}`} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: (date: Date) => {
    const iso = date.toISOString();
    if (iso === '2024-01-10T12:00:00.000Z') return 'il y a 2 jours';
    if (iso === '2024-01-11T12:00:00.000Z') return 'il y a 1 jour';
    return 'il y a un moment';
  },
}));

vi.mock('date-fns/locale', () => ({
  fr: {},
}));

describe('ScoringMovementSection', () => {
  it('affiche les skeletons pendant le chargement et masque le contenu métier', () => {
    const onClick = vi.fn();

    render(
      <ScoringMovementSection
        title="Mouvements"
        icon={<span data-testid="icon">★</span>}
        items={STABLE_ITEMS}
        loading
        onClick={onClick}
      />,
    );

    expect(screen.getByText('Mouvements')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton')).toHaveLength(4);
    expect(screen.queryByText('Alice Martin')).not.toBeInTheDocument();
    expect(screen.queryByText('Aucun prospect dans ce segment.')).not.toBeInTheDocument();
  });

  it('affiche le texte vide personnalisé quand il n’y a aucun item', () => {
    const onClick = vi.fn();

    render(
      <ScoringMovementSection
        title="Sans prospects"
        icon={<span>○</span>}
        items={EMPTY_ITEMS}
        loading={false}
        emptyText="Aucun mouvement détecté."
        onClick={onClick}
      />,
    );

    expect(screen.getByText('Sans prospects')).toBeInTheDocument();
    expect(screen.getByText('Aucun mouvement détecté.')).toBeInTheDocument();
    expect(screen.queryByTestId('badge-secondary')).not.toBeInTheDocument();
  });

  it('affiche les données métier, le badge de count, les scores et les vitesses, puis déclenche onClick avec le bon id', () => {
    const onClick = vi.fn();

    render(
      <ScoringMovementSection
        title="Prospects en mouvement"
        icon={<span data-testid="trend-icon">↗</span>}
        items={STABLE_ITEMS}
        loading={false}
        onClick={onClick}
      />,
    );

    expect(screen.getByText('Prospects en mouvement')).toBeInTheDocument();
    expect(screen.getByTestId('trend-icon')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Bob Durand')).toBeInTheDocument();
    expect(screen.getByText('Claire Petit')).toBeInTheDocument();

    expect(screen.getByText('Nouveau')).toBeInTheDocument();
    expect(screen.getByText('Relancé')).toBeInTheDocument();
    expect(screen.getByText('Qualifié')).toBeInTheDocument();

    expect(screen.getByText('+2.5')).toBeInTheDocument();
    expect(screen.getByText('-1.2')).toBeInTheDocument();
    expect(screen.queryByText('+0.0')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();

    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Alice Martin/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith('p1');
  });

  it('affiche le dernier engagement et "jamais" selon les données', () => {
    const onClick = vi.fn();

    render(
      <ScoringMovementSection
        title="Engagement"
        icon={<span>⏱</span>}
        items={STABLE_ITEMS}
        loading={false}
        onClick={onClick}
        showLastEngagement
      />,
    );

    expect(screen.getByText(/il y a 2 jours/)).toBeInTheDocument();
    expect(screen.getByText(/il y a 1 jour/)).toBeInTheDocument();
    expect(screen.getByText(/jamais/)).toBeInTheDocument();
  });

  it('masque la vélocité et le dernier engagement quand les options sont désactivées', () => {
    const onClick = vi.fn();

    render(
      <ScoringMovementSection
        title="Options masquées"
        icon={<span>□</span>}
        items={STABLE_ITEMS}
        loading={false}
        onClick={onClick}
        showVelocity={false}
        showLastEngagement={false}
      />,
    );

    expect(screen.queryByText('+2.5')).not.toBeInTheDocument();
    expect(screen.queryByText('-1.2')).not.toBeInTheDocument();
    expect(screen.queryByText(/il y a 2 jours/)).not.toBeInTheDocument();
    expect(screen.queryByText(/il y a 1 jour/)).not.toBeInTheDocument();
    expect(screen.queryByText(/jamais/)).not.toBeInTheDocument();

    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
  });

  it('utilise le texte vide par défaut quand items est undefined', () => {
    const onClick = vi.fn();

    render(
      <ScoringMovementSection
        title="Segment vide"
        icon={<span>∅</span>}
        loading={false}
        onClick={onClick}
      />,
    );

    expect(screen.getByText('Aucun prospect dans ce segment.')).toBeInTheDocument();
  });
});