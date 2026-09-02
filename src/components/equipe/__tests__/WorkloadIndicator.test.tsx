import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkloadIndicator } from '../WorkloadIndicator';

describe('WorkloadIndicator', () => {
  it('renders low workload label', () => {
    render(<WorkloadIndicator workload="low" />);
    expect(screen.getByText('Faible')).toBeInTheDocument();
  });

  it('renders medium workload label', () => {
    render(<WorkloadIndicator workload="medium" />);
    expect(screen.getByText('Moyenne')).toBeInTheDocument();
  });

  it('renders high workload label', () => {
    render(<WorkloadIndicator workload="high" />);
    expect(screen.getByText('Élevée')).toBeInTheDocument();
  });

  it('renders task count when provided', () => {
    render(<WorkloadIndicator workload="low" taskCount={5} />);
    expect(screen.getByText('Faible (5)')).toBeInTheDocument();
  });

  it('renders without task count', () => {
    render(<WorkloadIndicator workload="high" />);
    expect(screen.getByText('Élevée')).toBeInTheDocument();
  });
});
