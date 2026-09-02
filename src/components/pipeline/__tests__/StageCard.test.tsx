import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StageCard } from '../StageCard';
import React from 'react';

describe('StageCard', () => {
  const mockStage = {
    name: 'Qualification',
    count: 12,
    value: 150000,
    color: 'bg-blue-500',
    icon: React.createElement('span', null, '🎯'),
    percentage: 35,
  };
  const onClick = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('renders stage name', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    expect(screen.getByText('Qualification')).toBeInTheDocument();
  });

  it('renders count', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders value in k€', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    expect(screen.getByText(/150.*k€/)).toBeInTheDocument();
  });

  it('renders percentage', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    expect(screen.getByText('35%')).toBeInTheDocument();
  });

  it('calls onClick on click', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('calls onClick on Enter key', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalled();
  });

  it('has accessible label', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', expect.stringContaining('Qualification'));
  });

  it('renders progressbar', () => {
    render(<StageCard stage={mockStage} onClick={onClick} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '35');
  });
});
