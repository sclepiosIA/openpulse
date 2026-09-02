import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfiniteScrollLoader } from '../InfiniteScrollLoader';

describe('InfiniteScrollLoader', () => {
  it('renders spacer when not visible', () => {
    const { container } = render(<InfiniteScrollLoader isVisible={false} isLoading={false} />);
    expect(container.querySelector('.h-4')).toBeTruthy();
  });

  it('shows spinner when loading and visible', () => {
    const { container } = render(<InfiniteScrollLoader isVisible={true} isLoading={true} />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    expect(screen.getByText(/Chargement des emails suivants/)).toBeInTheDocument();
  });

  it('shows scroll hint when visible but not loading', () => {
    render(<InfiniteScrollLoader isVisible={true} isLoading={false} />);
    expect(screen.getByText(/Faites défiler/)).toBeInTheDocument();
  });
});
