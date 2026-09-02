import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GanttRoleLegend } from '../GanttRoleLegend';

describe('GanttRoleLegend', () => {
  it('renders legend title', () => {
    render(<GanttRoleLegend />);
    expect(screen.getByText('Légende des rôles :')).toBeInTheDocument();
  });

  it('renders known roles', () => {
    render(<GanttRoleLegend />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getByText('CSM')).toBeInTheDocument();
  });

  it('renders "Non assigné" entry', () => {
    render(<GanttRoleLegend />);
    expect(screen.getByText('Non assigné')).toBeInTheDocument();
  });

  it('renders color indicators', () => {
    const { container } = render(<GanttRoleLegend />);
    const colorDots = container.querySelectorAll('.rounded-full');
    // 8 roles + 1 "Non assigné" = 9
    expect(colorDots.length).toBe(9);
  });
});
