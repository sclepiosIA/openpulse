import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PhaseSection } from '@/components/dashboard/PhaseSection';

describe('PhaseSection', () => {
  const defaultProps = {
    name: 'Commercial',
    icon: React.createElement('span', null, '📋'),
    color: '#3b82f6',
    statuses: [
      {
        name: 'Prospect',
        data: { count: 5, percentage: 30, totalPassages: 1000, totalValue: 10000 },
        icon: React.createElement('span', null, '🔵'),
        colorClasses: 'bg-blue-100 text-blue-800',
      },
      {
        name: 'Contacté',
        data: { count: 3, percentage: 20, totalPassages: 500, totalValue: 5000 },
        icon: React.createElement('span', null, '🟢'),
        colorClasses: 'bg-green-100 text-green-800',
      },
    ],
    onStatusClick: vi.fn(),
  };

  it('should render phase name', () => {
    render(React.createElement(PhaseSection, defaultProps));
    expect(screen.getByText('Commercial')).toBeInTheDocument();
  });

  it('should render total count', () => {
    render(React.createElement(PhaseSection, defaultProps));
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('should expand to show statuses when clicked', () => {
    render(React.createElement(PhaseSection, defaultProps));
    fireEvent.click(screen.getByText('Commercial'));
    expect(screen.getByText('Prospect')).toBeInTheDocument();
    expect(screen.getByText('Contacté')).toBeInTheDocument();
  });

  it('should handle empty statuses gracefully', () => {
    const { container } = render(React.createElement(PhaseSection, { ...defaultProps, statuses: [] }));
    // PhaseSection may return null or render empty for no statuses
    expect(container).toBeDefined();
  });
});
