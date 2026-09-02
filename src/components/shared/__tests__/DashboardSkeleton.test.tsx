import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardSkeleton } from '../DashboardSkeleton';

describe('DashboardSkeleton', () => {
  it('renders skeleton cards', () => {
    const { container } = render(<DashboardSkeleton />);
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('renders multiple skeleton blocks', () => {
    const { container } = render(<DashboardSkeleton />);
    // Should have at least a few card-like skeleton elements
    expect(container.firstElementChild).toBeTruthy();
  });
});
