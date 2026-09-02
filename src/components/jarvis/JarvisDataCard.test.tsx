import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { JarvisDataCard } from './JarvisDataCard';

const { formatNumberMock } = vi.hoisted(() => ({
  formatNumberMock: vi.fn((value: number) => `fmt:${value}`),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      whileHover,
      whileTap,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      whileHover?: unknown;
      whileTap?: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

vi.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon" {...props} />;
  return {
    Mail: Icon,
    CheckCircle2: Icon,
    Building2: Icon,
    TrendingUp: Icon,
    TrendingDown: Icon,
    Clock: Icon,
    User: Icon,
    Calendar: Icon,
    ExternalLink: Icon,
    AlertCircle: Icon,
    ArrowUpRight: Icon,
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  formatNumber: formatNumberMock,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    variant,
    size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      data-variant={variant}
      data-size={size}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    className,
    variant,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
    <span data-variant={variant} className={className} {...props}>
      {children}
    </span>
  ),
}));

describe('JarvisDataCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend une carte email avec badges, aperçu et déclenche les actions sans propager au clic parent', () => {
    const onClick = vi.fn();
    const onOpen = vi.fn();
    const onReply = vi.fn();

    render(
      <JarvisDataCard
        type="email"
        from="Alice Martin"
        subject="Relance dossier"
        preview="Pouvez-vous confirmer la date de rendez-vous ?"
        timestamp="Il y a 5 min"
        isUrgent
        category="Support"
        onClick={onClick}
        onOpen={onOpen}
        onReply={onReply}
      />,
    );

    expect(screen.getByText('Alice Martin')).toBeInTheDocument();
    expect(screen.getByText('Relance dossier')).toBeInTheDocument();
    expect(screen.getByText('Pouvez-vous confirmer la date de rendez-vous ?')).toBeInTheDocument();
    expect(screen.getByText('Il y a 5 min')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Ouvrir'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Répondre'));
    expect(onReply).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Relance dossier'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('rend une carte tâche en retard avec priorité, établissement, assigné et actions', () => {
    const onClick = vi.fn();
    const onComplete = vi.fn();
    const onView = vi.fn();

    render(
      <JarvisDataCard
        type="task"
        title="Préparer le bilan"
        dueDate="2000-01-01"
        priority="urgent"
        assignee="Nina"
        status="in_progress"
        etablissement="Clinique du Lac"
        onClick={onClick}
        onComplete={onComplete}
        onView={onView}
      />,
    );

    expect(screen.getByText('Préparer le bilan')).toBeInTheDocument();
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('Clinique du Lac')).toBeInTheDocument();
    expect(screen.getByText('Nina')).toBeInTheDocument();
    expect(screen.getByText('2000-01-01')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Terminer'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    const iconButtons = screen.getAllByRole('button');
    fireEvent.click(iconButtons[1]);
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Préparer le bilan'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('n affiche pas le bouton terminer pour une tâche déjà faite', () => {
    render(
      <JarvisDataCard
        type="task"
        title="Tâche terminée"
        priority="low"
        status="done"
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText('Tâche terminée')).toBeInTheDocument();
    expect(screen.getByText('Basse')).toBeInTheDocument();
    expect(screen.queryByText('Terminer')).not.toBeInTheDocument();
  });

  it('rend une carte établissement avec score santé, CA formaté, CSM et activité', () => {
    const onView = vi.fn();

    render(
      <JarvisDataCard
        type="etablissement"
        name="Hôpital Central"
        phase="Déploiement"
        healthScore={82}
        ca={125000}
        csm="Camille"
        lastActivity="Hier à 14:00"
        onView={onView}
      />,
    );

    expect(screen.getByText('Hôpital Central')).toBeInTheDocument();
    expect(screen.getByText('Déploiement')).toBeInTheDocument();
    expect(screen.getByText('Santé: 82%')).toBeInTheDocument();
    expect(screen.getByText('CA: fmt:125000€')).toBeInTheDocument();
    expect(screen.getByText('Camille')).toBeInTheDocument();
    expect(screen.getByText('Dernière activité: Hier à 14:00')).toBeInTheDocument();
    expect(formatNumberMock).toHaveBeenCalledWith(125000);

    fireEvent.click(screen.getByRole('button'));
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('rend une carte KPI en devise avec tendance positive et sparkline', () => {
    const { container } = render(
      <JarvisDataCard
        type="kpi"
        label="MRR"
        value={42000}
        trend={12}
        trendLabel="vs mois dernier"
        format="currency"
        sparkline={[10, 20, 30, 15]}
      />,
    );

    expect(screen.getByText('MRR')).toBeInTheDocument();
    expect(screen.getByText('fmt:42000€')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('vs mois dernier')).toBeInTheDocument();
    expect(formatNumberMock).toHaveBeenCalledWith(42000);

    const sparklineBars = container.querySelectorAll('.bg-primary\\/20');
    expect(sparklineBars).toHaveLength(4);
    expect((sparklineBars[0] as HTMLDivElement).style.height).toBe('33.33333333333333%');
    expect((sparklineBars[2] as HTMLDivElement).style.height).toBe('100%');
  });

  it('rend une carte KPI en pourcentage avec tendance négative', () => {
    render(
      <JarvisDataCard
        type="kpi"
        label="Churn"
        value={7}
        trend={-3}
        format="percent"
      />,
    );

    expect(screen.getByText('Churn')).toBeInTheDocument();
    expect(screen.getByText('7%')).toBeInTheDocument();
    expect(screen.getByText('3%')).toBeInTheDocument();
  });

  it('rend une valeur KPI string sans passer par formatNumber', () => {
    render(
      <JarvisDataCard
        type="kpi"
        label="Statut"
        value="En hausse"
      />,
    );

    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('En hausse')).toBeInTheDocument();
    expect(formatNumberMock).not.toHaveBeenCalled();
  });
});