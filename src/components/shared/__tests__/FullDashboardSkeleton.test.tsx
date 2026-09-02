import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FullDashboardSkeleton } from '../FullDashboardSkeleton';

describe('FullDashboardSkeleton', () => {
  it('renders skeleton layout', () => {
    const { container } = render(<FullDashboardSkeleton />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it('renders KPI skeleton cards', () => {
    const { container } = render(<FullDashboardSkeleton />);
    // 5 KPI cards + 6 widget cards = 11 cards total
    const cards = container.querySelectorAll('[class*="overflow-hidden"]');
    expect(cards.length).toBeGreaterThanOrEqual(5);
  });

  it('renders hero section skeleton', () => {
    const { container } = render(<FullDashboardSkeleton />);
    const hero = container.querySelector('[class*="gradient"]');
    expect(hero).toBeInTheDocument();
  });
});
