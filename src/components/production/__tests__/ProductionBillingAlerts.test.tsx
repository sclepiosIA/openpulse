import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/csm/useCsmFacturation', () => ({
  useCsmFacturation: () => ({ data: [] }),
}));

vi.mock('@/hooks/production/useProduction', () => ({
  useProduction: () => ({ data: [] }),
}));

import { ProductionBillingAlerts } from '../ProductionBillingAlerts';

describe('ProductionBillingAlerts', () => {
  it('renders nothing when no alerts', () => {
    const { container } = render(
      <MemoryRouter>
        <ProductionBillingAlerts />
      </MemoryRouter>
    );
    expect(container.innerHTML).toBe('');
  });
});
