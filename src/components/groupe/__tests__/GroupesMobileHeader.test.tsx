import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

import { GroupesMobileHeader } from '../GroupesMobileHeader';

const stats = { displayed: 8, total: 15, ght: 5 };

describe('GroupesMobileHeader', () => {
  it('renders title', () => {
    render(
      <GroupesMobileHeader
        searchValue=""
        onSearchChange={vi.fn()}
        onCreateClick={vi.fn()}
        stats={stats}
      />
    );
    expect(screen.getByText('Groupes')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(
      <GroupesMobileHeader
        searchValue="CHU"
        onSearchChange={vi.fn()}
        onCreateClick={vi.fn()}
        stats={stats}
      />
    );
    expect(screen.getByDisplayValue('CHU')).toBeInTheDocument();
  });
});
