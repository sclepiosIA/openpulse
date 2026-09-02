import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarOverviewPanel } from '../CalendarOverviewPanel';

const tasks = [
  { id: '1', titre: 'Tâche A', statut: 'Terminé', echeance: '2026-03-01', created_at: '2026-02-01' },
  { id: '2', titre: 'Tâche B', statut: 'En cours', echeance: '2026-03-10', created_at: '2026-02-05' },
  { id: '3', titre: 'Tâche C', statut: 'A faire', echeance: '2026-03-15', created_at: '2026-02-10' },
  { id: '4', titre: 'Tâche D', statut: 'Bloqué', echeance: '2026-01-01', created_at: '2025-12-01' },
];

describe('CalendarOverviewPanel', () => {
  it('renders progression globale', () => {
    render(<CalendarOverviewPanel tasks={tasks} currentView="month" currentDate={new Date(2026, 2, 9)} />);
    expect(screen.getByText('Progression globale')).toBeInTheDocument();
  });

  it('shows completion percentage', () => {
    render(<CalendarOverviewPanel tasks={tasks} currentView="month" currentDate={new Date(2026, 2, 9)} />);
    expect(screen.getByText('25%')).toBeInTheDocument(); // 1/4 = 25%
  });

  it('shows status badges', () => {
    render(<CalendarOverviewPanel tasks={tasks} currentView="month" currentDate={new Date(2026, 2, 9)} />);
    expect(screen.getByText(/1 à faire/)).toBeInTheDocument();
    expect(screen.getByText(/1 en cours/)).toBeInTheDocument();
    expect(screen.getByText(/1 bloquées/)).toBeInTheDocument();
    expect(screen.getByText(/1 terminées/)).toBeInTheDocument();
  });

  it('shows overdue badge when applicable', () => {
    render(<CalendarOverviewPanel tasks={tasks} currentView="month" currentDate={new Date(2026, 2, 9)} />);
    // Tâche D has echeance 2026-01-01 and statut Bloqué → overdue
    expect(screen.getByText(/en retard/)).toBeInTheDocument();
  });

  it('shows total tasks count', () => {
    render(<CalendarOverviewPanel tasks={tasks} currentView="month" currentDate={new Date(2026, 2, 9)} />);
    expect(screen.getByText(/4 tâches/)).toBeInTheDocument();
  });

  it('handles empty tasks', () => {
    render(<CalendarOverviewPanel tasks={[]} currentView="month" currentDate={new Date(2026, 2, 9)} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText(/0 tâches/)).toBeInTheDocument();
  });
});
