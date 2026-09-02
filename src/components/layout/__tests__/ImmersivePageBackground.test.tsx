import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/hooks/ui/useShouldAnimate', () => ({
  useShouldAnimate: () => false,
}));

import { vi } from 'vitest';
import { ImmersivePageBackground } from '../ImmersivePageBackground';

describe('ImmersivePageBackground', () => {
  it('renders children', () => {
    const { getByText } = render(
      <ImmersivePageBackground>
        <p>Hello</p>
      </ImmersivePageBackground>
    );
    expect(getByText('Hello')).toBeInTheDocument();
  });

  it('renders with min-h-dvh', () => {
    const { container } = render(
      <ImmersivePageBackground>
        <div />
      </ImmersivePageBackground>
    );
    expect(container.firstChild).toHaveClass('min-h-dvh');
  });

  it('renders custom className', () => {
    const { container } = render(
      <ImmersivePageBackground className="custom-bg">
        <div />
      </ImmersivePageBackground>
    );
    expect(container.querySelector('.custom-bg')).toBeInTheDocument();
  });

  it('renders floating elements as static divs when animations disabled', () => {
    const { container } = render(
      <ImmersivePageBackground>
        <div />
      </ImmersivePageBackground>
    );
    // Should have static floating elements (not motion.div)
    const floaters = container.querySelectorAll('.blur-2xl');
    expect(floaters.length).toBeGreaterThanOrEqual(4);
  });
});
