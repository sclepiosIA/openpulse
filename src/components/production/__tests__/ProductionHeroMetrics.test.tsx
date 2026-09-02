import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/valueCalculations', () => ({
  calculateEtablissementValue: () => 50000,
}));

import { ProductionHeroMetrics } from '../ProductionHeroMetrics';

const stats = {
  totalClients: 25,
  totalRevenue: 1250000,
  averageContractDuration: 18,
  clientsByHealth: { healthy: 15, warning: 7, critical: 3 },
  trends: { recentlyLaunched: 3 },
  renewals: {
    next30Days: [],
    next90Days: [],
    expired: [],
  },
};

describe('ProductionHeroMetrics', () => {
  it('renders metrics cards', () => {
    render(<ProductionHeroMetrics stats={stats as any} />);
    expect(screen.getByText('Clients actifs')).toBeInTheDocument();
  });

  it('renders total count', () => {
    render(<ProductionHeroMetrics stats={stats as any} />);
    expect(screen.getByText('25')).toBeInTheDocument();
  });
});
