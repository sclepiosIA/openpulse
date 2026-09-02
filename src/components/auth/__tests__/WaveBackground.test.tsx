import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimate: () => false,
}));

import { WaveBackground } from '../WaveBackground';

describe('WaveBackground', () => {
  it('renders without crashing', () => {
    const { container } = render(<WaveBackground />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 3 SVG wave layers', () => {
    const { container } = render(<WaveBackground />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBe(3);
  });

  it('has pointer-events-none for non-interactive overlay', () => {
    const { container } = render(<WaveBackground />);
    expect(container.firstChild).toHaveClass('pointer-events-none');
  });
});
