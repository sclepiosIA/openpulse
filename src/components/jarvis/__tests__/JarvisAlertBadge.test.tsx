import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JarvisAlertBadge } from '../JarvisAlertBadge';

describe('JarvisAlertBadge', () => {
  it('renders with count', () => {
    render(<JarvisAlertBadge type="urgent" count={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders without count', () => {
    const { container } = render(<JarvisAlertBadge type="insight" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders different sizes', () => {
    const { container } = render(<JarvisAlertBadge type="risk" size="lg" count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
