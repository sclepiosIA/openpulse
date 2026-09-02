import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/ui/useSwipeActions', () => ({
  useSwipeActions: () => ({
    translateX: 0,
    isSwiping: false,
    handlers: {},
    hasLeftActions: false,
    hasRightActions: false,
  }),
}));

import { SwipeableListItem } from '../SwipeableListItem';

describe('SwipeableListItem', () => {
  it('renders children', () => {
    render(
      <SwipeableListItem>
        <div>Swipeable content</div>
      </SwipeableListItem>
    );
    expect(screen.getByText('Swipeable content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <SwipeableListItem className="custom">
        <div>Test</div>
      </SwipeableListItem>
    );
    expect(container.querySelector('.custom')).toBeInTheDocument();
  });
});
