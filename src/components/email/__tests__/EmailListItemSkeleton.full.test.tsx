import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmailListItemSkeleton } from '../EmailListItemSkeleton';

describe('EmailListItemSkeleton', () => {
  it('renders with status role', () => {
    const { container } = render(<EmailListItemSkeleton />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('has aria-label for accessibility', () => {
    const { container } = render(<EmailListItemSkeleton />);
    expect(container.querySelector('[aria-label]')).toBeTruthy();
  });

  it('renders skeleton elements', () => {
    const { container } = render(<EmailListItemSkeleton />);
    expect(container.querySelectorAll('.rounded').length).toBeGreaterThanOrEqual(1);
  });

  it('renders multiple instances', () => {
    const { container } = render(
      <div>
        <EmailListItemSkeleton />
        <EmailListItemSkeleton />
        <EmailListItemSkeleton />
      </div>
    );
    expect(container.querySelectorAll('[role="status"]').length).toBe(3);
  });
});
