import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/contexts/MobileDrawerContext', () => ({
  useMobileDrawer: () => ({ open: vi.fn() }),
}));

import { TodoMobileHeader } from '../TodoMobileHeader';

const stats = { total: 12, overdue: 2, today: 3 };

describe('TodoMobileHeader', () => {
  it('renders title', () => {
    render(
      <TodoMobileHeader
        stats={stats}
        onOpenFilters={vi.fn()}
        onCreateTask={vi.fn()}
        onSearchClick={vi.fn()}
      />
    );
    expect(screen.getByText('Tâches')).toBeInTheDocument();
  });

  it('renders stats text', () => {
    render(
      <TodoMobileHeader
        stats={stats}
        onOpenFilters={vi.fn()}
        onCreateTask={vi.fn()}
        onSearchClick={vi.fn()}
      />
    );
    expect(screen.getByText(/retard/)).toBeInTheDocument();
  });
});
