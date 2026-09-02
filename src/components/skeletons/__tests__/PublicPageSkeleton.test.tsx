import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PublicPageSkeleton } from '../PublicPageSkeleton';

describe('PublicPageSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PublicPageSkeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 6 content card skeletons', () => {
    const { container } = render(<PublicPageSkeleton />);
    const cards = container.querySelectorAll('.border.rounded-lg');
    expect(cards.length).toBe(6);
  });

  it('renders 4 video grid skeletons', () => {
    const { container } = render(<PublicPageSkeleton />);
    const videoSkeletons = container.querySelectorAll('.h-48');
    expect(videoSkeletons.length).toBe(4);
  });
});
