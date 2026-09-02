import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmailListSkeleton } from '../EmailListSkeleton';

describe('EmailListSkeleton', () => {
  it('renders default 8 skeleton items', () => {
    const { container } = render(<EmailListSkeleton />);
    const items = container.querySelectorAll('.divide-y > div');
    expect(items.length).toBe(8);
  });

  it('renders custom count', () => {
    const { container } = render(<EmailListSkeleton count={3} />);
    const items = container.querySelectorAll('.divide-y > div');
    expect(items.length).toBe(3);
  });

  it('renders without crashing', () => {
    const { container } = render(<EmailListSkeleton count={2} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
