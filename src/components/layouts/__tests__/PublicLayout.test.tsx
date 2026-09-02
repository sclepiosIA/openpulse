import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicLayout } from '../PublicLayout';

describe('PublicLayout', () => {
  it('renders children content', () => {
    render(
      <PublicLayout>
        <div data-testid="child">Hello</div>
      </PublicLayout>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders footer with copyright', () => {
    render(<PublicLayout><div>Test</div></PublicLayout>);
    expect(screen.getByText(/2025 OpenPulse/)).toBeInTheDocument();
  });

  it('has main element for content', () => {
    render(<PublicLayout><div>Content</div></PublicLayout>);
    const main = document.querySelector('main');
    expect(main).toBeInTheDocument();
  });
});
