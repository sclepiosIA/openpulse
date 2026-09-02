import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfiniteScrollLoader } from '../InfiniteScrollLoader';

describe('InfiniteScrollLoader', () => {
  it('renders spacer when not visible', () => {
    const { container } = render(<InfiniteScrollLoader isVisible={false} isLoading={false} />);
    expect(container.querySelector('.h-4')).toBeInTheDocument();
    expect(screen.queryByText(/Chargement/)).not.toBeInTheDocument();
  });

  it('shows loading spinner when visible and loading', () => {
    render(<InfiniteScrollLoader isVisible={true} isLoading={true} />);
    expect(screen.getByText('Chargement des emails suivants...')).toBeInTheDocument();
  });

  it('shows scroll prompt when visible but not loading', () => {
    render(<InfiniteScrollLoader isVisible={true} isLoading={false} />);
    expect(screen.getByText(/Faites défiler/)).toBeInTheDocument();
  });
});
