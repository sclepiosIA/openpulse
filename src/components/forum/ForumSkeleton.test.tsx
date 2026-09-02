/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ForumSkeleton } from './ForumSkeleton';

const { cardProps, headerProps, contentProps, skeletonProps } = vi.hoisted(() => ({
  cardProps: [] as Array<{ className?: string; children?: React.ReactNode }>,
  headerProps: [] as Array<{ className?: string; children?: React.ReactNode }>,
  contentProps: [] as Array<{ className?: string; children?: React.ReactNode }>,
  skeletonProps: [] as Array<{ className?: string }>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    cardProps.push({ className, children });
    return (
      <section data-testid="card" className={className}>
        {children}
      </section>
    );
  },
  CardHeader: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    headerProps.push({ className, children });
    return (
      <header data-testid="card-header" className={className}>
        {children}
      </header>
    );
  },
  CardContent: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    contentProps.push({ className, children });
    return (
      <div data-testid="card-content" className={className}>
        {children}
      </div>
    );
  },
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => {
    skeletonProps.push({ className });
    return <div data-testid="skeleton" className={className} />;
  },
}));

describe('ForumSkeleton', () => {
  beforeEach(() => {
    cardProps.length = 0;
    headerProps.length = 0;
    contentProps.length = 0;
    skeletonProps.length = 0;
  });

  it('renders exactly 3 animated cards with headers and content', () => {
    render(<ForumSkeleton />);

    const cards = screen.getAllByTestId('card');
    const headers = screen.getAllByTestId('card-header');
    const contents = screen.getAllByTestId('card-content');

    expect(cards).toHaveLength(3);
    expect(headers).toHaveLength(3);
    expect(contents).toHaveLength(3);

    for (const card of cards) {
      expect(card).toHaveClass('animate-pulse');
    }

    expect(cardProps.map((p) => p.className)).toEqual([
      'animate-pulse',
      'animate-pulse',
      'animate-pulse',
    ]);
  });

  it('renders 13 skeleton placeholders per card and 39 in total', () => {
    render(<ForumSkeleton />);

    const cards = screen.getAllByTestId('card');
    const allSkeletons = screen.getAllByTestId('skeleton');

    expect(allSkeletons).toHaveLength(39);

    for (const card of cards) {
      const skeletonsInCard = within(card).getAllByTestId('skeleton');
      expect(skeletonsInCard).toHaveLength(13);
    }
  });

  it('renders the expected skeleton class patterns repeated for each card', () => {
    render(<ForumSkeleton />);

    const expectedPerCard = [
      'h-5 w-16',
      'h-5 w-20',
      'h-5 w-16',
      'h-6 w-3/4',
      'h-8 w-8 rounded-full',
      'h-4 w-48',
      'h-3 w-32',
      'h-4 w-full',
      'h-4 w-5/6',
      'h-4 w-4/6',
      'h-4 w-12',
      'h-4 w-12',
      'h-4 w-12',
    ];

    const classNames = skeletonProps.map((p) => p.className);
    expect(classNames).toEqual([...expectedPerCard, ...expectedPerCard, ...expectedPerCard]);
  });

  it('applies the outer spacing layout classes and preserves structural grouping', () => {
    const { container } = render(<ForumSkeleton />);

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain('space-y-4');

    const firstCard = screen.getAllByTestId('card')[0];
    const firstHeader = within(firstCard).getByTestId('card-header');
    const firstContent = within(firstCard).getByTestId('card-content');

    expect(firstHeader).toBeInTheDocument();
    expect(firstContent).toBeInTheDocument();

    const contentSkeletons = within(firstContent).getAllByTestId('skeleton');
    expect(contentSkeletons).toHaveLength(6);

    expect(contentSkeletons.map((el) => el.className)).toEqual([
      'h-4 w-full',
      'h-4 w-5/6',
      'h-4 w-4/6',
      'h-4 w-12',
      'h-4 w-12',
      'h-4 w-12',
    ]);
  });
});