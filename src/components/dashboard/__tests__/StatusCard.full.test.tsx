import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusCard } from '../StatusCard';
import { Building2 } from 'lucide-react';

describe('StatusCard', () => {
  const props = {
    statut: 'Production',
    count: 15,
    totalValue: 250000,
    totalPassages: 5000,
    percentage: 45,
    icon: <Building2 className="h-4 w-4" />,
    colorClasses: 'text-success',
    onClick: vi.fn(),
  };

  it('renders statut label', () => {
    render(<StatusCard {...props} />);
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders count', () => {
    render(<StatusCard {...props} />);
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('renders percentage', () => {
    render(<StatusCard {...props} />);
    expect(screen.getByText('45% du total')).toBeInTheDocument();
  });

  it('renders passages count', () => {
    render(<StatusCard {...props} />);
    expect(screen.getByText(/5[\s\u202f]?000 passages/)).toBeInTheDocument();
  });

  it('has role button and aria-label', () => {
    render(<StatusCard {...props} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label');
  });

  it('calls onClick when clicked', () => {
    render(<StatusCard {...props} />);
    screen.getByRole('button').click();
    expect(props.onClick).toHaveBeenCalled();
  });
});
