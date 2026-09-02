import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KPIMiniCards } from '@/components/etablissement/KPIMiniCards';

describe('KPIMiniCards', () => {
  const defaultProps = {
    tasksCompleted: 8,
    tasksTotal: 12,
    progression: 65,
    upcomingDeadlines: 3,
    teamMembers: 5,
    documentsCount: 20,
  };

  it('should render tasks ratio', () => {
    render(<KPIMiniCards {...defaultProps} />);
    expect(screen.getByText('8/12')).toBeInTheDocument();
    expect(screen.getByText('terminées')).toBeInTheDocument();
  });

  it('should render progression percentage', () => {
    render(<KPIMiniCards {...defaultProps} />);
    const allMatches = screen.getAllByText('65%');
    expect(allMatches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Progression')).toBeInTheDocument();
  });

  it('should render deadlines count', () => {
    render(<KPIMiniCards {...defaultProps} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('cette semaine')).toBeInTheDocument();
  });

  it('should render team members count', () => {
    render(<KPIMiniCards {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('membres')).toBeInTheDocument();
  });

  it('should call onCardClick with section', () => {
    const onClick = vi.fn();
    render(<KPIMiniCards {...defaultProps} onCardClick={onClick} />);
    fireEvent.click(screen.getByText('Tâches').closest('[class*="card"]')!);
    expect(onClick).toHaveBeenCalledWith('taches');
  });

  it('should render zero tasks gracefully', () => {
    render(<KPIMiniCards {...defaultProps} tasksCompleted={0} tasksTotal={0} />);
    expect(screen.getByText('0/0')).toBeInTheDocument();
  });
});
