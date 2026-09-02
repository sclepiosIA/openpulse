import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

import { AnalyseGeoMobileHeader } from '../AnalyseGeoMobileHeader';

const stats = { displayed: 42, total: 100, regions: 12, production: 25 };

describe('AnalyseGeoMobileHeader', () => {
  it('renders title', () => {
    render(
      <AnalyseGeoMobileHeader
        searchValue=""
        onSearchChange={vi.fn()}
        stats={stats}
      />
    );
    expect(screen.getByText('Analyse Géo')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <AnalyseGeoMobileHeader
        searchValue="test"
        onSearchChange={vi.fn()}
        stats={stats}
      />
    );
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });
});
