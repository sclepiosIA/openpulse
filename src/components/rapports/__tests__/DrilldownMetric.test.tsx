import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrendingUp } from 'lucide-react';
import { DrilldownMetric } from '../DrilldownMetric';

vi.mock('@/hooks/analytics/useDrilldown', () => ({
  useDrilldown: () => ({
    drilldownTo: vi.fn(),
    breadcrumbs: [],
    goToLevel: vi.fn(),
    resetDrilldown: vi.fn(),
  }),
}));

describe('DrilldownMetric', () => {
  it('renders title and value', () => {
    render(<DrilldownMetric title="CA Total" value="150 000 €" icon={TrendingUp} />);
    expect(screen.getByText('CA Total')).toBeInTheDocument();
    expect(screen.getByText('150 000 €')).toBeInTheDocument();
  });

  it('renders evolution when provided', () => {
    render(<DrilldownMetric title="CA" value="100k" icon={TrendingUp} evolution={12.5} />);
    expect(screen.getByText(/12.5/)).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<DrilldownMetric title="CA" value="100k" icon={TrendingUp} description="Total annuel" />);
    expect(screen.getByText('Total annuel')).toBeInTheDocument();
  });
});
