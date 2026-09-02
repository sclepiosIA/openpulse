import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/ui/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    pullDistance: 0,
    isRefreshing: false,
    progress: 0,
    shouldRefresh: false,
    handlers: {},
  }),
}));

import { PullToRefresh } from '../PullToRefresh';

describe('PullToRefresh', () => {
  it('renders children', () => {
    render(
      <PullToRefresh onRefresh={async () => {}}>
        <div>Child content</div>
      </PullToRefresh>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PullToRefresh onRefresh={async () => {}} className="my-class">
        <div>Test</div>
      </PullToRefresh>
    );
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });
});
