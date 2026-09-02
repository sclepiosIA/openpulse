import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { JarvisSkeletonLoader, JarvisTypingIndicator } from '../JarvisSkeletonLoader';

describe('JarvisSkeletonLoader', () => {
  it('renders message variant with content', () => {
    const { container } = render(<JarvisSkeletonLoader variant="message" />);
    expect(container.querySelector('.space-y-3')).toBeInTheDocument();
  });

  it('renders panel variant with header and messages', () => {
    const { container } = render(<JarvisSkeletonLoader variant="panel" />);
    expect(container.querySelector('.space-y-4')).toBeInTheDocument();
  });

  it('renders actions variant with action cards', () => {
    const { container } = render(<JarvisSkeletonLoader variant="actions" />);
    const cards = container.querySelectorAll('[class*="rounded-xl"]');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it('renders stats variant with grid', () => {
    const { container } = render(<JarvisSkeletonLoader variant="stats" />);
    expect(container.querySelector('.grid')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<JarvisSkeletonLoader variant="message" className="my-custom" />);
    expect(container.querySelector('.my-custom')).toBeInTheDocument();
  });
});

describe('JarvisTypingIndicator', () => {
  it('renders typing text', () => {
    render(<JarvisTypingIndicator />);
    expect(screen.getByText('Jarvis tape...')).toBeInTheDocument();
  });

  it('renders 3 animated dots', () => {
    const { container } = render(<JarvisTypingIndicator />);
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBe(3);
  });
});
