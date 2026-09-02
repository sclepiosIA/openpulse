import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

import { RapportsMobileHeader } from '../RapportsMobileHeader';

describe('RapportsMobileHeader', () => {
  it('renders title', () => {
    render(
      <RapportsMobileHeader stats={{ etablissements: 42, caTotal: '250 000 €' }} />
    );
    expect(screen.getByText('Rapports')).toBeInTheDocument();
  });

  it('renders stats subtitle', () => {
    const { container } = render(
      <RapportsMobileHeader stats={{ etablissements: 42, caTotal: '250 000 €' }} />
    );
    expect(container.textContent).toContain('étab.');
  });

  it('renders container', () => {
    const { container } = render(
      <RapportsMobileHeader stats={{ etablissements: 10, caTotal: '100 000 €' }} />
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
