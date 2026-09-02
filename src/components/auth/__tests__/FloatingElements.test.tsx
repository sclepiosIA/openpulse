import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimate: () => false,
}));

import { FloatingElements } from '../FloatingElements';

describe('FloatingElements', () => {
  it('renders without crashing', () => {
    const { container } = render(<FloatingElements />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders floating orbs', () => {
    const { container } = render(<FloatingElements />);
    const orbs = container.querySelectorAll('.rounded-full.blur-xl');
    expect(orbs.length).toBeGreaterThanOrEqual(6);
  });

  it('renders geometric shapes', () => {
    const { container } = render(<FloatingElements />);
    const rect = container.querySelector('.rounded-2xl');
    expect(rect).toBeInTheDocument();
  });

  it('renders dot pattern (16 dots)', () => {
    const { container } = render(<FloatingElements />);
    const dots = container.querySelectorAll('.w-1\\.5');
    expect(dots.length).toBe(16);
  });
});
