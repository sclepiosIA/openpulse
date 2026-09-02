import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '@/components/calendrier/TaskCard';

vi.mock('@/lib/calendarUtils', () => ({
  getPriorityColor: (p: string) => p === 'haute' ? '#ef4444' : '#3b82f6',
  getPriorityLabel: (p: string) => p === 'haute' ? 'Haute' : 'Basse',
  getStatusColor: (s: string) => s === 'terminee' ? '#22c55e' : '#f59e0b',
  getStatusLabel: (s: string) => s === 'terminee' ? 'Terminée' : 'En attente',
}));

vi.mock('./AgendaQuickActions', () => ({
  AgendaQuickActions: () => null,
}));

describe('TaskCard', () => {
  const baseTask = {
    id: 't1',
    titre: 'Préparer la démo',
    statut: 'en_attente',
    priorite: 'haute',
    description: 'Description de la tâche',
    echeance: '2026-04-01',
  };

  it('should render task title', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('Préparer la démo')).toBeInTheDocument();
  });

  it('should render status badge', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('should render priority label', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('Haute')).toBeInTheDocument();
  });

  it('should render description in non-compact mode', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('Description de la tâche')).toBeInTheDocument();
  });

  it('should hide description in compact mode', () => {
    render(<TaskCard task={baseTask} compact />);
    expect(screen.queryByText('Description de la tâche')).not.toBeInTheDocument();
  });

  it('should render completed task with strikethrough', () => {
    render(<TaskCard task={{ ...baseTask, statut: 'terminee' }} />);
    const title = screen.getByText('Préparer la démo');
    expect(title.className).toContain('line-through');
  });

  it('should render overdue badge', () => {
    render(<TaskCard task={{ ...baseTask, echeance: '2020-01-01' }} />);
    // Should show days overdue badge
    const badges = screen.getAllByText(/j$/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('should render assignee when present', () => {
    render(<TaskCard task={{ ...baseTask, responsable: { prenom: 'Jean', nom: 'Dupont' } }} />);
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('should render etablissement when present', () => {
    render(<TaskCard task={{ ...baseTask, etablissements: { nom: 'CHU Lyon' } }} />);
    expect(screen.getByText('CHU Lyon')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(<TaskCard task={baseTask} onClick={onClick} />);
    fireEvent.click(screen.getByText('Préparer la démo').closest('[class*="card"]')!);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
