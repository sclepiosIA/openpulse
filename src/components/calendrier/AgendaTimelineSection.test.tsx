// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaTimelineSection } from './AgendaTimelineSection';

const { GROUP_OPEN, GROUP_CLOSED_SINGLE, STATS_OPEN, STATS_SINGLE, TASK_CARD_SPY, GET_GROUP_STATS_MOCK } = vi.hoisted(() => ({
  GROUP_OPEN: {
    title: 'Urgent',
    emoji: '🔥',
    color: '#ff0000',
    defaultOpen: true,
    tasks: [
      { id: 't1', title: 'Task one' },
      { id: 't2', title: 'Task two' },
    ],
  },
  GROUP_CLOSED_SINGLE: {
    title: 'Urgent',
    emoji: '🔥',
    color: '#ff0000',
    defaultOpen: false,
    tasks: [{ id: 't1', title: 'Task one' }],
  },
  STATS_OPEN: {
    completionRate: 50,
    avgDelay: 3,
    assigneeCount: 2,
    total: 2,
    completed: 1,
  },
  STATS_SINGLE: {
    completionRate: 100,
    avgDelay: 0,
    assigneeCount: 1,
    total: 1,
    completed: 1,
  },
  TASK_CARD_SPY: vi.fn(),
  GET_GROUP_STATS_MOCK: vi.fn(),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <div data-testid="card" className={className} style={style}>
      {children}
    </div>
  ),
  CardHeader: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
  }) => (
    <div data-testid="card-header" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 data-testid="card-title" className={className}>
      {children}
    </h2>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: { value: number; className?: string }) => (
    <div data-testid="progress" data-value={String(value)} className={className} />
  ),
}));

vi.mock('lucide-react', () => ({
  ChevronDown: ({ className }: { className?: string }) => <svg data-testid="chevron-down" className={className} />,
  ChevronRight: ({ className }: { className?: string }) => <svg data-testid="chevron-right" className={className} />,
}));

vi.mock('./TaskCard', () => ({
  TaskCard: (props: {
    task: { id: string; title: string };
    onClick: () => void;
    showDate: boolean;
    compact: boolean;
    showQuickActions: boolean;
    onMarkDone?: (taskId: string) => void;
    onPostpone?: (taskId: string) => void;
    onArchive?: (taskId: string) => void;
  }) => {
    TASK_CARD_SPY(props);
    return (
      <button data-testid={`task-card-${props.task.id}`} onClick={props.onClick}>
        {props.task.title}
      </button>
    );
  },
}));

vi.mock('@/lib/agendaUtils', () => ({
  getGroupStats: GET_GROUP_STATS_MOCK,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}));

describe('AgendaTimelineSection', () => {
  beforeEach(() => {
    TASK_CARD_SPY.mockClear();
    GET_GROUP_STATS_MOCK.mockReset();
  });

  it('affiche les informations du groupe, les stats et les cartes de tâches quand la section est ouverte', () => {
    GET_GROUP_STATS_MOCK.mockReturnValue(STATS_OPEN);

    const onTaskClick = vi.fn();
    const onMarkDone = vi.fn();
    const onPostpone = vi.fn();
    const onArchive = vi.fn();

    render(
      <AgendaTimelineSection
        group={GROUP_OPEN}
        onTaskClick={onTaskClick}
        viewMode="compact"
        onMarkDone={onMarkDone}
        onPostpone={onPostpone}
        onArchive={onArchive}
      />
    );

    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('2 tâches')).toBeInTheDocument();
    expect(screen.getByText('50% terminé')).toBeInTheDocument();
    expect(screen.getByText('3j de retard moy.')).toBeInTheDocument();
    expect(screen.getByText('2 responsables')).toBeInTheDocument();
    expect(screen.getByText('1 / 2 terminées')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '50');
    expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-right')).not.toBeInTheDocument();

    expect(screen.getByTestId('task-card-t1')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-t2')).toBeInTheDocument();

    expect(TASK_CARD_SPY).toHaveBeenCalledTimes(2);
    expect(TASK_CARD_SPY).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        task: GROUP_OPEN.tasks[0],
        showDate: false,
        compact: true,
        showQuickActions: true,
        onMarkDone,
        onPostpone,
        onArchive,
      })
    );
    expect(TASK_CARD_SPY).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        task: GROUP_OPEN.tasks[1],
        showDate: false,
        compact: true,
        showQuickActions: true,
        onMarkDone,
        onPostpone,
        onArchive,
      })
    );

    fireEvent.click(screen.getByTestId('task-card-t1'));
    expect(onTaskClick).toHaveBeenCalledTimes(1);
    expect(onTaskClick).toHaveBeenCalledWith(GROUP_OPEN.tasks[0]);
  });

  it('se replie au clic sur le header et masque la progression et les tâches', () => {
    GET_GROUP_STATS_MOCK.mockReturnValue(STATS_OPEN);

    render(<AgendaTimelineSection group={GROUP_OPEN} onTaskClick={vi.fn()} viewMode="detailed" />);

    fireEvent.click(screen.getByTestId('card-header'));

    expect(screen.getByTestId('chevron-right')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-down')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-card-t1')).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 2 terminées')).not.toBeInTheDocument();
    expect(screen.queryByText('50% terminé')).toBeInTheDocument();
  });

  it('démarre fermé si defaultOpen est false, gère le singulier et ouvre la liste au clic', () => {
    GET_GROUP_STATS_MOCK.mockReturnValue(STATS_SINGLE);

    render(<AgendaTimelineSection group={GROUP_CLOSED_SINGLE} onTaskClick={vi.fn()} viewMode="detailed" />);

    expect(screen.getByText('1 tâche')).toBeInTheDocument();
    expect(screen.getByTestId('chevron-right')).toBeInTheDocument();
    expect(screen.queryByTestId('chevron-down')).not.toBeInTheDocument();
    expect(screen.getByText('100% terminé')).toBeInTheDocument();
    expect(screen.getByText('1 responsable')).toBeInTheDocument();
    expect(screen.queryByTestId('task-card-t1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('progress')).not.toBeInTheDocument();
    expect(screen.queryByText('1 / 1 terminées')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('card-header'));

    expect(screen.getByTestId('chevron-down')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-t1')).toBeInTheDocument();
    expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '100');
    expect(screen.getByText('1 / 1 terminées')).toBeInTheDocument();
  });
});