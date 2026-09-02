import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { HeroMetrics } from '@/components/dashboard/HeroMetrics';

describe('HeroMetrics', () => {
  const defaultProps = {
    totalEtablissements: 42,
    prospects: 15,
    contractuels: 7,
    production: 20,
    totalValeur: 1500000,
    urgentTasksCount: 3,
    conversionRate: 45.2,
  };

  it('should render total etablissements', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(HeroMetrics, defaultProps)));
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render description with production count', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(HeroMetrics, defaultProps)));
    expect(screen.getByText(/20 production/)).toBeInTheDocument();
  });

  it('should render Total Établissements label', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(HeroMetrics, defaultProps)));
    expect(screen.getByText(/Total Établissements/i)).toBeInTheDocument();
  });

  it('should handle zero values', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(HeroMetrics, {
      totalEtablissements: 0,
      prospects: 0,
      contractuels: 0,
      production: 0,
      totalValeur: 0,
      urgentTasksCount: 0,
      conversionRate: 0,
    })));
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });
});
