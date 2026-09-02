import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskStatsOverview } from '../TaskStatsOverview';

const mockTasks = [
  { statut: 'A faire' },
  { statut: 'A faire' },
  { statut: 'En cours' },
  { statut: 'Bloqué' },
  { statut: 'Terminé' },
  { statut: 'Terminé' },
  { statut: 'Terminé' },
] as any[];

describe('TaskStatsOverview', () => {
  it('renders all 4 status cards', () => {
    render(<TaskStatsOverview tasks={mockTasks} />);
    expect(screen.getByText('A faire')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('Bloqué')).toBeInTheDocument();
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });

  it('renders correct counts for each status', () => {
    render(<TaskStatsOverview tasks={mockTasks} />);
    const counts = screen.getAllByText(/^\d+$/, { selector: '.text-2xl' });
    const values = counts.map(el => el.textContent);
    expect(values).toContain('2'); // A faire
    expect(values).toContain('3'); // Terminé
    expect(values.filter(v => v === '1')).toHaveLength(2); // En cours + Bloqué
  });

  it('calls onFilterClick with status', () => {
    const onFilterClick = vi.fn();
    render(<TaskStatsOverview tasks={mockTasks} onFilterClick={onFilterClick} />);
    fireEvent.click(screen.getByText('A faire').closest('[class*="cursor-pointer"]')!);
    expect(onFilterClick).toHaveBeenCalledWith('A faire');
  });

  it('handles empty tasks array', () => {
    render(<TaskStatsOverview tasks={[]} />);
    const zeros = screen.getAllByText('0');
    expect(zeros).toHaveLength(4);
  });
});
