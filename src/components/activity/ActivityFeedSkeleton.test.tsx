import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActivityFeedSkeleton } from './ActivityFeedSkeleton';

const { mockFrom, MockSkeleton } = vi.hoisted(() => {
  const builder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onFulfilled),
    catch: (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).catch(onRejected),
  };

  return {
    mockFrom: vi.fn(() => builder),
    MockSkeleton: ({ className }: { className?: string }) => (
      <div data-testid="skeleton" data-class={className ?? ''} />
    ),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: MockSkeleton,
}));

describe('ActivityFeedSkeleton', () => {
  it('renders default number of skeleton items (6)', () => {
    render(<ActivityFeedSkeleton />);

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(6 * 4);
  });

  it('renders custom number of skeleton items', () => {
    render(<ActivityFeedSkeleton count={3} />);

    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(3 * 4);
  });

  it('renders distinct containers for each skeleton row', () => {
    const { container } = render(<ActivityFeedSkeleton count={2} />);

    const rowContainers = container.querySelectorAll('.flex.gap-3.p-3');
    expect(rowContainers.length).toBe(2);

    const [firstRow, secondRow] = Array.from(rowContainers);
    expect(firstRow.isSameNode(secondRow)).toBe(false);
  });
});