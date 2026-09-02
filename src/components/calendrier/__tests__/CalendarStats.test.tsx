import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarStats } from '../CalendarStats';

vi.mock('@/hooks/calendar/useCalendarStats', () => ({
  useCalendarStats: () => ({
    totalTasks: 25,
    completedTasks: 20,
    completionRate: 80,
    overdueTasks: 3,
    avgTasksPerDay: 2.5,
    upcomingTasks: { next7Days: 5, next30Days: 12 },
    tasksByCategory: [],
    tasksByAssignee: [],
    timeDistribution: [],
  }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  Tooltip: () => <div />,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Legend: () => <div />,
}));

describe('CalendarStats', () => {
  const tasks: any[] = [];
  const start = new Date('2026-01-01');
  const end = new Date('2026-03-01');

  it('renders total tasks KPI', () => {
    render(<CalendarStats tasks={tasks} startDate={start} endDate={end} />);
    expect(screen.getByText('Total des tâches')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('renders completion rate', () => {
    render(<CalendarStats tasks={tasks} startDate={start} endDate={end} />);
    expect(screen.getByText('Taux de complétion')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument();
  });

  it('renders overdue tasks', () => {
    render(<CalendarStats tasks={tasks} startDate={start} endDate={end} />);
    expect(screen.getByText('Tâches en retard')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders upcoming tasks', () => {
    render(<CalendarStats tasks={tasks} startDate={start} endDate={end} />);
    expect(screen.getByText('À venir (7j)')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('12 sur 30 jours')).toBeInTheDocument();
  });

  it('shows avg per day', () => {
    render(<CalendarStats tasks={tasks} startDate={start} endDate={end} />);
    expect(screen.getByText('2.5 par jour en moyenne')).toBeInTheDocument();
  });
});
