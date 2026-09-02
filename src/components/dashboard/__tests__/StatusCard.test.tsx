import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { StatusCard } from '@/components/dashboard/StatusCard';

describe('StatusCard', () => {
  const defaultProps = {
    statut: 'Prospect',
    count: 12,
    totalValue: 50000,
    totalPassages: 1000,
    percentage: 30,
    icon: React.createElement('span', null, '🔵'),
    colorClasses: 'bg-blue-100 text-primary',
    onClick: vi.fn(),
  };

  it('should render status name', () => {
    render(React.createElement(StatusCard, defaultProps));
    expect(screen.getByText('Prospect')).toBeInTheDocument();
  });

  it('should render count', () => {
    render(React.createElement(StatusCard, defaultProps));
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('should render zero count', () => {
    render(React.createElement(StatusCard, { ...defaultProps, count: 0 }));
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    render(React.createElement(StatusCard, defaultProps));
    const card = screen.getByText('Prospect').closest('[class]');
    if (card) fireEvent.click(card);
    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  it('should render percentage', () => {
    render(React.createElement(StatusCard, defaultProps));
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });
});
