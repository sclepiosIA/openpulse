import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmailThreadSkeleton } from '../EmailThreadSkeleton';

describe('EmailThreadSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<EmailThreadSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 3 message card skeletons', () => {
    const { container } = render(<EmailThreadSkeleton />);
    // Each message skeleton is wrapped in a Card (rendered as div with class)
    const cards = container.querySelectorAll('.rounded-full');
    // 3 avatar skeletons (one per message card)
    expect(cards.length).toBe(3);
  });

  it('renders header skeleton elements', () => {
    const { container } = render(<EmailThreadSkeleton />);
    // Title skeleton (h-6 w-3/4)
    const titleSkeleton = container.querySelector('.h-6.w-3\\/4');
    expect(titleSkeleton).toBeInTheDocument();
  });
});
